package com.example.proyectobeacons.data

import retrofit2.http.GET
import retrofit2.http.Path

/**
 * Define los endpoints del backend.
 * El servidor expone: GET /beacons/{major}/{minor}  ->  JSON con BeaconInfo
 */
interface BeaconApi {
    @GET("beacons/{major}/{minor}")
    suspend fun getBeaconInfo(
        @Path("major") major: Int,
        @Path("minor") minor: Int
    ): BeaconInfo
}
