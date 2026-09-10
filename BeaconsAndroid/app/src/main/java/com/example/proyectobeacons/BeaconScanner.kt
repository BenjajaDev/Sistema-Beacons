package com.example.proyectobeacons

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.*
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.ContextCompat

enum class BeaconType { IBEACON, ALTBEACON, EDDYSTONE, UNKNOWN }

data class BeaconAdvertisement(
    val type: BeaconType,
    val major: Int? = null,
    val minor: Int? = null,
    val uuid: String? = null,
    val rssi: Int,
    /** Potencia calibrada a 1 m que anuncia el propio beacon (dBm). */
    val txPower: Int
)

class BeaconScanner(
    private val context: Context, 
    private val onDetected: (BeaconAdvertisement) -> Unit
) {
    private val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    private var isScanning = false

    private val scanCallback = object : ScanCallback() {
        @SuppressLint("MissingPermission")
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val record = result.scanRecord?.bytes ?: return
            
            // Intenta extraer el nombre del dispositivo para depuración
            val hasConnectPermission = ContextCompat.checkSelfPermission(context, android.Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
            val deviceName = if (hasConnectPermission) result.device.name ?: "N/A" else "Sin Permiso"
            
            parseBeacon(record, result.rssi)?.let {
                Log.i("SIGNAL_FOUND", "!!! Beacon detectado: ${it.type} M:${it.major} m:${it.minor} RSSI:${it.rssi}dBm Tx:${it.txPower}dBm ($deviceName)")
                onDetected(it)
            }
        }
        
        override fun onBatchScanResults(results: List<ScanResult>) {
            results.forEach { onScanResult(ScanSettings.CALLBACK_TYPE_ALL_MATCHES, it) }
        }

        override fun onScanFailed(errorCode: Int) {
            val errorMsg = when(errorCode) {
                SCAN_FAILED_ALREADY_STARTED -> "Escaneo ya iniciado"
                SCAN_FAILED_APPLICATION_REGISTRATION_FAILED -> "Fallo registro app"
                SCAN_FAILED_INTERNAL_ERROR -> "Error interno"
                SCAN_FAILED_FEATURE_UNSUPPORTED -> "No soportado"
                else -> "Código $errorCode"
            }
            Log.e("SIGNAL_SCAN", "Error de escaneo BLE: $errorMsg")
        }
    }

    @SuppressLint("MissingPermission")
    fun start() {
        val adapter = bluetoothManager.adapter
        if (adapter == null || !adapter.isEnabled) {
            Log.e("SIGNAL_SCAN", "Bluetooth desactivado o no disponible. Por favor enciéndelo.")
            return
        }

        val scanner = adapter.bluetoothLeScanner
        if (scanner == null) {
            Log.e("SIGNAL_SCAN", "Scanner nulo. Reiniciando Bluetooth podría ayudar.")
            return
        }

        if (isScanning) {
            Log.d("SIGNAL_SCAN", "El escaneo ya estaba en curso.")
            return
        }

        // Cuantas más muestras por segundo, mejor filtra el promedio de RSSI y
        // más estable queda la distancia (clave para el umbral de 0,5 m).
        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .setReportDelay(0)
            .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
            .setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
            .setNumOfMatches(ScanSettings.MATCH_NUM_MAX_ADVERTISEMENT)
            .build()
        
        // Lista de filtros vacía (recibe todo)
        val filters = mutableListOf<ScanFilter>()

        try {
            scanner.startScan(filters, settings, scanCallback)
            isScanning = true
            Log.d("SIGNAL_SCAN", "Escaneo BLE iniciado exitosamente (Modo: Low Latency)")
        } catch (e: Exception) {
            Log.e("SIGNAL_SCAN", "Excepción al iniciar escaneo", e)
        }
    }

    @SuppressLint("MissingPermission")
    fun stop() {
        if (!isScanning) return
        try {
            bluetoothManager.adapter?.bluetoothLeScanner?.stopScan(scanCallback)
            isScanning = false
            Log.d("SIGNAL_SCAN", "Escaneo BLE detenido")
        } catch (e: Exception) {
            Log.e("SIGNAL_SCAN", "Error al detener escaneo", e)
        }
    }

    private fun parseBeacon(data: ByteArray, rssi: Int): BeaconAdvertisement? {
        var i = 0
        while (i < data.size) {
            val len = data[i].toInt() and 0xFF
            if (len == 0) break
            if (i + len >= data.size) break
            
            val type = data[i + 1].toInt() and 0xFF
            
            if (type == 0xFF && len >= 25) {
                val companyId = ((data[i + 3].toInt() and 0xFF) shl 8) or (data[i + 2].toInt() and 0xFF)
                
                // iBeacon prefix: 0x0215
                if (companyId == 0x004C && 
                    (data[i + 4].toInt() and 0xFF) == 0x02 && 
                    (data[i + 5].toInt() and 0xFF) == 0x15) {
                    
                    val uuid = buildUuid(data, i + 6)
                    val major = ((data[i + 22].toInt() and 0xFF) shl 8) or (data[i + 23].toInt() and 0xFF)
                    val minor = ((data[i + 24].toInt() and 0xFF) shl 8) or (data[i + 25].toInt() and 0xFF)
                    // txPower es un entero con signo (dBm medidos a 1 m).
                    val txPower = data[i + 26].toInt()

                    return BeaconAdvertisement(
                        type = BeaconType.IBEACON,
                        major = major,
                        minor = minor,
                        uuid = uuid,
                        rssi = rssi,
                        txPower = txPower
                    )
                }
            }
            i += len + 1
        }
        return null
    }

    /** Reconstruye el UUID de 16 bytes del iBeacon a partir de [offset]. */
    private fun buildUuid(data: ByteArray, offset: Int): String? {
        if (offset + 16 > data.size) return null
        val sb = StringBuilder(36)
        for (b in 0 until 16) {
            if (b == 4 || b == 6 || b == 8 || b == 10) sb.append('-')
            sb.append("%02x".format(data[offset + b].toInt() and 0xFF))
        }
        return sb.toString()
    }
}
