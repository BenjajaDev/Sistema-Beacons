package com.example.proyectobeacons.data

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException
import java.time.Instant
import java.time.ZoneOffset

class CatalogoBeaconsTest {

    @get:Rule
    val carpeta = TemporaryFolder()

    private val dia = 24L * 60 * 60 * 1000
    private val inicio = Instant.parse("2026-10-29T15:00:00Z").toEpochMilli()

    private val incluido = """
        {
          "version": "v-incluida",
          "generadoEn": "2026-10-29T12:00:00Z",
          "beacons": [
            { "major": 1, "minor": 16, "titulo": "Entrada principal",
              "descripcion": "Te estás acercando a la entrada.", "ubicacion": "Planta baja" }
          ]
        }
    """.trimIndent()

    private val ficha = FichaBeacon(1, 21, "Recepción", "Al frente está la secretaría.", null)

    private class AlmacenEnMemoria(var contenido: String? = null) : AlmacenCatalogo {
        override fun leer() = contenido
        override fun escribir(contenido: String) {
            this.contenido = contenido
        }
    }

    /** Fuente que responde lo indicado y recuerda la versión que le enviaron. */
    private class FuenteDePrueba(var responder: () -> RespuestaCatalogo) : FuenteCatalogo {
        var versionRecibida: String? = null
        override suspend fun descargar(versionActual: String?): RespuestaCatalogo {
            versionRecibida = versionActual
            return responder()
        }
    }

    private fun catalogo(
        almacen: AlmacenCatalogo = AlmacenEnMemoria(),
        fuente: FuenteCatalogo = FuenteDePrueba { throw IOException("sin red") },
        reloj: () -> Long = { inicio },
        copia: String? = incluido,
    ) = CatalogoBeacons(almacen, { copia }, fuente, reloj)

    @Test
    fun `sin nada guardado usa la copia incluida en la app`() {
        val c = catalogo()
        c.cargar()
        assertEquals("Entrada principal", c.buscar(1, 16)?.titulo)
        assertNull(c.buscar(1, 21))
        assertEquals(OrigenCatalogo.INCLUIDO, c.estado.value?.origen)
    }

    @Test
    fun `lo descargado se guarda y se usa sin conexion al volver a abrir la app`() = runBlocking {
        val almacen = AlmacenEnMemoria()
        val primera = catalogo(almacen, FuenteDePrueba { RespuestaCatalogo.Nuevo("v2", listOf(ficha)) })
        primera.cargar()
        assertEquals(ResultadoSincronizacion.ACTUALIZADO, primera.sincronizar())
        assertEquals("Recepción", primera.buscar(1, 21)?.titulo)
        // El catálogo nuevo reemplaza al anterior: lo borrado en el panel ya no está.
        assertNull(primera.buscar(1, 16))

        val sinRed = catalogo(almacen)
        sinRed.cargar()
        assertEquals("Recepción", sinRed.buscar(1, 21)?.titulo)
        assertEquals(OrigenCatalogo.SERVIDOR, sinRed.estado.value?.origen)
        assertEquals(inicio, sinRed.estado.value?.vigenteDesde)
    }

    @Test
    fun `envia la version que tiene y un 304 solo confirma que sigue vigente`() = runBlocking {
        var ahora = inicio
        val fuente = FuenteDePrueba { RespuestaCatalogo.Nuevo("v2", listOf(ficha)) }
        val c = catalogo(fuente = fuente, reloj = { ahora })
        c.cargar()
        c.sincronizar()
        assertEquals("v-incluida", fuente.versionRecibida)

        ahora = inicio + 3 * dia
        fuente.responder = { RespuestaCatalogo.SinCambios }
        assertEquals(ResultadoSincronizacion.SIN_CAMBIOS, c.sincronizar())
        assertEquals("v2", fuente.versionRecibida)
        assertEquals("Recepción", c.buscar(1, 21)?.titulo)
        assertEquals(inicio + 3 * dia, c.estado.value?.vigenteDesde)
    }

