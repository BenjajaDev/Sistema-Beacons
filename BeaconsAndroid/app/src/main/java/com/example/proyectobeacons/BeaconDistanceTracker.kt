package com.example.proyectobeacons

import kotlin.math.pow
import kotlin.math.roundToInt

/**
 * Potencia de referencia (RSSI esperado a 1 m) que se usa cuando el beacon no
 * anuncia una calibración creíble dentro de su paquete iBeacon.
 */
private const val DEFAULT_TX_POWER = -59

/** Rango en el que un txPower anunciado se considera válido. */
private const val MIN_VALID_TX_POWER = -100
private const val MAX_VALID_TX_POWER = -20

/** Lectura ya filtrada y estable de un beacon concreto. */
data class TrackedBeacon(
    val id: String,
    val major: Int,
    val minor: Int,
    val uuid: String?,
    /** RSSI suavizado en dBm sobre la ventana larga. */
    val rssi: Double,
    /**
     * Distancia estable, para mostrar en pantalla y comparar beacons entre sí.
     * Promedia varios segundos, así que reacciona despacio a propósito.
     */
    val distance: Double,
    /**
     * Distancia de máxima aproximación en los últimos segundos.
     *
     * Es la que decide si el usuario ha llegado a estar dentro del umbral:
     * al pasar caminando junto a un beacon solo se está cerca 1 o 2 segundos,
     * y la media larga nunca llega a bajar tanto. Este valor sí.
     */
    val closestDistance: Double,
    /**
     * Distancia "reciente": promedio simple (sin filtrar por fuerza) de los
     * últimos [BeaconDistanceTracker] `nearWindowMillis`.
     *
     * A diferencia de [distance] (que promedia varios segundos y por eso
     * tarda en reflejar que el usuario se alejó), esta reacciona en ~2 s
     * tanto al acercarse como al alejarse. Es la que se usa para decidir
     * cuándo soltar el beacon enganchado o cambiar a otro: [distance] solo
     * sirve para el número estable que se muestra en pantalla.
     */
    val awayDistance: Double,
    val samples: Int,
    val lastSeen: Long,
)

/**
 * Mantiene una ventana deslizante de RSSI por beacon y la convierte en metros.
 *
 * Una sola lectura de RSSI fluctúa ±10 dBm, lo que a corta distancia hace que
 * dos beacons parezcan "entrelazarse". Aquí se promedian las muestras de los
 * últimos [windowMillis] descartando los extremos (el 10 % más alto y el 10 %
 * más bajo), que es lo que hace que el umbral de 0,5 m sea utilizable.
 *
 * La conversión usa el modelo log-distancia estándar:
 *
 *     d = 10 ^ ((txPower - rssi) / (10 * n))
 *
 * donde `txPower` es el RSSI a 1 m y `n` el exponente de pérdida de propagación
 * ([pathLossExponent], ~2.0 en interiores despejados).
 *
 * Todos los métodos públicos son seguros para llamarse desde el hilo del
 * callback BLE y desde la ViewModel a la vez.
 */
