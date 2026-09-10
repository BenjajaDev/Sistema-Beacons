package com.example.proyectobeacons

import android.app.Application
import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.accessibility.AccessibilityManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.proyectobeacons.data.BeaconRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.math.roundToInt

data class BeaconLocation(
    val locationName: String,
    val zone: String,
    val ttsMessage: String,
    val timestamp: Long = System.currentTimeMillis()
)

sealed class BeaconUiState {
    object Scanning : BeaconUiState()
    data class Detected(
        val distance: Double,
        val major: Int,
        val minor: Int,
        val locationName: String,
        val ttsMessage: String,
        val zone: String,
    ) : BeaconUiState()
}

class BeaconViewModel(application: Application) : AndroidViewModel(application) {

    private companion object {
        /**
         * Un beacon rival tiene que estar un 25 % más cerca que el enganchado
         * para robarle el foco. Evita el "entrelazado" cuando dos beacons
         * quedan a distancias parecidas.
         */
        const val SWITCH_RATIO = 0.75

        /** Comprobaciones seguidas que debe superar un beacon para engancharse. */
        const val CONFIRMACIONES_ENTRADA = 2

        /** Comprobaciones seguidas para que un rival sustituya al enganchado. */
        const val CONFIRMACIONES_CAMBIO = 3

        /** Comprobaciones seguidas fuera de rango para soltar el enganchado. */
        const val CONFIRMACIONES_SALIDA = 8

        /**
         * Radio de salida: múltiplo de la distancia de activación a partir del
         * cual se considera que el usuario ya abandonó el punto. Es amplio a
         * propósito para que el mensaje no parpadee mientras sigues ahí.
         */
        const val FACTOR_SALIDA = 6.0

        /** Radio de salida mínimo en metros, pase lo que pase. */
        const val SALIDA_MINIMA = 5.0

        /** No se repite el anuncio del mismo beacon antes de este tiempo. */
        const val REANNOUNCE_COOLDOWN_MS = 8_000L

        /** Periodo de reevaluación de qué beacon está enganchado. */
        const val REFRESH_INTERVAL_MS = 250L

        /** Espera entre reintentos al servidor cuando la consulta falló. */
        const val RESOLVE_RETRY_MS = 10_000L

        /** Periodo del volcado de diagnóstico a logcat. */
        const val DIAGNOSTICO_MS = 2_000L
    }

    private val scanner = BeaconScanner(application) { ad -> processAdvertisement(ad) }
    private val tracker = BeaconDistanceTracker()
    private val ttsManager = TextToSpeechManager(application)
    private val settingsRepository = SettingsRepository(application)
    private val beaconRepository = BeaconRepository()

    private val _uiState = MutableStateFlow<BeaconUiState>(BeaconUiState.Scanning)
    val uiState: StateFlow<BeaconUiState> = _uiState.asStateFlow()

    private val _lastKnownLocation = MutableStateFlow<BeaconLocation?>(null)
    val lastKnownLocation: StateFlow<BeaconLocation?> = _lastKnownLocation.asStateFlow()

    private val _history = MutableStateFlow<List<BeaconLocation>>(emptyList())
    val history: StateFlow<List<BeaconLocation>> = _history.asStateFlow()

    /** Todo lo que se está viendo ahora mismo, del más cercano al más lejano. */
    private val _nearbyBeacons = MutableStateFlow<List<TrackedBeacon>>(emptyList())
    val nearbyBeacons: StateFlow<List<TrackedBeacon>> = _nearbyBeacons.asStateFlow()

    private var lastSpokenId = ""
    private var lastSpokenAt = 0L
    private var lastResolveAttempt = 0L
    private var lastDiagnostico = 0L
    private var activationDistance = SignalSettings().activationDistance
    private var vibrationEnabled = true

    /** Beacon enganchado ahora mismo; su mensaje permanece fijo en pantalla. */
    private var activeId: String? = null

    /** Contadores de confirmaciones seguidas, para no decidir con una sola lectura. */
    private var votosEntrada = 0
    private var candidatoEntrada: String? = null
    private var votosCambio = 0
    private var candidatoCambio: String? = null
    private var votosSalida = 0

    /** Datos ya resueltos en el servidor, para no consultarlo en cada emisión. */
    private val locationCache = mutableMapOf<String, BeaconLocation>()
    private val selectionMutex = Mutex()

