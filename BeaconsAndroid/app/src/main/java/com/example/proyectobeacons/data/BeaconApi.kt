package com.example.proyectobeacons.data

import retrofit2.HttpException
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header

/**
 * Endpoints del backend que usa la app.
 *
 * GET /api/public/beacons entrega el catálogo completo con su versión (ETag). La app
 * lo guarda y orienta sin conexión. El servidor mantiene GET /beacons/{major}/{minor}
 * para las versiones anteriores de la app.
 */
interface BeaconApi {
    @GET("api/public/beacons")
    suspend fun getCatalogo(@Header("If-None-Match") versionActual: String?): Response<ArchivoCatalogo>
}

/** Sincroniza contra el servidor: un 304 significa que el teléfono ya tiene la última versión. */
class FuenteCatalogoRetrofit(private val api: BeaconApi) : FuenteCatalogo {
    override suspend fun descargar(versionActual: String?): RespuestaCatalogo {
        val respuesta = api.getCatalogo(versionActual?.let { "\"$it\"" })
        if (respuesta.code() == 304) return RespuestaCatalogo.SinCambios
        val cuerpo = respuesta.body()
        if (!respuesta.isSuccessful || cuerpo == null) throw HttpException(respuesta)
        return RespuestaCatalogo.Nuevo(
            version = cuerpo.version,
            beacons = cuerpo.beacons.orEmpty().mapNotNull { it?.aFicha() },
        )
    }
}
