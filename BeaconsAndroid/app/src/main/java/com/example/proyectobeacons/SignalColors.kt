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
 * Calcada del branding del CMS (mismo proyecto, mismo sistema de tokens: ver
 * `cms/src/styles.css`) para que la app y el panel administrativo se sientan
 * parte del mismo producto: azul marca `#004aad`, ciruela `#3d1534` como
 * tinta principal, crema `#f6e0b6` como detalle cálido, sobre un fondo claro
 * cálido en vez de blanco/azulado puro. Pensada para alto contraste; cada
 * color tiene su variante para tema claro y oscuro, y las pantallas eligen
 * una u otra según [SignalTheme].
 */
object SignalColors {
    /** Tinta oscura para texto sobre fondos de acento claro (botones, chips). */
    val NavyDark     = Color(0xFF150C14)
    /** `--marca-azul` / `--primary` del CMS. */
    val Blue         = Color(0xFF004AAD)
    /** `--titulo` en tema oscuro del CMS: azul claro para acentos sobre fondo oscuro. */
    val BlueLight    = Color(0xFF9DC2F7)
    /** Azul de marca al 8% sobre blanco, igual que `--primary-suave` del CMS. */
    val BluePale     = Color(0xFFEBF1F8)
    /** `--borde` (claro) del CMS: borde cálido, no azul. */
    val BlueBorder   = Color(0xFFECDCC4)
    /** `--bg` (claro) del CMS. */
    val SurfaceLight = Color(0xFFFFF4EB)
    val CardLight    = Color(0xFFFFFFFF)
    val CardActive   = Color(0xFFEBF1F8)
    /** `--bg` (oscuro) del CMS. */
    val SurfaceDark  = Color(0xFF150C14)
    /** `--panel` (oscuro) del CMS. */
    val CardDark     = Color(0xFF221521)
    /** `--primary-suave` (oscuro) sobre `--panel` (oscuro) del CMS. */
    val CardActiveDk = Color(0xFF2E2A3E)
    /** `--borde` (oscuro) del CMS. */
    val BorderDark   = Color(0xFF3D2A39)
    /** `--text` (claro) del CMS: ciruela, no navy. */
    val TextPrimaryL   = Color(0xFF3D1534)
    /** `--text-2` (claro) del CMS. */
    val TextSecondaryL = Color(0xFF6B4F63)
    /** `--muted` (claro) del CMS. */
    val TextMutedL     = Color(0xFF8A7D84)
    /** `--text` (oscuro) del CMS: crema, no blanco azulado. */
    val TextPrimaryD   = Color(0xFFF2E6DC)
    /** `--text-2` (oscuro) del CMS. */
    val TextSecondaryD = Color(0xFFD3C1CC)
    /** `--muted` (oscuro) del CMS. */
    val TextMutedD     = Color(0xFFA6919E)
    /** `--side-bg` (oscuro) del CMS. */
    val TabBarDark   = Color(0xFF100910)
    /** `--side-muted` (oscuro) del CMS. */
    val TabInactive  = Color(0xFFA6919E)
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
            error = Color(0xFFF0796A), // --peligro (oscuro) del CMS
        )
    } else {
        lightColorScheme(
            primary = SignalColors.Blue,
            onPrimary = Color.White,
            background = SignalColors.SurfaceLight,
            onBackground = SignalColors.TextPrimaryL,
            surface = SignalColors.CardLight,
            onSurface = SignalColors.TextPrimaryL,
            error = Color(0xFFC0392B), // --peligro (claro) del CMS
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
