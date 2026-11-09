plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

// URL del servidor de SIGNAL por tipo de build (ver gradle.properties). La app solo
// llama a GET {url}beacons/:major/:minor. Se valida aquí: un error de URL debe
// cortar la compilación, no aparecer en el teléfono de una persona usuaria.
fun urlDelServidor(propiedad: String, soloHttps: Boolean): String {
    val url = providers.gradleProperty(propiedad).orNull?.trim().orEmpty()
    if (url.isEmpty()) throw GradleException("Falta $propiedad en gradle.properties.")
    if (!url.endsWith("/")) throw GradleException("$propiedad debe terminar en / (Retrofit lo exige): $url")
    if (soloHttps && !url.startsWith("https://")) {
        throw GradleException("$propiedad debe usar https:// (la app de producción no envía tráfico sin cifrar): $url")
    }
    return url
}

android {
    namespace = "com.example.proyectobeacons"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "com.example.proyectobeacons"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            buildConfigField("String", "BASE_URL", "\"${urlDelServidor("signal.urlDesarrollo", soloHttps = false)}\"")
        }
        release {
            buildConfigField("String", "BASE_URL", "\"${urlDelServidor("signal.urlProduccion", soloHttps = true)}\"")
            optimization {
                enable = false
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)

    // Dependencia para Beacons
    implementation("org.altbeacon:android-beacon-library:2.20.5")

    // Red: Retrofit + Gson para consultar el backend
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Corrutinas para llamadas asíncronas
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.4")

    // SIGNAL: persistencia de ajustes y ViewModels en Compose
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.0")

    testImplementation(libs.junit)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)

}