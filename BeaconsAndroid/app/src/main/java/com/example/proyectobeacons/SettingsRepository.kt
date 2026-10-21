package com.example.proyectobeacons

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** Modo de tema seleccionable por el usuario. La app arranca en [SYSTEM]. */
enum class ThemeMode { LIGHT, DARK, SYSTEM }

/** Instantánea de todos los ajustes persistidos. */
data class SignalSettings(
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val ttsSpeed: Float = 1.0f,
    val vibration: Boolean = true,
    val autoRepeat: Boolean = false,
    val activationDistance: Float = DEFAULT_ACTIVATION_DISTANCE,
    val lowPower: Boolean = false,
    /**
     * RSSI medido a 1 m del beacon durante la calibración, en dBm.
     * `null` = usar el txPower que anuncia cada beacon.
     */
    val referenceRssi: Int? = null,
)

/** Distancia de activación por defecto y límites configurables, en metros. */
const val MIN_ACTIVATION_DISTANCE = 0.5f
const val MAX_ACTIVATION_DISTANCE = 10f
const val ACTIVATION_DISTANCE_STEP = 0.5f

/**
 * 0,5 m (el mínimo permitido) exige que el RSSI filtrado baje de un umbral
 * casi imposible de alcanzar de forma fiable en interiores: el ruido típico
 * de BLE hace que la detección falle o tarde mucho en dispararse. 1,5 m es un
 * punto de partida realista que sigue permitiendo bajar el valor a mano si
 * los beacons están muy próximos entre sí.
 */
const val DEFAULT_ACTIVATION_DISTANCE = 1.5f

/** Se incrementa al cambiar el rango o el valor por defecto de un ajuste. */
private const val SETTINGS_VERSION = 3

// Un único DataStore para toda la app.
private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "signal_settings")

/**
 * Acceso centralizado a los ajustes. Expone un [Flow] reactivo y funciones
 * suspend para actualizar cada preferencia. Usado tanto por las ViewModels de
 * ajustes/tema como por [BeaconViewModel] (distancia de activación, bajo consumo…).
 */
class SettingsRepository(private val context: Context) {

    private object Keys {
        val THEME = stringPreferencesKey("theme_mode")
        val TTS_SPEED = floatPreferencesKey("tts_speed")
        val VIBRATION = booleanPreferencesKey("vibration")
        val AUTO_REPEAT = booleanPreferencesKey("auto_repeat")
        val ACTIVATION_DISTANCE = floatPreferencesKey("activation_distance")
        val LOW_POWER = booleanPreferencesKey("low_power")
        val REFERENCE_RSSI = intPreferencesKey("reference_rssi")
        val VERSION = intPreferencesKey("settings_version")
    }

    /**
     * Migración: cada vez que cambia el rango o el valor por defecto de la
     * distancia de activación, se restablece al nuevo valor por defecto en
     * lugar de arrastrar uno guardado con una lógica antigua. La versión 3
     * subió el valor por defecto de 0,5 m a 1,5 m: 0,5 m resultaba casi
     * imposible de alcanzar de forma fiable con el ruido normal de RSSI.
     */
    suspend fun migrateIfNeeded() = context.dataStore.edit { prefs ->
        if ((prefs[Keys.VERSION] ?: 0) < SETTINGS_VERSION) {
            prefs[Keys.ACTIVATION_DISTANCE] = DEFAULT_ACTIVATION_DISTANCE
            prefs[Keys.VERSION] = SETTINGS_VERSION
        }
    }

    val settings: Flow<SignalSettings> = context.dataStore.data.map { prefs ->
        SignalSettings(
            themeMode = prefs[Keys.THEME]?.let { runCatching { ThemeMode.valueOf(it) }.getOrNull() }
                ?: ThemeMode.SYSTEM,
            ttsSpeed = prefs[Keys.TTS_SPEED] ?: 1.0f,
            vibration = prefs[Keys.VIBRATION] ?: true,
            autoRepeat = prefs[Keys.AUTO_REPEAT] ?: false,
            activationDistance = (prefs[Keys.ACTIVATION_DISTANCE] ?: DEFAULT_ACTIVATION_DISTANCE)
                .coerceIn(MIN_ACTIVATION_DISTANCE, MAX_ACTIVATION_DISTANCE),
            lowPower = prefs[Keys.LOW_POWER] ?: false,
            referenceRssi = prefs[Keys.REFERENCE_RSSI]?.takeIf { it in -100..-20 },
        )
    }

    suspend fun setThemeMode(mode: ThemeMode) =
        context.dataStore.edit { it[Keys.THEME] = mode.name }

    suspend fun setTtsSpeed(speed: Float) =
        context.dataStore.edit { it[Keys.TTS_SPEED] = speed.coerceIn(0.5f, 2.5f) }

    suspend fun setVibration(enabled: Boolean) =
        context.dataStore.edit { it[Keys.VIBRATION] = enabled }

    suspend fun setAutoRepeat(enabled: Boolean) =
        context.dataStore.edit { it[Keys.AUTO_REPEAT] = enabled }

    /** Se guarda redondeado al paso de 0,5 m para que el valor sea reproducible. */
    suspend fun setActivationDistance(meters: Float) = context.dataStore.edit {
        val snapped = Math.round(meters / ACTIVATION_DISTANCE_STEP) * ACTIVATION_DISTANCE_STEP
        it[Keys.ACTIVATION_DISTANCE] =
            snapped.coerceIn(MIN_ACTIVATION_DISTANCE, MAX_ACTIVATION_DISTANCE)
    }

    suspend fun setLowPower(enabled: Boolean) =
        context.dataStore.edit { it[Keys.LOW_POWER] = enabled }

    /**
     * Guarda el RSSI medido a 1 m del beacon. Con `null` se vuelve a confiar en
     * el txPower que anuncia cada beacon.
     */
    suspend fun setReferenceRssi(rssi: Int?) = context.dataStore.edit { prefs ->
        if (rssi == null) prefs.remove(Keys.REFERENCE_RSSI)
        else prefs[Keys.REFERENCE_RSSI] = rssi.coerceIn(-100, -20)
    }
}