class BeaconDistanceTracker(
    private val windowMillis: Long = 4_000L,
    /** Ventana corta con la que se mide la máxima aproximación. */
    private val nearWindowMillis: Long = 2_000L,
    private val expiryMillis: Long = 7_000L,
    private val maxSamples: Int = 60,
    private val minSamples: Int = 2,
    private val pathLossExponent: Double = 2.0,
) {


    private class Sample(val rssi: Int, val timestamp: Long)

    private class Track(val major: Int, val minor: Int, var uuid: String?) {
        val samples = ArrayDeque<Sample>()
        var txPower = DEFAULT_TX_POWER
        var lastSeen = 0L
        /** Último RSSI filtrado válido, para sobrevivir a huecos de emisión. */
        var lastRssi: Double? = null
    }

    private val tracks = HashMap<String, Track>()

    /**
     * RSSI medido a 1 m durante la calibración. Cuando vale `null` se usa el
     * txPower que anuncia cada beacon, que en la práctica suele venir con un
     * valor de fábrica que no corresponde a su emisión real.
     */
    @Volatile
    var referenceRssi: Int? = null

    /** Registra una nueva emisión recibida de un beacon. */
    @Synchronized
    fun update(ad: BeaconAdvertisement, now: Long = System.currentTimeMillis()) {
        val major = ad.major ?: return
        val minor = ad.minor ?: return
        // Un RSSI de 0 dBm es el valor centinela de Android para "sin medida".
        if (ad.rssi == 0 || ad.rssi < -127) return

        val track = tracks.getOrPut(idOf(major, minor)) { Track(major, minor, ad.uuid) }
        if (ad.uuid != null) track.uuid = ad.uuid
        if (ad.txPower in MIN_VALID_TX_POWER..MAX_VALID_TX_POWER) track.txPower = ad.txPower

        track.samples.addLast(Sample(ad.rssi, now))
        track.lastSeen = now
        trim(track, now)
    }

    /**
     * Beacons vistos recientemente y con muestras suficientes, ordenados del
     * más cercano al más lejano. Los que llevan más de [expiryMillis] sin
     * emitir se olvidan.
     */
    @Synchronized
    fun visible(now: Long = System.currentTimeMillis()): List<TrackedBeacon> {
        val result = ArrayList<TrackedBeacon>(tracks.size)
        val iterator = tracks.entries.iterator()
        while (iterator.hasNext()) {
            val entry = iterator.next()
            val track = entry.value
            if (now - track.lastSeen > expiryMillis) {
                iterator.remove()
                continue
            }
            trim(track, now)
            if (track.samples.size < minSamples) continue
            result.add(snapshot(entry.key, track, now) ?: continue)
        }
        result.sortBy { it.distance }
        return result
    }

    /**
     * Devuelve un beacon concreto aunque ahora mismo tenga pocas muestras.
     *
     * Se usa para el beacon ya enganchado: un hueco momentáneo en las emisiones
     * no debe hacer desaparecer su mensaje de la pantalla. Solo deja de
     * devolverlo cuando lleva más de [expiryMillis] sin emitir nada.
     */
    @Synchronized
    fun find(id: String, now: Long = System.currentTimeMillis()): TrackedBeacon? {
        val track = tracks[id] ?: return null
        if (now - track.lastSeen > expiryMillis) return null
        trim(track, now)
        return snapshot(id, track, now)
    }

    /** Descarta todo el historial (al detener el escaneo). */
    @Synchronized
    fun reset() = tracks.clear()

    /**
     * Construye la lectura de un beacon. Si la ventana se quedó sin muestras
     * (silencio momentáneo) se reutiliza el último RSSI bueno, para que la
     * distancia mostrada no dé un salto absurdo.
     */
    private fun snapshot(id: String, track: Track, now: Long): TrackedBeacon? {
        val rssi = filteredRssi(track) ?: track.lastRssi ?: return null
        track.lastRssi = rssi
        val nearRssi = approachRssi(track, now) ?: rssi
        val recentRssi = awayRssi(track, now) ?: rssi
        val referencia = referenceRssi ?: track.txPower
        return TrackedBeacon(
            id = id,
            major = track.major,
            minor = track.minor,
            uuid = track.uuid,
            rssi = rssi,
            distance = distanceFrom(referencia, rssi),
            closestDistance = distanceFrom(referencia, nearRssi),
            awayDistance = distanceFrom(referencia, recentRssi),
            samples = track.samples.size,
            lastSeen = track.lastSeen,
        )
    }

    /** Elimina las muestras fuera de la ventana temporal o por encima del cupo. */
    private fun trim(track: Track, now: Long) {
        while (track.samples.isNotEmpty() && now - track.samples.first().timestamp > windowMillis) {
            track.samples.removeFirst()
        }
        while (track.samples.size > maxSamples) {
            track.samples.removeFirst()
        }
    }

    /**
     * Media recortada: se ordenan las muestras y se descarta el 10 % de cada
     * extremo antes de promediar, para que un pico o un rebote aislado no
     * dispare la distancia.
     */
    private fun filteredRssi(track: Track): Double? {
        val size = track.samples.size
        if (size == 0) return null
        val sorted = track.samples.map { it.rssi }.sorted()
        val cut = if (size >= 5) size / 10 else 0
        val kept = sorted.subList(cut, size - cut)
        if (kept.isEmpty()) return null
        return kept.sum().toDouble() / kept.size
    }

    /**
     * RSSI de máxima aproximación: promedio del tercio más fuerte de las
     * muestras de los últimos [nearWindowMillis].
     *
     * Se queda con el tercio superior (no con el máximo absoluto) para que un
     * único pico por reflexión no cuente como "he llegado al beacon", pero sin
     * diluir el momento de mayor cercanía como haría la media de toda la
     * ventana larga.
     */
    private fun approachRssi(track: Track, now: Long): Double? {
        val recientes = track.samples
            .filter { now - it.timestamp <= nearWindowMillis }
            .map { it.rssi }
        if (recientes.isEmpty()) return null
        val fuertes = recientes.sortedDescending()
        val cuantas = maxOf(1, fuertes.size / 3)
        return fuertes.take(cuantas).sum().toDouble() / cuantas
    }

    /**
     * RSSI reciente sin filtrar por fuerza: promedio simple de las muestras de
     * los últimos [nearWindowMillis]. A favor de un beacon o en contra por
     * igual, así que sirve para detectar que el usuario se alejó sin esperar
     * a que la media larga de [filteredRssi] lo "olvide".
     */
    private fun awayRssi(track: Track, now: Long): Double? {
        val recientes = track.samples
            .filter { now - it.timestamp <= nearWindowMillis }
            .map { it.rssi }
        if (recientes.isEmpty()) return null
        return recientes.sum().toDouble() / recientes.size
    }

    /** Modelo log-distancia. Devuelve metros con 2 decimales. */
    private fun distanceFrom(txPower: Int, rssi: Double): Double {
        val exponent = (txPower - rssi) / (10.0 * pathLossExponent)
        val meters = 10.0.pow(exponent).coerceIn(0.05, 100.0)
        return (meters * 100).roundToInt() / 100.0
    }

    companion object {
        /** Identificador estable de un beacon dentro de la app. */
        fun idOf(major: Int, minor: Int): String = "$major-$minor"
    }
}
