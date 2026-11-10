package com.example.proyectobeacons.data

import com.google.gson.Gson
import com.google.gson.JsonParseException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.Locale

/*
 * Catálogo de fichas guardado en el teléfono: la app orienta sin internet.
 *
 * - Cada beacon detectado se responde desde aquí, al instante y sin red.
 * - Con conexión, se sincroniza con GET /api/public/beacons. Si la versión no
 *   cambió, el servidor responde 304 y no se descarga nada.
 * - La primera vez, sin internet, se usa la copia incluida en la APK
 *   (assets/catalogo-beacons.json, se regenera con `npm run catalogo:app`).
 * - Si la información tiene más de [DIAS_PARA_AVISAR] días sin verificarse, la
 *   app lo dice en vez de fallar en silencio.
 *
 * No depende de Android: se prueba con JUnit (CatalogoBeaconsTest).
 */

/** Ficha de un beacon, como la entrega el servidor. */
data class FichaBeacon(
    val major: Int,
    val minor: Int,
    val titulo: String,
    val descripcion: String,
    val ubicacion: String?,
)

data class Catalogo(val version: String, val beacons: List<FichaBeacon>)

enum class OrigenCatalogo {
    /** La copia que trae la APK: nunca se ha sincronizado en este teléfono. */
    INCLUIDO,

    /** Descargado del servidor (o confirmado con un 304). */
    SERVIDOR,
}

data class EstadoCatalogo(
    val total: Int,
    val origen: OrigenCatalogo,
    /** Última vez que la información se confirmó como vigente (ms desde epoch). */
    val vigenteDesde: Long?,
)

/** Respuesta del servidor a una sincronización. Las fichas incompletas ya vienen descartadas. */
sealed interface RespuestaCatalogo {
    data class Nuevo(val version: String?, val beacons: List<FichaBeacon>) : RespuestaCatalogo
    data object SinCambios : RespuestaCatalogo
}

/** Descarga el catálogo. Lanza una excepción si no hay red o el servidor falla. */
fun interface FuenteCatalogo {
    suspend fun descargar(versionActual: String?): RespuestaCatalogo
}

/** Dónde se guarda el catálogo descargado. */
interface AlmacenCatalogo {
    fun leer(): String?
    fun escribir(contenido: String)
}

/** Archivo en el almacenamiento interno de la app. Escritura atómica. */
class AlmacenEnArchivo(private val archivo: File) : AlmacenCatalogo {
    override fun leer(): String? = archivo.takeIf { it.exists() }?.readText()

    override fun escribir(contenido: String) {
        // Si la app se cierra a mitad de la escritura, el archivo anterior queda intacto.
        val temporal = File(archivo.parentFile, "${archivo.name}.tmp")
        temporal.writeText(contenido)
        Files.move(
            temporal.toPath(),
            archivo.toPath(),
            StandardCopyOption.REPLACE_EXISTING,
            StandardCopyOption.ATOMIC_MOVE,
        )
    }
}

enum class ResultadoSincronizacion { ACTUALIZADO, SIN_CAMBIOS, SIN_CONEXION, RESPUESTA_INVALIDA }

