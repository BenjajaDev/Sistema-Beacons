package com.example.proyectobeacons

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay

@Composable
fun HomeScreen(
    beaconViewModel: BeaconViewModel,
    settingsViewModel: SettingsViewModel,
    modifier: Modifier = Modifier,
) {
    val palette = LocalSignalPalette.current
    val uiState by beaconViewModel.uiState.collectAsStateWithLifecycle()
    val lastKnown by beaconViewModel.lastKnownLocation.collectAsStateWithLifecycle()
    val settings by settingsViewModel.settings.collectAsStateWithLifecycle()

    // Repetición automática: si está activada, reproduce el mensaje cada 30 s
    // mientras haya un beacon detectado.
    LaunchedEffect(settings.autoRepeat, uiState is BeaconUiState.Detected) {
        if (settings.autoRepeat && uiState is BeaconUiState.Detected) {
            while (true) {
                delay(30_000)
                beaconViewModel.speakMessage()
            }
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(palette.surface)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        when (val state = uiState) {
            is BeaconUiState.Scanning -> ScanningContent(
                palette = palette,
                lastKnown = lastKnown,
                onRepeat = { beaconViewModel.repeatLastLocation() },
            )
            is BeaconUiState.Detected -> DetectedContent(
                palette = palette,
                state = state,
                onPlay = { beaconViewModel.speakMessage() },
            )
        }
    }
}

/* ----------------------------- Estado: BUSCANDO ----------------------------- */

@Composable
private fun ScanningContent(
    palette: SignalPalette,
    lastKnown: BeaconLocation?,
    onRepeat: () -> Unit,
) {
    DistanceCircle(
        palette = palette,
        active = false,
        centerTop = "—",
        centerBottom = "sin señal",
        contentDesc = "Sin señal de beacon",
    )

    Text(
        text = "Buscando beacons...",
        color = palette.textMuted,
        fontSize = 16.sp,
        textAlign = TextAlign.Center,
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
    )

    InfoCard(palette = palette, active = false) {
        Text(
            text = "Última ubicación conocida",
            color = palette.textSecondary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
        )
        Text(
            text = lastKnown?.locationName ?: "Aún sin ubicación",
            color = palette.textPrimary,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = lastKnown?.zone ?: "Acércate a un beacon para empezar",
            color = palette.textSecondary,
            fontSize = 14.sp,
        )
    }

    SignalPrimaryButton(
        text = "Repetir ubicación",
        palette = palette,
        enabled = lastKnown != null,
        contentDesc = lastKnown?.let { "Repetir: ${it.ttsMessage}" } ?: "Repetir ubicación",
        onClick = onRepeat,
    )
}

/* ----------------------------- Estado: DETECTADO ----------------------------- */

@Composable
private fun DetectedContent(
    palette: SignalPalette,
    state: BeaconUiState.Detected,
    onPlay: () -> Unit,
) {
    val distanceText = "%.1f".format(state.distance)

    DistanceCircle(
        palette = palette,
        active = true,
        centerTop = distanceText,
        centerBottom = "metros",
        contentDesc = "Distancia al beacon: $distanceText metros",
    )

    Text(
        text = "Beacon detectado",
        color = palette.accent,
        fontSize = 16.sp,
        fontWeight = FontWeight.SemiBold,
        textAlign = TextAlign.Center,
        // El anuncio principal lo da la tarjeta; este texto no necesita leerse aparte.
        modifier = Modifier.clearAndSetSemantics { },
    )

    // Tarjeta activa: ESTE es el contenido prioritario para TalkBack.
    // liveRegion = Assertive hace que se anuncie de inmediato al detectar.
    InfoCard(
        palette = palette,
        active = true,
        modifier = Modifier.semantics {
            liveRegion = LiveRegionMode.Assertive
            contentDescription = state.ttsMessage
        },
    ) {
        Text(
            text = state.locationName,
            color = palette.textPrimary,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = state.zone,
            color = palette.accent,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
        )
        Text(
            text = state.ttsMessage,
            color = palette.textSecondary,
            fontSize = 16.sp,
        )
    }

    SignalPrimaryButton(
        text = "Reproducir mensaje",
        palette = palette,
        contentDesc = "Reproducir: ${state.ttsMessage}",
        onClick = onPlay,
    )

    SignalSecondaryButton(
        text = "Siguientes pasos",
        palette = palette,
        contentDesc = "Siguientes pasos",
        onClick = { /* Navegación de guiado pendiente */ },
    )
}

/* ----------------------------- Componentes ----------------------------- */

/**
 * Círculo de distancia con dos anillos decorativos exteriores.
 * Los anillos son puramente visuales: se ocultan a TalkBack. La descripción
 * accesible se coloca en el contenedor con [contentDesc].
 */
@Composable
private fun DistanceCircle(
    palette: SignalPalette,
    active: Boolean,
    centerTop: String,
    centerBottom: String,
    contentDesc: String,
) {
    val borderColor = if (active) palette.accent else palette.border
    val centerColor = if (active) palette.accent else palette.textMuted

    Box(
        modifier = Modifier
            .size(134.dp)
            .semantics { contentDescription = contentDesc },
        contentAlignment = Alignment.Center,
    ) {
        // Anillo exterior (134dp)
        Box(
            modifier = Modifier
                .size(134.dp)
                .clip(CircleShape)
                .ringBorder(borderColor.copy(alpha = if (active) 0.25f else 0.15f))
                .clearAndSetSemantics { },
        )
        // Anillo intermedio (110dp)
        Box(
            modifier = Modifier
                .size(110.dp)
                .clip(CircleShape)
                .ringBorder(borderColor.copy(alpha = if (active) 0.5f else 0.3f))
                .clearAndSetSemantics { },
        )
        // Círculo principal (90dp)
        Box(
            modifier = Modifier
                .size(90.dp)
                .clip(CircleShape)
                .background(if (active) palette.accentSoft else palette.card)
                .ringBorder(borderColor)
                .clearAndSetSemantics { },
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = centerTop,
                    color = centerColor,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = centerBottom,
                    color = palette.textMuted,
                    fontSize = 12.sp,
                )
            }
        }
    }
}

private fun Modifier.ringBorder(color: Color): Modifier =
    this.border(BorderStroke(2.dp, color), CircleShape)

@Composable
private fun InfoCard(
    palette: SignalPalette,
    active: Boolean,
    modifier: Modifier = Modifier,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    val container = if (active) palette.cardActive else palette.card
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(container)
            .border(
                BorderStroke(1.dp, if (active) palette.accent else palette.border),
                RoundedCornerShape(20.dp),
            )
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        content = content,
    )
}

@Composable
private fun SignalPrimaryButton(
    text: String,
    palette: SignalPalette,
    contentDesc: String,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(16.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = palette.accent,
            contentColor = if (palette.dark) SignalColors.NavyDark else Color.White,
        ),
        contentPadding = PaddingValues(vertical = 16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .semantics { contentDescription = contentDesc },
    ) {
        Text(text = text, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun SignalSecondaryButton(
    text: String,
    palette: SignalPalette,
    contentDesc: String,
    onClick: () -> Unit,
) {
    OutlinedButton(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.5.dp, palette.border),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = palette.accent),
        contentPadding = PaddingValues(vertical = 16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .semantics { contentDescription = contentDesc },
    ) {
        Text(text = text, fontSize = 16.sp, fontWeight = FontWeight.Medium)
    }
}