    init {
        viewModelScope.launch {
            settingsRepository.settings.collect { settings ->
                activationDistance = settings.activationDistance
                vibrationEnabled = settings.vibration
                tracker.referenceRssi = settings.referenceRssi
                ttsManager.setSpeechRate(settings.ttsSpeed)
            }
        }
        // Reevaluar periódicamente: así el estado también se limpia cuando el
        // usuario se aleja y el beacon deja de emitir.
        viewModelScope.launch {
            while (isActive) {
                delay(REFRESH_INTERVAL_MS)
                // Blindado: una excepción suelta aquí mataría el bucle y la app
                // dejaría de detectar en silencio hasta reiniciarla.
                runCatching { refreshSelection() }
                    .onFailure { Log.e("SIGNAL_VM", "Fallo evaluando beacons", it) }
            }
        }
    }

    fun startScanning(context: Context) {
        Log.d("SIGNAL_VM", "Solicitando inicio de escaneo al Scanner")
        scanner.start()
    }

    fun stopScanning() {
        scanner.stop()
        tracker.reset()
        soltarEnganche()
    }

    private fun soltarEnganche() {
        activeId = null
        votosEntrada = 0
        candidatoEntrada = null
        votosCambio = 0
        candidatoCambio = null
        votosSalida = 0
        _uiState.value = BeaconUiState.Scanning
    }

    /** Solo acumula la muestra; la decisión la toma [refreshSelection]. */
    private fun processAdvertisement(ad: BeaconAdvertisement) {
        if (ad.type != BeaconType.IBEACON) return
        tracker.update(ad)
    }

    /**
     * Decide qué beacon está enganchado y actualiza la UI. Se ejecuta cada
     * [REFRESH_INTERVAL_MS], así que ninguna decisión depende de una sola
     * lectura: todas se toman por votos consecutivos.
     *
     * Comportamiento:
     *  1. **Entrar** — el beacon más cercano se engancha cuando su distancia de
     *     máxima aproximación baja del umbral configurado, confirmado
     *     [CONFIRMACIONES_ENTRADA] veces seguidas.
     *  2. **Permanecer** — una vez enganchado, el mensaje queda fijo. No se
     *     suelta porque la distancia oscile: solo si el beacon desaparece o si
     *     el usuario se aleja de verdad (más allá del radio de salida,
     *     confirmado [CONFIRMACIONES_SALIDA] veces).
     *  3. **Cambiar** — otro beacon toma el relevo solo si entra en su propio
     *     umbral y además está un [SWITCH_RATIO] más cerca que el enganchado,
     *     confirmado [CONFIRMACIONES_CAMBIO] veces seguidas.
     */
    private suspend fun refreshSelection() = selectionMutex.withLock {
        val now = System.currentTimeMillis()
        val visible = tracker.visible(now)
        _nearbyBeacons.value = visible
        volcarDiagnostico(visible, now)

        // El enganchado se consulta directamente: sigue contando aunque en este
        // instante tenga pocas muestras, para que su mensaje no parpadee.
        val active = activeId?.let { tracker.find(it, now) }

        // --- Sin nada enganchado: buscar a quién engancharse ---
        if (active == null) {
            if (activeId != null) {
                // El beacon enganchado dejó de emitir por completo.
                Log.i("SIGNAL_VM", "Beacon $activeId perdido: dejó de emitir")
                soltarEnganche()
            }
            val candidato = visible.firstOrNull { it.closestDistance <= activationDistance }
            if (candidato == null) {
                votosEntrada = 0
                candidatoEntrada = null
                return@withLock
            }
            votosEntrada = if (candidato.id == candidatoEntrada) votosEntrada + 1 else 1
            candidatoEntrada = candidato.id
            if (votosEntrada < CONFIRMACIONES_ENTRADA) return@withLock

            engancharA(candidato, now)
            return@withLock
        }

        // --- Hay uno enganchado: ¿sigue siendo el bueno? ---
        votosEntrada = 0
        candidatoEntrada = null

        // ¿Se alejó de verdad? Radio de salida amplio para no parpadear.
        val radioSalida = maxOf(SALIDA_MINIMA, activationDistance * FACTOR_SALIDA)
        votosSalida = if (active.distance > radioSalida) votosSalida + 1 else 0
        if (votosSalida >= CONFIRMACIONES_SALIDA) {
            Log.i("SIGNAL_VM", "Beacon ${active.id} abandonado a ${fmt(active.distance)}m")
            soltarEnganche()
            return@withLock
        }

        // ¿Otro beacon está claramente más cerca y dentro de su propio umbral?
        val rival = visible.firstOrNull {
            it.id != active.id &&
                it.closestDistance <= activationDistance &&
                it.distance < active.distance * SWITCH_RATIO
        }
        if (rival == null) {
            votosCambio = 0
            candidatoCambio = null
        } else {
            votosCambio = if (rival.id == candidatoCambio) votosCambio + 1 else 1
            candidatoCambio = rival.id
            if (votosCambio >= CONFIRMACIONES_CAMBIO) {
                Log.i(
                    "SIGNAL_VM",
                    "Relevo: ${active.id} (${fmt(active.distance)}m) -> " +
                        "${rival.id} (${fmt(rival.distance)}m)"
                )
                engancharA(rival, now)
                return@withLock
            }
        }

        // Mismo beacon: el mensaje se mantiene, solo se refresca la distancia.
        refrescarDistancia(active, now)
    }

