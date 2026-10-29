package com.example.proyectobeacons.data

import com.example.proyectobeacons.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Punto único donde se configura la conexión al backend.
 *
 * La URL sale del tipo de build (BuildConfig.BASE_URL, definida en gradle.properties):
 *   - debug   -> signal.urlDesarrollo, el servidor local (HTTP en la red WiFi).
 *   - release -> signal.urlProduccion, https://proyectosignal.pages.dev/.
 */
object RetrofitClient {

    val api: BeaconApi by lazy {
        val logging = HttpLoggingInterceptor().apply {
            // En release no se registran las respuestas en el logcat del teléfono.
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(logging)
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .build()

        Retrofit.Builder()
            .baseUrl(BuildConfig.BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(BeaconApi::class.java)
    }
}
