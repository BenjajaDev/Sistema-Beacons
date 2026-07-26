package com.example.proyectobeacons

import android.app.Application
import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.accessibility.AccessibilityManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.proyectobeacons.data.BeaconRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class BeaconLocation(
    val locationName: String,
    val zone: String,
    val ttsMessage: String,
    val timestamp: Long = System.currentTimeMillis()
)

sealed class BeaconUiState {
    object Scanning : BeaconUiState()
    data class Detected(
        val distance: Double,
        val major: Int,
        val minor: Int,
        val locationName: String,
        val ttsMessage: String,
        val zone: String,
    ) : BeaconUiState()
}

class BeaconViewModel(application: Application) : AndroidViewModel(application) {

    private val scanner = BeaconScanner(application) { ad -> processAdvertisement(ad) }
    private val ttsManager = TextToSpeechManager(application)
    private val settingsRepository = SettingsRepository(application)
    private val beaconRepository = BeaconRepository()

    private val _uiState = MutableStateFlow<BeaconUiState>(BeaconUiState.Scanning)
    val uiState: StateFlow<BeaconUiState> = _uiState.asStateFlow()

    private val _lastKnownLocation = MutableStateFlow<BeaconLocation?>(null)
    val lastKnownLocation: StateFlow<BeaconLocation?> = _lastKnownLocation.asStateFlow()

    private val _history = MutableStateFlow<List<BeaconLocation>>(emptyList())
    val history: StateFlow<List<BeaconLocation>> = _history.asStateFlow()

    private var lastSpokenId = ""
    private var activationDistance = 10f
    private var vibrationEnabled = true

    init {
        viewModelScope.launch {
            settingsRepository.settings.collect { settings ->
                activationDistance = settings.activationDistance
                vibrationEnabled = settings.vibration
                ttsManager.setSpeechRate(settings.ttsSpeed)
            }
        }
    }

    fun startScanning(context: Context) {
        Log.d("SIGNAL_VM", "Solicitando inicio de escaneo al Scanner")
        scanner.start()
    }

    fun stopScanning() {
        scanner.stop()
    }

    private fun processAdvertisement(ad: BeaconAdvertisement) {
        if (ad.type != BeaconType.IBEACON) return
        
        val major = ad.major ?: return
        val minor = ad.minor ?: return
        val currentId = "$major-$minor"

        viewModelScope.launch {
            val location = resolveLocationAsync(major, minor)
            
            _uiState.value = BeaconUiState.Detected(
                distance = ad.distance,
                major = major,
                minor = minor,
                locationName = location.locationName,
                ttsMessage = location.ttsMessage,
                zone = location.zone
            )
            _lastKnownLocation.value = location

            if (ad.distance <= activationDistance && currentId != lastSpokenId) {
                lastSpokenId = currentId
                speakInternal(location.ttsMessage)
                vibrate()
                addToHistory(location)
            }
        }
    }

    private suspend fun resolveLocationAsync(major: Int, minor: Int): BeaconLocation {
        Log.d("SIGNAL_VM", "Consultando servidor para M:$major m:$minor")
        return beaconRepository.fetchBeaconInfo(major, minor).fold(
            onSuccess = { info ->
                Log.i("SIGNAL_VM", "Servidor respondió: ${info.titulo}")
                BeaconLocation(info.titulo, info.ubicacion ?: "Desconocido", info.descripcion)
            },
            onFailure = { error ->
                Log.e("SIGNAL_VM", "Error de red/servidor: ${error.message}")
                resolveFallback(major, minor)
            }
        )
    }

    private fun resolveFallback(major: Int, minor: Int): BeaconLocation = when {
        major == 1 && minor == 1 -> BeaconLocation("Entrada Principal", "Planta baja", "Estás en la entrada principal.")
        major == 1 && minor == 2 -> BeaconLocation("Frente a Ascensores", "Planta baja", "Los ascensores están frente a ti.")
        else -> BeaconLocation("Punto M:$major m:$minor", "Desconocido", "Ubicación no registrada en el servidor.")
    }

    private fun addToHistory(location: BeaconLocation) {
        _history.update { current ->
            if (current.firstOrNull()?.locationName == location.locationName) current
            else (listOf(location) + current).take(20)
        }
    }

    fun speakMessage() {
        (_uiState.value as? BeaconUiState.Detected)?.let { speakInternal(it.ttsMessage) }
    }

    fun repeatLastLocation() {
        _lastKnownLocation.value?.let { speakInternal(it.ttsMessage) }
    }

    private fun speakInternal(text: String) {
        if (!isTalkBackActive()) {
            ttsManager.speak(text)
        } else {
            Log.d("SIGNAL_VM", "TalkBack activo: Omitiendo TTS interno para usar liveRegion")
        }
    }

    private fun isTalkBackActive(): Boolean {
        val am = getApplication<Application>().getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
        return am?.let {
            it.isEnabled && it.isTouchExplorationEnabled
        } ?: false
    }

    private fun vibrate() {
        if (!vibrationEnabled) return
        val context = getApplication<Application>()
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }

        vibrator?.let {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                it.vibrate(VibrationEffect.createOneShot(200L, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                it.vibrate(200L)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        scanner.stop()
        ttsManager.shutdown()
    }
}