    @Test
    fun `sin conexion o con una respuesta invalida conserva lo que tiene`() = runBlocking {
        val fuente = FuenteDePrueba { throw IOException("sin red") }
        val c = catalogo(fuente = fuente)
        c.cargar()
        assertEquals(ResultadoSincronizacion.SIN_CONEXION, c.sincronizar())
        assertEquals("Entrada principal", c.buscar(1, 16)?.titulo)

        fuente.responder = { RespuestaCatalogo.Nuevo(null, listOf(ficha)) }
        assertEquals(ResultadoSincronizacion.RESPUESTA_INVALIDA, c.sincronizar())
        assertEquals("Entrada principal", c.buscar(1, 16)?.titulo)
        assertEquals(OrigenCatalogo.INCLUIDO, c.estado.value?.origen)
    }

    @Test
    fun `descarta fichas fuera de rango, vacias o repetidas`() = runBlocking {
        val c = catalogo(
            fuente = FuenteDePrueba {
                RespuestaCatalogo.Nuevo(
                    "v3",
                    listOf(
                        ficha,
                        ficha.copy(titulo = "Repetida"),
                        FichaBeacon(70_000, 1, "Fuera de rango", "x", null),
                        FichaBeacon(2, 2, " ", "Sin título", null),
                    ),
                )
            },
        )
        c.cargar()
        c.sincronizar()
        assertEquals(1, c.estado.value?.total)
        assertEquals("Recepción", c.buscar(1, 21)?.titulo)
    }

    @Test
    fun `un archivo guardado dañado no deja a la app sin informacion`() {
        val c = catalogo(AlmacenEnMemoria("{ esto no es json"))
        c.cargar()
        assertEquals("Entrada principal", c.buscar(1, 16)?.titulo)

        val incompleto = catalogo(AlmacenEnMemoria("""{"version":"v","beacons":[{"major":1}]}"""))
        incompleto.cargar()
        assertEquals(0, incompleto.estado.value?.total)
    }

    @Test
    fun `avisa solo si la informacion tiene mas de 7 dias sin confirmarse`() = runBlocking {
        var ahora = inicio
        val c = catalogo(
            fuente = FuenteDePrueba { RespuestaCatalogo.Nuevo("v2", listOf(ficha)) },
            reloj = { ahora },
        )
        c.cargar()
        // La copia incluida se generó hoy: todavía no hace falta avisar.
        assertNull(c.aviso(ZoneOffset.UTC))
        ahora = inicio + 8 * dia
        assertEquals(
            "Usando la información incluida en la app, del 29 de octubre. " +
                "Conéctate a internet para actualizarla.",
            c.aviso(ZoneOffset.UTC),
        )

        c.sincronizar()
        assertNull(c.aviso(ZoneOffset.UTC))
        ahora += 10 * dia
        assertEquals(
            "La información de los puntos se actualizó el 6 de noviembre. " +
                "Conéctate a internet para actualizarla.",
            c.aviso(ZoneOffset.UTC),
        )
    }

    @Test
    fun `sin copia incluida ni nada guardado lo dice`() {
        val c = catalogo(copia = null)
        c.cargar()
        assertNull(c.estado.value)
        assertTrue(c.aviso(ZoneOffset.UTC)!!.startsWith("No hay información de los puntos guardada"))
    }

    @Test
    fun `el archivo se reemplaza entero y sin dejar temporales`() {
        val archivo = File(carpeta.root, "catalogo-beacons.json")
        val almacen = AlmacenEnArchivo(archivo)
        assertNull(almacen.leer())
        almacen.escribir("uno")
        almacen.escribir("dos")
        assertEquals("dos", almacen.leer())
        assertEquals(listOf("catalogo-beacons.json"), carpeta.root.list()!!.toList())
    }

    @Test
    fun `convierte el JSON del servidor descartando fichas incompletas`() {
        assertNotNull(FichaJson(1, 2, "T", "D", " ").aFicha())
        assertNull(FichaJson(1, 2, "T", "D", " ").aFicha()!!.ubicacion)
        assertNull(FichaJson(1, null, "T", "D", null).aFicha())
        assertNull(FichaJson(1, 2, null, "D", null).aFicha())
    }
}
