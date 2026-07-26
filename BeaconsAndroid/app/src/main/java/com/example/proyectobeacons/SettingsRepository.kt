package com.example.proyectobeacons

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
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
    val activationDistance: Float = 5f,
    val lowPower: Boolean = false,
)

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
    }

    val settings: Flow<SignalSettings> = context.dataStore.data.map { prefs ->
        SignalSettings(
            themeMode = prefs[Keys.THEME]?.let { runCatching { ThemeMode.valueOf(it) }.getOrNull() }
                ?: ThemeMode.SYSTEM,
            ttsSpeed = prefs[Keys.TTS_SPEED] ?: 1.0f,
            vibration = prefs[Keys.VIBRATION] ?: true,
            autoRepeat = prefs[Keys.AUTO_REPEAT] ?: false,
            activationDistance = prefs[Keys.ACTIVATION_DISTANCE] ?: 5f,
            lowPower = prefs[Keys.LOW_POWER] ?: false,
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

    suspend fun setActivationDistance(meters: Float) =
        context.dataStore.edit { it[Keys.ACTIVATION_DISTANCE] = meters.coerceIn(1f, 10f) }

    suspend fun setLowPower(enabled: Boolean) =
        context.dataStore.edit { it[Keys.LOW_POWER] = enabled }
}
