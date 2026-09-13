package app.aether.band

import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject

class BleBridge(
  private val ble: HeartRateCentral,
  private val webView: () -> WebView?,
  private val ensureBle: (done: (Boolean) -> Unit) -> Unit,
) {
  fun attach() {
    ble.onNotify = { uuid, data, at ->
      emit(
        "notify",
        mapOf(
          "uuid" to uuid,
          "data" to Base64.encodeToString(data, Base64.NO_WRAP),
          "t" to at.toString(),
        ),
      )
    }
    ble.onDisconnect = { emit("disconnected", emptyMap()) }
    ble.onFlush = { packets ->
      val arr = JSONArray()
      packets.forEach { packet ->
        val obj = JSONObject()
        packet.forEach { (k, v) -> obj.put(k, v) }
        arr.put(obj)
      }
      eval("window.__aetherBleFlush($arr)")
    }
  }

  @JavascriptInterface
  fun postMessage(raw: String) {
    val body = JSONObject(raw)
    val id = body.getString("id")
    val method = body.getString("method")
    val payload = body.optJSONObject("payload") ?: JSONObject()
    webView()?.post { handle(id, method, payload) }
  }

  private fun handle(id: String, method: String, payload: JSONObject) {
    try {
      when (method) {
        "bridgeReady" -> {
          ble.flushBuffer()
          reply(id, true)
        }
        "getDevices" -> reply(id, ble.rememberedDevices())
        "requestDevice" -> {
          ensureBle { ok ->
            if (!ok) {
              fail(id, NativeBleError("SecurityError", "Allow Bluetooth for Aether in Settings."))
              return@ensureBle
            }
            ble.enableReconnect()
            val scanAll = payload.optBoolean("acceptAllDevices", false)
            ble.requestDevice(scanAll) { result ->
              result.fold(
                onSuccess = { reply(id, it) },
                onFailure = { fail(id, it) },
              )
            }
          }
        }
        "connect" -> {
          ensureBle { ok ->
            if (!ok) {
              fail(id, NativeBleError("SecurityError", "Allow Bluetooth for Aether in Settings."))
              return@ensureBle
            }
            ble.enableReconnect()
            ble.connect(payload.optString("deviceId")) { result ->
              result.fold(
                onSuccess = { reply(id, true) },
                onFailure = { fail(id, it) },
              )
            }
          }
        }
        "disconnect" -> {
          ble.disconnect()
          reply(id, true)
        }
        "getPrimaryService" -> {
          ble.requireService(payload.optString("uuid"))
          reply(id, payload.optString("uuid"))
        }
        "getCharacteristic" -> {
          ble.requireCharacteristic(payload.optString("uuid"))
          reply(id, payload.optString("uuid"))
        }
        "startNotifications" -> {
          ble.startNotifications(payload.optString("uuid"))
          reply(id, true)
        }
        "stopNotifications" -> {
          ble.stopNotifications(payload.optString("uuid"))
          reply(id, true)
        }
        "readValue" -> {
          ble.readValue(payload.optString("uuid")) { result ->
            result.fold(
              onSuccess = { reply(id, it) },
              onFailure = { fail(id, it) },
            )
          }
        }
        "watchAdvertisements" -> reply(id, true)
        else -> fail(id, NativeBleError("NotFoundError", "No heart-rate strap found."))
      }
    } catch (err: Throwable) {
      fail(id, err)
    }
  }

  private fun reply(id: String, value: Any?) {
    eval(
      "window.__aetherBleReply(${JSONObject.quote(id)}, true, ${toJs(value)}, null, null)",
    )
  }

  private fun fail(id: String, err: Throwable) {
    val name = if (err is NativeBleError) err.jsName else "NetworkError"
    val message = err.message ?: "Bluetooth failed."
    eval(
      "window.__aetherBleReply(${JSONObject.quote(id)}, false, null, ${JSONObject.quote(name)}, ${JSONObject.quote(message)})",
    )
  }

  private fun emit(type: String, detail: Map<String, String>) {
    val obj = JSONObject()
    detail.forEach { (k, v) -> obj.put(k, v) }
    eval("window.__aetherBleEvent(${JSONObject.quote(type)}, $obj)")
  }

  private fun eval(js: String) {
    webView()?.evaluateJavascript(js, null)
  }

  private fun toJs(value: Any?): String {
    if (value == null) return "null"
    if (value is Boolean) return if (value) "true" else "false"
    if (value is String) return JSONObject.quote(value)
    if (value is Number) return value.toString()
    if (value is List<*>) {
      val arr = JSONArray()
      value.forEach { item ->
        if (item is Map<*, *>) {
          val obj = JSONObject()
          item.forEach { (k, v) -> obj.put(k.toString(), v) }
          arr.put(obj)
        } else {
          arr.put(item)
        }
      }
      return arr.toString()
    }
    if (value is Map<*, *>) {
      val obj = JSONObject()
      value.forEach { (k, v) -> obj.put(k.toString(), v) }
      return obj.toString()
    }
    return "null"
  }
}
