package com.example.proyectobeacons

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * Expone y modifica los ajustes de SIGNAL (velocidad de lectura, vibración,
 * repetición automática, distancia de activación, modo bajo consumo).
 * El tema vive en [ThemeViewModel]; todo lo demás se gestiona aquí.
 */
class SettingsViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = SettingsRepository(application)

    val settings: StateFlow<SignalSettings> = repository.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, SignalSettings())

    fun setTtsSpeed(speed: Float) = viewModelScope.launch { repository.setTtsSpeed(speed) }

    fun setVibration(enabled: Boolean) = viewModelScope.launch { repository.setVibration(enabled) }

    fun setAutoRepeat(enabled: Boolean) = viewModelScope.launch { repository.setAutoRepeat(enabled) }

    fun setActivationDistance(meters: Float) =
        viewModelScope.launch { repository.setActivationDistance(meters) }

    fun setLowPower(enabled: Boolean) = viewModelScope.launch { repository.setLowPower(enabled) }
}
