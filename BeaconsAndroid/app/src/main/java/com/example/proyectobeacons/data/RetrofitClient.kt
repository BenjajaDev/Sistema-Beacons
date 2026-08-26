package com.example.proyectobeacons.data

import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Punto único donde se configura la conexión al backend.
 *
 * BASE_URL:
 *   - EMULADOR de Android  -> "http://10.0.2.2:3000/"  (10.0.2.2 = localhost del PC)
 *   - TELÉFONO físico       -> "http://TU_IP_LOCAL:3000/" (ej. http://192.168.1.100:3000/)
 *     Saca tu IP con `ipconfig` en Windows y recuerda añadirla en network_security_config.xml.
 */
object RetrofitClient {

    private const val BASE_URL = "http://10.187.248.177:3000/"

    val api: BeaconApi by lazy {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(logging)
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .build()

        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(BeaconApi::class.java)
    }
}