    /** Engancha [chosen] y lanza el anuncio. */
    private suspend fun engancharA(chosen: TrackedBeacon, now: Long) {
        activeId = chosen.id
        votosEntrada = 0
        candidatoEntrada = null
        votosCambio = 0
        candidatoCambio = null
        votosSalida = 0

        lastResolveAttempt = now
        val location = resolveLocation(chosen.id, chosen.major, chosen.minor)
        Log.i(
            "SIGNAL_VM",
            "ENGANCHADO ${chosen.id} · aprox ${fmt(chosen.closestDistance)}m · " +
                "estable ${fmt(chosen.distance)}m · RSSI ${"%.1f".format(chosen.rssi)}dBm · " +
                "${chosen.samples} muestras"
        )

        _uiState.value = BeaconUiState.Detected(
            distance = chosen.distance,
            major = chosen.major,
            minor = chosen.minor,
            locationName = location.locationName,
            ttsMessage = location.ttsMessage,
            zone = location.zone
        )
        _lastKnownLocation.value = location

        val repeatable = chosen.id != lastSpokenId || now - lastSpokenAt > REANNOUNCE_COOLDOWN_MS
        if (repeatable) {
            lastSpokenId = chosen.id
            lastSpokenAt = now
            speakInternal(location.ttsMessage)
            vibrate()
            addToHistory(location)
        }
    }

    /**
     * El beacon enganchado sigue siendo el mismo: se conserva el mensaje y solo
     * se actualiza la distancia. Si el servidor falló al engancharlo, se
     * reintenta de vez en cuando para sustituir el texto de respaldo, sin
     * volver a anunciar nada.
     */
    private suspend fun refrescarDistancia(active: TrackedBeacon, now: Long) {
        val current = _uiState.value
        if (current !is BeaconUiState.Detected) {
            // La UI perdió el estado (p. ej. tras stopScanning): se rehace.
            engancharA(active, now)
            return
        }
        _uiState.value = current.copy(distance = active.distance)

        if (active.id in locationCache || now - lastResolveAttempt <= RESOLVE_RETRY_MS) return
        lastResolveAttempt = now
        val info = resolveLocation(active.id, active.major, active.minor)
        if (active.id !in locationCache) return
        (_uiState.value as? BeaconUiState.Detected)?.let {
            _uiState.value = it.copy(
                locationName = info.locationName,
                ttsMessage = info.ttsMessage,
                zone = info.zone,
            )
        }
        _lastKnownLocation.value = info
    }

    /**
     * Calibra el modelo de distancia: toma el RSSI del beacon más cercano
     * asumiendo que el teléfono está justo a 1 metro de él, y lo guarda como
     * potencia de referencia. Sin esto, el modelo usa el txPower que anuncia el
     * beacon, que suele ser un valor de fábrica y no su emisión real.
     *
     * Devuelve el RSSI guardado, o `null` si no hay ningún beacon a la vista.
     */
    fun calibrarAUnMetro(): Int? {
        val objetivo = _nearbyBeacons.value.firstOrNull() ?: return null
        val medido = objetivo.rssi.roundToInt()
        viewModelScope.launch { settingsRepository.setReferenceRssi(medido) }
        Log.i("SIGNAL_VM", "Calibrado con ${objetivo.id}: 1 m = $medido dBm")
        return medido
    }

