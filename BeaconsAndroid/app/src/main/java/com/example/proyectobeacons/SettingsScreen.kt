package com.example.proyectobeacons

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun SettingsScreen(
    themeViewModel: ThemeViewModel,
    settingsViewModel: SettingsViewModel,
    modifier: Modifier = Modifier,
) {
    val palette = LocalSignalPalette.current
    val themeMode by themeViewModel.themeMode.collectAsStateWithLifecycle()
    val settings by settingsViewModel.settings.collectAsStateWithLifecycle()

    // Sub-pantalla del slider de distancia de activación.
    var showDistanceScreen by remember { mutableStateOf(false) }

    if (showDistanceScreen) {
        ActivationDistanceScreen(
            palette = palette,
            distance = settings.activationDistance,
            onChange = { settingsViewModel.setActivationDistance(it) },
            onBack = { showDistanceScreen = false },
            modifier = modifier,
        )
        return
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(palette.surface)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = "Ajustes",
            color = palette.textPrimary,
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold,
        )

        // ---- Tema ----
        SettingsSection(palette, "Apariencia") {
            Text(
                text = "Tema",
                color = palette.textSecondary,
                fontSize = 14.sp,
                modifier = Modifier.padding(bottom = 10.dp),
            )
            ThemeSegmentedControl(
                palette = palette,
                selected = themeMode,
                onSelect = { themeViewModel.setTheme(it) },
            )
        }

        // ---- Lectura ----
        SettingsSection(palette, "Lectura") {
            SpeedRow(
                palette = palette,
                speed = settings.ttsSpeed,
                onDecrease = {
                    settingsViewModel.setTtsSpeed((settings.ttsSpeed - 0.1f).coerceIn(0.5f, 2.5f))
                },
                onIncrease = {
                    settingsViewModel.setTtsSpeed((settings.ttsSpeed + 0.1f).coerceIn(0.5f, 2.5f))
                },
            )
            Spacer(Modifier.size(4.dp))
            ToggleRow(
                palette = palette,
                title = "Repetición automática",
                subtitle = "Repite el mensaje cada 30 segundos",
                checked = settings.autoRepeat,
                onCheckedChange = { settingsViewModel.setAutoRepeat(it) },
            )
        }

        // ---- Detección ----
        SettingsSection(palette, "Detección") {
            ToggleRow(
                palette = palette,
                title = "Vibración al detectar",
                subtitle = "Vibra cuando se detecta un beacon nuevo",
                checked = settings.vibration,
                onCheckedChange = { settingsViewModel.setVibration(it) },
            )
            Spacer(Modifier.size(4.dp))
            ChevronRow(
                palette = palette,
                title = "Distancia de activación",
                value = "${settings.activationDistance.toInt()} m",
                onClick = { showDistanceScreen = true },
            )
            Spacer(Modifier.size(4.dp))
            ToggleRow(
                palette = palette,
                title = "Modo bajo consumo",
                subtitle = "Escaneo más espaciado para ahorrar batería",
                checked = settings.lowPower,
                onCheckedChange = { settingsViewModel.setLowPower(it) },
            )
        }
    }
}

/* ----------------------------- Sub-pantalla distancia ----------------------------- */

@Composable
private fun ActivationDistanceScreen(
    palette: SignalPalette,
    distance: Float,
    onChange: (Float) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(palette.surface)
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(
                onClick = onBack,
                modifier = Modifier
                    .size(56.dp)
                    .semantics { contentDescription = "Volver a ajustes" },
            ) {
                Text(text = "‹", color = palette.textPrimary, fontSize = 30.sp)
            }
            Text(
                text = "Distancia de activación",
                color = palette.textPrimary,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
            )
        }

        Text(
            text = "Solo se anunciarán los beacons que estén a esta distancia o menos.",
            color = palette.textSecondary,
            fontSize = 15.sp,
        )

        Text(
            text = "${distance.toInt()} metros",
            color = palette.accent,
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold,
        )

        Slider(
            value = distance,
            onValueChange = onChange,
            valueRange = 1f..10f,
            steps = 8,
            colors = SliderDefaults.colors(
                thumbColor = palette.accent,
                activeTrackColor = palette.accent,
                inactiveTrackColor = palette.border,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .semantics {
                    contentDescription = "Distancia de activación: ${distance.toInt()} metros"
                },
        )
    }
}

/* ----------------------------- Componentes ----------------------------- */

@Composable
private fun SettingsSection(
    palette: SignalPalette,
    title: String,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(palette.card)
            .border(BorderStroke(1.dp, palette.border), RoundedCornerShape(20.dp))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            text = title,
            color = palette.accent,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 6.dp),
        )
        content()
    }
}

@Composable
private fun ThemeSegmentedControl(
    palette: SignalPalette,
    selected: ThemeMode,
    onSelect: (ThemeMode) -> Unit,
) {
    val options = listOf(
        ThemeMode.LIGHT to "Claro",
        ThemeMode.DARK to "Oscuro",
        ThemeMode.SYSTEM to "Auto",
    )
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(palette.surface)
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        options.forEach { (mode, label) ->
            val isSelected = mode == selected
            Box(
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (isSelected) palette.accent else Color.Transparent)
                    .clickable { onSelect(mode) }
                    .semantics { contentDescription = "Tema $label" },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = label,
                    color = if (isSelected) {
                        if (palette.dark) SignalColors.NavyDark else Color.White
                    } else palette.textSecondary,
                    fontSize = 15.sp,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                )
            }
        }
    }
}

@Composable
private fun SpeedRow(
    palette: SignalPalette,
    speed: Float,
    onDecrease: () -> Unit,
    onIncrease: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text("Velocidad de lectura", color = palette.textPrimary, fontSize = 16.sp)
            Text(
                text = "${"%.1f".format(speed)}x",
                color = palette.textSecondary,
                fontSize = 14.sp,
            )
        }
        StepperButton(palette, "–", "Reducir velocidad de lectura", onDecrease)
        Spacer(Modifier.width(12.dp))
        StepperButton(palette, "+", "Aumentar velocidad de lectura", onIncrease)
    }
}

@Composable
private fun StepperButton(
    palette: SignalPalette,
    symbol: String,
    contentDesc: String,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .size(56.dp)
            .clip(CircleShape)
            .background(palette.accentSoft)
            .border(BorderStroke(1.dp, palette.border), CircleShape)
            .clickable { onClick() }
            .semantics { contentDescription = contentDesc },
        contentAlignment = Alignment.Center,
    ) {
        Text(text = symbol, color = palette.accent, fontSize = 24.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun ToggleRow(
    palette: SignalPalette,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = palette.textPrimary, fontSize = 16.sp)
            Text(subtitle, color = palette.textMuted, fontSize = 13.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = palette.accent,
                uncheckedTrackColor = palette.border,
            ),
            modifier = Modifier.semantics { contentDescription = title },
        )
    }
}

@Composable
private fun ChevronRow(
    palette: SignalPalette,
    title: String,
    value: String,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable { onClick() }
            .semantics { contentDescription = "$title, valor actual $value" },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, color = palette.textPrimary, fontSize = 16.sp, modifier = Modifier.weight(1f))
        Text(value, color = palette.textSecondary, fontSize = 15.sp)
        Spacer(Modifier.width(8.dp))
        Text(text = "›", color = palette.textMuted, fontSize = 22.sp)
    }
}
