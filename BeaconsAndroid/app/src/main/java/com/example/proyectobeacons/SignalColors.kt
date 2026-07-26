package com.example.proyectobeacons

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * Paleta de colores de SIGNAL.
 *
 * Pensada para alto contraste. Cada color tiene su variante para tema claro y
 * oscuro. Las pantallas eligen una u otra según [SignalTheme].
 */
object SignalColors {
    val NavyDark     = Color(0xFF0D1B3E)
    val Blue         = Color(0xFF1A56DB)
    val BlueLight    = Color(0xFF5B8EFF)
    val BluePale     = Color(0xFFEEF3FF)
    val BlueBorder   = Color(0xFFC0D0F5)
    val SurfaceLight = Color(0xFFF5F7FF)
    val CardLight    = Color(0xFFFFFFFF)
    val CardActive   = Color(0xFFEEF3FF)
    val SurfaceDark  = Color(0xFF0D1B3E)
    val CardDark     = Color(0xFF152044)
    val CardActiveDk = Color(0xFF0E1E4A)
    val BorderDark   = Color(0xFF1E2E5A)
    val TextPrimaryL   = Color(0xFF0D1B3E)
    val TextSecondaryL = Color(0xFF4A5A8A)
    val TextMutedL     = Color(0xFF8A98C0)
    val TextPrimaryD   = Color(0xFFE8EEFF)
    val TextSecondaryD = Color(0xFF7A8FC0)
    val TextMutedD     = Color(0xFF3A4870)
    val TabBarDark   = Color(0xFF0A1228)
    val TabInactive  = Color(0xFF3A4870)
}

/**
 * Conjunto de colores ya resueltos para el tema activo (claro u oscuro).
 * Las pantallas lo obtienen con [LocalSignalPalette] para no repetir el
 * `if (dark) ... else ...` en cada composable.
 */
data class SignalPalette(
    val dark: Boolean,
    val surface: Color,
    val card: Color,
    val cardActive: Color,
    val border: Color,
    val accent: Color,
    val accentSoft: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val tabBar: Color,
    val tabInactive: Color,
)

private val LightPalette = SignalPalette(
    dark = false,
    surface = SignalColors.SurfaceLight,
    card = SignalColors.CardLight,
    cardActive = SignalColors.CardActive,
    border = SignalColors.BlueBorder,
    accent = SignalColors.Blue,
    accentSoft = SignalColors.BluePale,
    textPrimary = SignalColors.TextPrimaryL,
    textSecondary = SignalColors.TextSecondaryL,
    textMuted = SignalColors.TextMutedL,
    tabBar = SignalColors.CardLight,
    tabInactive = SignalColors.TextMutedL,
)

private val DarkPalette = SignalPalette(
    dark = true,
    surface = SignalColors.SurfaceDark,
    card = SignalColors.CardDark,
    cardActive = SignalColors.CardActiveDk,
    border = SignalColors.BorderDark,
    accent = SignalColors.BlueLight,
    accentSoft = SignalColors.CardActiveDk,
    textPrimary = SignalColors.TextPrimaryD,
    textSecondary = SignalColors.TextSecondaryD,
    textMuted = SignalColors.TextMutedD,
    tabBar = SignalColors.TabBarDark,
    tabInactive = SignalColors.TabInactive,
)

val LocalSignalPalette = androidx.compose.runtime.staticCompositionLocalOf { LightPalette }

private val SignalTypography = Typography()

@Composable
fun SignalTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val palette = if (darkTheme) DarkPalette else LightPalette

    val colorScheme = if (darkTheme) {
        darkColorScheme(
            primary = SignalColors.BlueLight,
            onPrimary = SignalColors.NavyDark,
            background = SignalColors.SurfaceDark,
            onBackground = SignalColors.TextPrimaryD,
            surface = SignalColors.CardDark,
            onSurface = SignalColors.TextPrimaryD,
            error = Color(0xFFFF6B6B),
        )
    } else {
        lightColorScheme(
            primary = SignalColors.Blue,
            onPrimary = Color.White,
            background = SignalColors.SurfaceLight,
            onBackground = SignalColors.TextPrimaryL,
            surface = SignalColors.CardLight,
            onSurface = SignalColors.TextPrimaryL,
            error = Color(0xFFD32F2F),
        )
    }

    androidx.compose.runtime.CompositionLocalProvider(LocalSignalPalette provides palette) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = SignalTypography,
            content = content
        )
    }
}
