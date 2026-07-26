package com.example.proyectobeacons

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * Mantiene el modo de tema (claro/oscuro/auto) persistido en DataStore.
 * La app arranca en [ThemeMode.SYSTEM] por defecto.
 */
class ThemeViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = SettingsRepository(application)

    val themeMode: StateFlow<ThemeMode> = repository.settings
        .map { it.themeMode }
        .stateIn(viewModelScope, SharingStarted.Eagerly, ThemeMode.SYSTEM)

    fun setTheme(mode: ThemeMode) {
        viewModelScope.launch { repository.setThemeMode(mode) }
    }
}