class CatalogoBeacons(
    private val almacen: AlmacenCatalogo,
    /** Contenido de la copia incluida en la APK, o null si no existe. */
    private val incluido: () -> String?,
    private val fuente: FuenteCatalogo,
    private val ahora: () -> Long = System::currentTimeMillis,
) {
    companion object {
        const val DIAS_PARA_AVISAR = 7L
        private const val DIA_MS = 24L * 60 * 60 * 1000
        private const val MAX_ID = 65_535
    }

    private val gson = Gson()
    private val mutex = Mutex()

    @Volatile
    private var fichas: Map<Long, FichaBeacon> = emptyMap()

    @Volatile
    private var version: String? = null

    private val _estado = MutableStateFlow<EstadoCatalogo?>(null)

    /** null mientras no se haya cargado nada (ni siquiera la copia incluida). */
    val estado: StateFlow<EstadoCatalogo?> = _estado.asStateFlow()

    /** Carga lo guardado en el teléfono o, si no hay nada válido, la copia incluida. */
    fun cargar() {
        val guardado = almacen.leer()?.let(::interpretar)
        if (guardado != null) {
            aplicar(guardado.catalogo, OrigenCatalogo.SERVIDOR, guardado.verificadoEn)
            return
        }
        val copia = incluido()?.let(::interpretar) ?: return
        aplicar(copia.catalogo, OrigenCatalogo.INCLUIDO, copia.generadoEn)
    }

    fun buscar(major: Int, minor: Int): FichaBeacon? = fichas[clave(major, minor)]

    /** Pide la versión vigente al servidor. Nunca lanza: la app sigue con lo que tiene. */
    suspend fun sincronizar(): ResultadoSincronizacion {
        return mutex.withLock {
            val respuesta = try {
                fuente.descargar(version)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                return ResultadoSincronizacion.SIN_CONEXION
            }
            val vigente = when (respuesta) {
                is RespuestaCatalogo.SinCambios ->
                    version?.let { Catalogo(it, fichas.values.sortedWith(ORDEN)) }
                is RespuestaCatalogo.Nuevo -> validar(respuesta.version, respuesta.beacons)
            } ?: return ResultadoSincronizacion.RESPUESTA_INVALIDA
            val momento = ahora()
            guardar(vigente, momento)
            aplicar(vigente, OrigenCatalogo.SERVIDOR, momento)
            if (respuesta is RespuestaCatalogo.SinCambios) {
                ResultadoSincronizacion.SIN_CAMBIOS
            } else {
                ResultadoSincronizacion.ACTUALIZADO
            }
        }
    }

    /** Si la información puede estar desactualizada, el aviso para la persona; si no, null. */
    fun aviso(zona: ZoneId = ZoneId.systemDefault()): String? {
        val e = _estado.value ?: return "No hay información de los puntos guardada en el teléfono. " +
            "Conéctate a internet para descargarla."
        val desde = e.vigenteDesde
        val antigua = desde == null || ahora() - desde > DIAS_PARA_AVISAR * DIA_MS
        if (!antigua) return null
        val fecha = desde?.let { fechaLegible(it, zona) }
        val situacion = when {
            e.origen == OrigenCatalogo.INCLUIDO && fecha != null ->
                "Usando la información incluida en la app, del $fecha."
            e.origen == OrigenCatalogo.INCLUIDO -> "Usando la información incluida en la app."
            fecha != null -> "La información de los puntos se actualizó el $fecha."
            else -> "La información de los puntos puede estar desactualizada."
        }
        return "$situacion Conéctate a internet para actualizarla."
    }

    private fun aplicar(catalogo: Catalogo, origen: OrigenCatalogo, vigenteDesde: Long?) {
        fichas = catalogo.beacons.associateBy { clave(it.major, it.minor) }
        version = catalogo.version
        _estado.value = EstadoCatalogo(catalogo.beacons.size, origen, vigenteDesde)
    }

    private fun guardar(catalogo: Catalogo, verificadoEn: Long) {
        val json = ArchivoCatalogo(
            version = catalogo.version,
            beacons = catalogo.beacons.map {
                FichaJson(it.major, it.minor, it.titulo, it.descripcion, it.ubicacion)
            },
            generadoEn = null,
            verificadoEn = verificadoEn,
        )
        // Si no se puede escribir, la app sigue con el catálogo en memoria.
        runCatching { almacen.escribir(gson.toJson(json)) }
    }

    private data class Interpretado(val catalogo: Catalogo, val verificadoEn: Long?, val generadoEn: Long?)

    /** Lee un archivo guardado o la copia incluida. Devuelve null si no es válido. */
    private fun interpretar(texto: String): Interpretado? {
        val archivo = try {
            gson.fromJson(texto, ArchivoCatalogo::class.java)
        } catch (e: JsonParseException) {
            null
        } ?: return null
        val catalogo = validar(archivo.version, archivo.beacons.orEmpty().mapNotNull { it?.aFicha() })
            ?: return null
        val generado = archivo.generadoEn?.let {
            try {
                Instant.parse(it).toEpochMilli()
            } catch (e: DateTimeParseException) {
                null
            }
        }
        return Interpretado(catalogo, archivo.verificadoEn, generado)
    }

    /** Descarta fichas fuera de rango, vacías o repetidas. Un catálogo sin versión no se acepta. */
    private fun validar(version: String?, beacons: List<FichaBeacon>): Catalogo? {
        if (version.isNullOrBlank()) return null
        val validas = beacons
            .filter { it.major in 0..MAX_ID && it.minor in 0..MAX_ID }
            .filter { it.titulo.isNotBlank() && it.descripcion.isNotBlank() }
            .distinctBy { clave(it.major, it.minor) }
            .sortedWith(ORDEN)
        return Catalogo(version, validas)
    }

    private fun clave(major: Int, minor: Int): Long = major.toLong() * (MAX_ID + 1) + minor
}

private val ORDEN = compareBy<FichaBeacon>({ it.major }, { it.minor })

private val FORMATO_FECHA = DateTimeFormatter.ofPattern("d 'de' MMMM", Locale.forLanguageTag("es-CL"))

internal fun fechaLegible(ms: Long, zona: ZoneId): String =
    FORMATO_FECHA.format(Instant.ofEpochMilli(ms).atZone(zona))

/*
 * Formato JSON de la respuesta del servidor, del archivo guardado y de la copia
 * incluida. Todo es anulable: Gson no respeta la nulidad de Kotlin, así que se
 * valida al convertir.
 */
data class ArchivoCatalogo(
    val version: String?,
    val beacons: List<FichaJson?>?,
    /** Solo en la copia incluida: cuándo se generó (ISO 8601). */
    val generadoEn: String?,
    /** Solo en el archivo guardado: última confirmación con el servidor. */
    val verificadoEn: Long?,
)

data class FichaJson(
    val major: Int?,
    val minor: Int?,
    val titulo: String?,
    val descripcion: String?,
    val ubicacion: String?,
) {
    fun aFicha(): FichaBeacon? {
        if (major == null || minor == null || titulo == null || descripcion == null) return null
        return FichaBeacon(major, minor, titulo.trim(), descripcion.trim(), ubicacion?.trim()?.ifEmpty { null })
    }
}
