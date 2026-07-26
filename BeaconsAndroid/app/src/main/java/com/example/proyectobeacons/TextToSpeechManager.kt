package com.example.proyectobeacons

import android.content.Context
import android.media.AudioAttributes
import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.ArrayDeque
import java.util.Locale

/**
 * Envoltura sobre [TextToSpeech]. Inicializa el motor en español de Chile y
 * reproduce mensajes con [QUEUE_FLUSH].
 *
 * **Compatibilidad con TalkBack:**
 * Cuando TalkBack está activo, configura [AudioAttributes] con
 * [USAGE_ASSISTANCE_ACCESSIBILITY] para que el TTS comparta el canal con el
 * lector de pantalla en lugar de ser silenciado por él.
 */
class TextToSpeechManager(context: Context) {

    private var ready = false
    private var pendingRate: Float? = null
    private var utteranceCounter = 0
    private val pendingMessages = ArrayDeque<String>()

    private val tts: TextToSpeech = TextToSpeech(context.applicationContext) { status ->
        if (status == TextToSpeech.SUCCESS) {
            val result = tts.setLanguage(Locale("es", "CL"))
            if (result == TextToSpeech.LANG_MISSING_DATA ||
                result == TextToSpeech.LANG_NOT_SUPPORTED
            ) {
                tts.setLanguage(Locale("es", "ES"))
            }

            // AudioAttributes para coexistir con TalkBack
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
            tts.setAudioAttributes(attrs)

            ready = true
            pendingRate?.let { tts.setSpeechRate(it) }
            pendingRate = null
            flushPendingMessages()
        } else {
            Log.e("TextToSpeechManager", "No se pudo inicializar TextToSpeech (status=$status)")
        }
    }

    fun speak(text: String) {
        if (text.isBlank()) return
        if (!ready) {
            pendingMessages.addLast(text)
            return
        }

        val utteranceId = "signal_${utteranceCounter++}"
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
    }

    private fun flushPendingMessages() {
        while (ready && pendingMessages.isNotEmpty()) {
            val nextMessage = pendingMessages.removeFirst()
            if (nextMessage.isNotBlank()) {
                val utteranceId = "signal_${utteranceCounter++}"
                tts.speak(nextMessage, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
            }
        }
    }

    /** Velocidad de lectura. 1.0 = normal. Se aplica en cuanto el motor esté listo. */
    fun setSpeechRate(rate: Float) {
        if (ready) tts.setSpeechRate(rate) else pendingRate = rate
    }

    fun stop() {
        if (ready) tts.stop()
    }

    fun shutdown() {
        pendingMessages.clear()
        tts.stop()
        tts.shutdown()
    }
}
