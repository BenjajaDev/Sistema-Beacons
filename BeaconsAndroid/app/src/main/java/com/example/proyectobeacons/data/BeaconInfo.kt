package com.example.proyectobeacons.data

/**
 * Información que el backend devuelve para un beacon concreto.
 * Los nombres de los campos deben coincidir con el JSON que envía el servidor.
 */
data class BeaconInfo(
    val titulo: String,
    val descripcion: String,
    val ubicacion: String? = null
)
