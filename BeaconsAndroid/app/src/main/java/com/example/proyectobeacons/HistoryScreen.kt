package com.example.proyectobeacons

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun HistoryScreen(
    palette: SignalPalette,
    beaconViewModel: BeaconViewModel
) {
    val history by beaconViewModel.history.collectAsStateWithLifecycle()
    val timeFormatter = SimpleDateFormat("HH:mm", Locale.getDefault())

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(palette.surface)
            .padding(24.dp)
    ) {
        Text(
            text = "Historial de ubicaciones",
            color = palette.textPrimary,
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 24.dp)
        )

        if (history.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Aún no has visitado ninguna ubicación.",
                    color = palette.textSecondary,
                    fontSize = 16.sp
                )
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(history) { location ->
                    HistoryItem(
                        location = location,
                        palette = palette,
                        time = timeFormatter.format(Date(location.timestamp))
                    )
                }
            }
        }
    }
}

@Composable
private fun HistoryItem(
    location: BeaconLocation,
    palette: SignalPalette,
    time: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(palette.card)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = location.locationName,
                color = palette.textPrimary,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = location.zone,
                color = palette.textSecondary,
                fontSize = 14.sp
            )
        }
        Text(
            text = time,
            color = palette.accent,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold
        )
    }
}
