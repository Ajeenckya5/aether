package app.aether.band

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import androidx.core.content.ContextCompat
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

data class ScanHit(val id: String, val name: String, val rssi: Int)

class NativeBleError(val jsName: String, override val message: String) : Exception(message)

class HeartRateCentral(private val context: Context) {
  var onHits: ((List<ScanHit>) -> Unit)? = null
  var onShowPicker: (() -> Unit)? = null
  var onHidePicker: (() -> Unit)? = null
  var onNotify: ((String, ByteArray, Long) -> Unit)? = null
  var onDisconnect: (() -> Unit)? = null
  var onFlush: ((List<Map<String, String>>) -> Unit)? = null
  var onKeepAlive: ((Boolean) -> Unit)? = null

  private val handler = Handler(Looper.getMainLooper())
  private val adapter: BluetoothAdapter? =
    (context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
  private val prefs = context.getSharedPreferences("aether.ble", Context.MODE_PRIVATE)
  private val seen = ConcurrentHashMap<String, BluetoothDevice>()
  private val hits = mutableListOf<ScanHit>()
  private val characteristics = ConcurrentHashMap<String, BluetoothGattCharacteristic>()
  private val services = mutableSetOf<String>()
  private val buffer = mutableListOf<Map<String, String>>()
  private var lastBufferAt = 0L
  private var gatt: BluetoothGatt? = null
  private var scanAll = false
  private var reconnecting = false
  private var pickResume: ((Result<Map<String, String>>) -> Unit)? = null
  private var connectResume: ((Result<Unit>) -> Unit)? = null
  private var readResume: ((Result<String>) -> Unit)? = null
  private var scanning = false

  private var rememberedId: String?
    get() = prefs.getString("peripheral", null)
    set(value) { prefs.edit().putString("peripheral", value).apply() }

  private var rememberedName: String
    get() = prefs.getString("name", "HR strap") ?: "HR strap"
    set(value) { prefs.edit().putString("name", value).apply() }

  fun rememberedDevices(): List<Map<String, String>> {
    val id = rememberedId ?: return emptyList()
    return listOf(mapOf("id" to id, "name" to rememberedName))
  }

  fun enableReconnect() {
    reconnecting = true
  }

  fun flushBuffer() {
    if (buffer.isEmpty()) return
    val copy = buffer.toList()
    buffer.clear()
    onFlush?.invoke(copy)
  }

  @SuppressLint("MissingPermission")
  fun cancelPicker() {
    stopScan()
    onHidePicker?.invoke()
    pickResume?.invoke(Result.failure(NativeBleError("NotFoundError", "Pairing cancelled.")))
    pickResume = null
  }

  fun cancelIfPicking() {
    if (pickResume != null) cancelPicker()
  }

  @SuppressLint("MissingPermission")
  fun pick(hit: ScanHit) {
    stopScan()
    onHidePicker?.invoke()
    rememberedId = hit.id
    rememberedName = hit.name
    pickResume?.invoke(Result.success(mapOf("id" to hit.id, "name" to hit.name)))
    pickResume = null
  }

  fun currentHits(): List<ScanHit> = hits.toList()

  @SuppressLint("MissingPermission")
  fun requestDevice(scanAll: Boolean, done: (Result<Map<String, String>>) -> Unit) {
    if (!hasPermission()) {
      done(Result.failure(NativeBleError("SecurityError", "Allow Bluetooth for Aether in Settings.")))
      return
    }
    val adapter = adapter
    if (adapter == null || !adapter.isEnabled) {
      done(Result.failure(NativeBleError("SecurityError", "Turn on Bluetooth on this phone.")))
      return
    }
    this.scanAll = scanAll
    hits.clear()
    onHits?.invoke(emptyList())
    onShowPicker?.invoke()
    pickResume = done
    val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
    stopScan()
    adapter.bluetoothLeScanner?.startScan(null, settings, scanCallback)
    scanning = true
  }

  @SuppressLint("MissingPermission")
  fun connect(deviceId: String, done: (Result<Unit>) -> Unit) {
    if (!hasPermission()) {
      done(Result.failure(NativeBleError("SecurityError", "Allow Bluetooth for Aether in Settings.")))
      return
    }
    val adapter = adapter ?: run {
      done(Result.failure(NativeBleError("NotFoundError", "No heart-rate strap found.")))
      return
    }
    val device = seen[deviceId] ?: try {
      adapter.getRemoteDevice(deviceId)
    } catch (_: IllegalArgumentException) {
      done(Result.failure(NativeBleError("NotFoundError", "No heart-rate strap found.")))
      return
    }
    characteristics.clear()
    services.clear()
    connectResume = done
    gatt?.close()
    gatt = device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
  }

  @SuppressLint("MissingPermission")
  fun disconnect() {
    reconnecting = false
    onKeepAlive?.invoke(false)
    gatt?.disconnect()
    gatt?.close()
    gatt = null
  }

  fun requireService(uuid: String) {
    if (!services.contains(canonical(uuid))) {
      throw NativeBleError("NetworkError", "That device did not expose $uuid.")
    }
  }

  fun requireCharacteristic(uuid: String) {
    if (characteristic(uuid) == null) {
      throw NativeBleError("NetworkError", "Missing characteristic $uuid.")
    }
  }

  @SuppressLint("MissingPermission")
  fun startNotifications(uuid: String) {
    val gatt = gatt
    val char = characteristic(uuid) ?: throw NativeBleError("NetworkError", "Missing characteristic $uuid.")
    if (gatt == null) throw NativeBleError("NetworkError", "The strap dropped Bluetooth.")
    gatt.setCharacteristicNotification(char, true)
    val cccd = char.getDescriptor(CCCD) ?: return
    if (Build.VERSION.SDK_INT >= 33) {
      gatt.writeDescriptor(cccd, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
    } else {
      @Suppress("DEPRECATION")
      cccd.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
      @Suppress("DEPRECATION")
      gatt.writeDescriptor(cccd)
    }
  }

  @SuppressLint("MissingPermission")
  fun stopNotifications(uuid: String) {
    val gatt = gatt ?: return
    val char = characteristic(uuid) ?: return
    gatt.setCharacteristicNotification(char, false)
  }

  @SuppressLint("MissingPermission")
  fun readValue(uuid: String, done: (Result<String>) -> Unit) {
    val gatt = gatt
    val char = characteristic(uuid)
    if (gatt == null || char == null) {
      done(Result.failure(NativeBleError("NetworkError", "Missing characteristic $uuid.")))
      return
    }
    readResume = done
    gatt.readCharacteristic(char)
  }

  private fun characteristic(uuid: String): BluetoothGattCharacteristic? =
    characteristics[canonical(uuid)]

  private fun hasPermission(): Boolean {
    val connect = if (Build.VERSION.SDK_INT >= 31) {
      ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) ==
        PackageManager.PERMISSION_GRANTED &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) ==
        PackageManager.PERMISSION_GRANTED
    } else {
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    }
    return connect
  }

