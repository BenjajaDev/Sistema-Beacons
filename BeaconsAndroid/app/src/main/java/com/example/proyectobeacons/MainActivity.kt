package com.example.proyectobeacons

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

class MainActivity : ComponentActivity() {

    private val requiredPermissions: Array<String> = buildList {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            add(Manifest.permission.BLUETOOTH_SCAN)
            add(Manifest.permission.BLUETOOTH_CONNECT)
        }
        add(Manifest.permission.ACCESS_FINE_LOCATION)
        add(Manifest.permission.ACCESS_COARSE_LOCATION)
    }.toTypedArray()

    private val permissionsGranted = mutableStateOf(false)

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        permissionsGranted.value = results.values.all { it } && hasAllPermissions()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        permissionsGranted.value = hasAllPermissions()

        setContent {
            val themeViewModel: ThemeViewModel = viewModel()
            val beaconViewModel: BeaconViewModel = viewModel()
            val settingsViewModel: SettingsViewModel = viewModel()

            val themeMode by themeViewModel.themeMode.collectAsStateWithLifecycle()
            val systemDark = isSystemInDarkTheme()
            val darkTheme = when (themeMode) {
                ThemeMode.LIGHT -> false
                ThemeMode.DARK -> true
                ThemeMode.SYSTEM -> systemDark
            }

            val granted by permissionsGranted

            SignalTheme(darkTheme = darkTheme) {
                if (granted) {
                    SignalApp(
                        beaconViewModel = beaconViewModel,
                        themeViewModel = themeViewModel,
                        settingsViewModel = settingsViewModel,
                    )
                } else {
                    PermissionRationale(onRequestPermissions = { permissionLauncher.launch(requiredPermissions) })
                }
            }
        }

        if (!permissionsGranted.value) {
            permissionLauncher.launch(requiredPermissions)
        }
    }

    override fun onResume() {
        super.onResume()
        if (!permissionsGranted.value && hasAllPermissions()) {
            permissionsGranted.value = true
        }
        
        val lm = getSystemService(Context.LOCATION_SERVICE) as android.location.LocationManager
        val gpsEnabled = lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)
        val networkEnabled = lm.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER)
        
        if (!gpsEnabled && !networkEnabled) {
            android.util.Log.e("SIGNAL_PERM", "¡ADVERTENCIA! GPS desactivado.")
        }
    }

    private fun hasAllPermissions(): Boolean = requiredPermissions.all { permission ->
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    }
}

@Composable
private fun PermissionRationale(onRequestPermissions: () -> Unit) {
    val palette = LocalSignalPalette.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.surface)
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "SIGNAL necesita permisos",
            color = palette.textPrimary,
            fontSize = 24.sp,
            textAlign = TextAlign.Center,
        )
        Text(
            text = "Para detectar los beacons cercanos y leerte tu ubicación en voz alta, SIGNAL necesita acceso a Bluetooth y a la ubicación.",
            color = palette.textSecondary,
            fontSize = 17.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )

        Button(
            onClick = onRequestPermissions,
            colors = ButtonDefaults.buttonColors(containerColor = palette.accent),
            modifier = Modifier.padding(top = 24.dp),
        ) {
            Text(text = "Solicitar permisos", fontWeight = FontWeight.SemiBold)
        }
    }
}

private enum class SignalTab(val title: String, val glyph: String) {
    INICIO("Inicio", "⌂"),
    HISTORIAL("Historial", "≡"),
    AJUSTES("Ajustes", "⚙"),
}

@Composable
private fun SignalApp(
    beaconViewModel: BeaconViewModel,
    themeViewModel: ThemeViewModel,
    settingsViewModel: SettingsViewModel,
) {
    val palette = LocalSignalPalette.current
    val context = LocalContext.current
    var selectedTab by remember { mutableStateOf(SignalTab.INICIO) }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        beaconViewModel.startScanning(context)
    }

    Scaffold(
        containerColor = palette.surface,
        bottomBar = {
            NavigationBar(containerColor = palette.tabBar) {
                SignalTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab },
                        icon = { Text(tab.glyph, fontSize = 20.sp) },
                        label = { Text(tab.title, fontSize = 12.sp) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = palette.accent,
                            selectedTextColor = palette.accent,
                            unselectedIconColor = palette.tabInactive,
                            unselectedTextColor = palette.tabInactive,
                            indicatorColor = palette.accentSoft,
                        ),
                        modifier = Modifier.semantics { contentDescription = tab.title },
                    )
                }
            }
        },
    ) { innerPadding ->
        Box(modifier = Modifier.padding(innerPadding)) {
            when (selectedTab) {
                SignalTab.INICIO -> HomeScreen(
                    beaconViewModel = beaconViewModel,
                    settingsViewModel = settingsViewModel,
                )
                SignalTab.HISTORIAL -> HistoryScreen(
                    palette = palette,
                    beaconViewModel = beaconViewModel,
                )
                SignalTab.AJUSTES -> SettingsScreen(
                    themeViewModel = themeViewModel,
                    settingsViewModel = settingsViewModel,
                )
            }
        }
    }
}
