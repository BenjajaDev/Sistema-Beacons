package com.example.proyectobeacons.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Capa intermedia entre la UI y la red.
 * Devuelve un Result para que la pantalla pueda mostrar éxito o error de forma sencilla.
 */
class BeaconRepository(
    private val api: BeaconApi = RetrofitClient.api
) {
    suspend fun fetchBeaconInfo(major: Int, minor: Int): Result<BeaconInfo> =
        withContext(Dispatchers.IO) {
            try {
                Result.success(api.getBeaconInfo(major, minor))
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
}