    /** Vuelve a confiar en el txPower que anuncia cada beacon. */
    fun borrarCalibracion() {
        viewModelScope.launch { settingsRepository.setReferenceRssi(null) }
        Log.i("SIGNAL_VM", "Calibración borrada")
    }

    /** Vuelca a logcat todo lo que se está viendo, para calibrar sobre el terreno. */
    private fun volcarDiagnostico(visible: List<TrackedBeacon>, now: Long) {
        if (now - lastDiagnostico < DIAGNOSTICO_MS) return
        lastDiagnostico = now
        if (visible.isEmpty()) {
            Log.d("SIGNAL_DIAG", "Sin beacons visibles (umbral ${fmt(activationDistance.toDouble())}m)")
            return
        }
        val detalle = visible.joinToString(" | ") {
            "${it.id} aprox=${fmt(it.closestDistance)}m est=${fmt(it.distance)}m " +
                "rssi=${"%.0f".format(it.rssi)} n=${it.samples}"
        }
        Log.d(
            "SIGNAL_DIAG",
            "umbral=${fmt(activationDistance.toDouble())}m enganchado=${activeId ?: "-"} :: $detalle"
        )
    }

    private fun fmt(meters: Double) = "%.2f".format(meters)

    private suspend fun resolveLocation(id: String, major: Int, minor: Int): BeaconLocation {
        locationCache[id]?.let { return it }
        Log.d("SIGNAL_VM", "Consultando servidor para M:$major m:$minor")
        return beaconRepository.fetchBeaconInfo(major, minor).fold(
            onSuccess = { info ->
                Log.i("SIGNAL_VM", "Servidor respondió: ${info.titulo}")
                BeaconLocation(info.titulo, info.ubicacion ?: "Desconocido", info.descripcion)
                    .also { locationCache[id] = it }
            },
            onFailure = { error ->
                // No se cachea el respaldo: se reintenta el servidor la próxima vez.
                Log.e("SIGNAL_VM", "Error de red/servidor: ${error.message}")
                resolveFallback(major, minor)
            }
        )
    }
    private fun resolveFallback(major: Int, minor: Int): BeaconLocation = when {
        major == 1 && minor == 1 -> BeaconLocation("Entrada Principal", "Planta baja", "Estás en la entrada principal.")
        major == 1 && minor == 2 -> BeaconLocation("Frente a Ascensores", "Planta baja", "Los ascensores están frente a ti.")
        else -> BeaconLocation("Punto M:$major m:$minor", "Desconocido", "Ubicación no registrada en el servidor.")
    }

    private fun addToHistory(location: BeaconLocation) {
        // La ubicación puede venir de caché, así que se sella con la hora real.
        val entry = location.copy(timestamp = System.currentTimeMillis())
        _history.update { current ->
            if (current.firstOrNull()?.locationName == entry.locationName) current
            else (listOf(entry) + current).take(20)
        }
    }

    fun speakMessage() {
        (_uiState.value as? BeaconUiState.Detected)?.let { speakInternal(it.ttsMessage) }
    }

    fun repeatLastLocation() {
        _lastKnownLocation.value?.let { speakInternal(it.ttsMessage) }
    }

    private fun speakInternal(text: String) {
        if (!isTalkBackActive()) {
            ttsManager.speak(text)
        } else {
            Log.d("SIGNAL_VM", "TalkBack activo: Omitiendo TTS interno para usar liveRegion")
        }
    }

    private fun isTalkBackActive(): Boolean {
        val am = getApplication<Application>().getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
        return am?.let {
            it.isEnabled && it.isTouchExplorationEnabled
        } ?: false
    }

    private fun vibrate() {
        if (!vibrationEnabled) return
        val context = getApplication<Application>()
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }

        vibrator?.let {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                it.vibrate(VibrationEffect.createOneShot(200L, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                it.vibrate(200L)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        scanner.stop()
        tracker.reset()
        ttsManager.shutdown()
    }
}