  @SuppressLint("MissingPermission")
  private fun stopScan() {
    if (!scanning) return
    scanning = false
    try {
      adapter?.bluetoothLeScanner?.stopScan(scanCallback)
    } catch (_: Exception) {
      /* already stopped */
    }
  }

  private val scanCallback = object : ScanCallback() {
    override fun onScanFailed(errorCode: Int) {
      handler.post {
        scanning = false
        onHidePicker?.invoke()
        pickResume?.invoke(Result.failure(NativeBleError("NetworkError", "Bluetooth failed.")))
        pickResume = null
      }
    }

    @SuppressLint("MissingPermission")
    override fun onScanResult(callbackType: Int, result: ScanResult) {
      val device = result.device
      val address = device.address ?: return
      seen[address] = device
      val name = result.scanRecord?.deviceName ?: device.name ?: "Heart rate strap"
      if (!matchesFilter(name)) return
      val hit = ScanHit(address, name, result.rssi)
      handler.post {
        val idx = hits.indexOfFirst { it.id == address }
        if (idx >= 0) hits[idx] = hit else hits.add(hit)
        hits.sortByDescending { it.rssi }
        onHits?.invoke(hits.toList())
      }
    }
  }

  private val gattCallback = object : BluetoothGattCallback() {
    @SuppressLint("MissingPermission")
    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
      handler.post {
        if (newState == BluetoothProfile.STATE_CONNECTED) {
          rememberedId = gatt.device.address
          rememberedName = gatt.device.name?.ifBlank { null } ?: rememberedName
          gatt.discoverServices()
          onKeepAlive?.invoke(true)
        } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
          connectResume?.invoke(Result.failure(NativeBleError("NetworkError", "The strap dropped Bluetooth.")))
          connectResume = null
          onDisconnect?.invoke()
          if (reconnecting) {
            handler.postDelayed({
              val id = rememberedId ?: return@postDelayed
              connect(id) { }
            }, 1500)
          } else {
            onKeepAlive?.invoke(false)
          }
        }
      }
    }

    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
      handler.post {
        if (status != BluetoothGatt.GATT_SUCCESS) {
          connectResume?.invoke(Result.failure(NativeBleError("NetworkError", "The strap dropped Bluetooth.")))
          connectResume = null
          return@post
        }
        for (service in gatt.services) {
          services.add(canonical(service.uuid.toString()))
          for (char in service.characteristics) {
            characteristics[canonical(char.uuid.toString())] = char
          }
        }
        connectResume?.invoke(Result.success(Unit))
        connectResume = null
      }
    }

    @Deprecated("Deprecated in Java")
    override fun onCharacteristicRead(
      gatt: BluetoothGatt,
      characteristic: BluetoothGattCharacteristic,
      status: Int,
    ) {
      val value = characteristic.value ?: ByteArray(0)
      onCharacteristicRead(gatt, characteristic, value, status)
    }

    override fun onCharacteristicRead(
      gatt: BluetoothGatt,
      characteristic: BluetoothGattCharacteristic,
      value: ByteArray,
      status: Int,
    ) {
      handler.post {
        val b64 = Base64.encodeToString(value, Base64.NO_WRAP)
        if (status != BluetoothGatt.GATT_SUCCESS) {
          readResume?.invoke(Result.failure(NativeBleError("NetworkError", "Bluetooth failed.")))
        } else {
          readResume?.invoke(Result.success(b64))
        }
        readResume = null
      }
    }

    @Deprecated("Deprecated in Java")
    override fun onCharacteristicChanged(
      gatt: BluetoothGatt,
      characteristic: BluetoothGattCharacteristic,
    ) {
      onCharacteristicChanged(gatt, characteristic, characteristic.value ?: ByteArray(0))
    }

    override fun onCharacteristicChanged(
      gatt: BluetoothGatt,
      characteristic: BluetoothGattCharacteristic,
      value: ByteArray,
    ) {
      val key = canonical(characteristic.uuid.toString())
      val now = System.currentTimeMillis()
      handler.post {
        onNotify?.invoke(key, value, now)
        if (now - lastBufferAt >= 20_000) {
          lastBufferAt = now
          val b64 = Base64.encodeToString(value, Base64.NO_WRAP)
          buffer.add(mapOf("uuid" to key, "data" to b64, "t" to now.toString()))
          if (buffer.size > 2600) {
            buffer.subList(0, buffer.size - 2600).clear()
          }
        }
      }
    }
  }

  private fun matchesFilter(name: String): Boolean {
    if (scanAll) return true
    val lower = name.lowercase()
    return PREFIXES.any { lower.contains(it) }
  }

  companion object {
    private val CCCD: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    private val PREFIXES = listOf("whoop", "polar", "garmin", "wahoo", "tickr", "hrm", "coospo", "magene", "scosche")

    fun canonical(raw: String): String {
      val value = raw.trim().lowercase()
      val aliases = mapOf(
        "heart_rate" to "180d",
        "heart_rate_measurement" to "2a37",
        "battery_service" to "180f",
        "battery_level" to "2a19",
        "pulse_oximeter" to "1822",
        "plx_continuous_measurement" to "2a5f",
        "plx_spot_check_measurement" to "2a5e",
        "health_thermometer" to "1809",
        "temperature_measurement" to "2a1c",
        "intermediate_temperature" to "2a1e",
      )
      aliases[value]?.let { return it }
      if (value.length == 36) {
        val hex = value.replace("-", "")
        if (hex.startsWith("0000") && hex.endsWith("00001000800000805f9b34fb")) {
          return hex.substring(4, 8)
        }
      }
      return value
    }
  }
}
