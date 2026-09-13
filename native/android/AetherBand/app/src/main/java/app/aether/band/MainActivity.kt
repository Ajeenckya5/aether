package app.aether.band

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ListView
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

class MainActivity : AppCompatActivity() {
  private lateinit var web: WebView
  private lateinit var picker: View
  private lateinit var hitList: ListView
  private lateinit var emptyScan: TextView
  private lateinit var ble: HeartRateCentral
  private lateinit var adapter: ArrayAdapter<ScanHit>
  private var pendingWebPermission: PermissionRequest? = null
  private var permissionDone: ((Boolean) -> Unit)? = null
  private val site = "https://ajeenckya5.github.io/aether/"

  private val permissionLauncher =
    registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
      val ok = result.values.all { it } || neededPermissions().all { granted(it) }
      permissionDone?.invoke(ok)
      permissionDone = null
      val webReq = pendingWebPermission
      if (webReq != null && granted(Manifest.permission.CAMERA)) {
        pendingWebPermission = null
        webReq.grant(webReq.resources)
      }
    }

  @SuppressLint("SetJavaScriptEnabled")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)
    web = findViewById(R.id.web)
    picker = findViewById(R.id.picker)
    hitList = findViewById(R.id.hits)
    emptyScan = findViewById(R.id.empty_scan)
    ble = HeartRateCentral(this)
    adapter =
      object : ArrayAdapter<ScanHit>(this, android.R.layout.simple_list_item_2, android.R.id.text1) {
        override fun getView(position: Int, convertView: android.view.View?, parent: android.view.ViewGroup): android.view.View {
          val view = super.getView(position, convertView, parent)
          val hit = getItem(position) ?: return view
          view.findViewById<TextView>(android.R.id.text1).text = hit.name
          view.findViewById<TextView>(android.R.id.text2).text = "Bluetooth ${hit.rssi} dBm"
          return view
        }
      }
    hitList.adapter = adapter
    hitList.setOnItemClickListener { _, _, position, _ ->
      adapter.getItem(position)?.let { ble.pick(it) }
    }
    findViewById<Button>(R.id.cancel_pick).setOnClickListener { ble.cancelPicker() }

    ble.onShowPicker = { picker.visibility = View.VISIBLE }
    ble.onHidePicker = { picker.visibility = View.GONE }
    ble.onHits = { hits ->
      adapter.clear()
      adapter.addAll(hits)
      emptyScan.visibility = if (hits.isEmpty()) View.VISIBLE else View.GONE
    }
    ble.onKeepAlive = { on ->
      val intent = Intent(this, KeepAliveService::class.java)
      try {
        if (on) ContextCompat.startForegroundService(this, intent) else stopService(intent)
      } catch (_: Exception) {
        /* OEM may block the overnight keep-alive notice */
      }
    }

    val bridge = BleBridge(ble, { web }) { done -> withBlePermission(done) }
    bridge.attach()

    val polyfill = assets.open("WebBluetoothPolyfill.js").bufferedReader().use { it.readText() }
    web.settings.javaScriptEnabled = true
    web.settings.domStorageEnabled = true
    web.settings.cacheMode = WebSettings.LOAD_DEFAULT
    web.settings.mediaPlaybackRequiresUserGesture = false
    web.settings.userAgentString = web.settings.userAgentString + " AetherBand/1"
    web.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
    web.addJavascriptInterface(bridge, "AetherAndroid")
    if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
      WebViewCompat.addDocumentStartJavaScript(web, polyfill, setOf("https://ajeenckya5.github.io"))
    }
    web.webViewClient =
      object : WebViewClient() {
        override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
          if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            web.evaluateJavascript(polyfill, null)
          }
        }

        override fun onPageFinished(view: WebView?, url: String?) {
          ble.flushBuffer()
        }
      }
    web.webChromeClient =
      object : WebChromeClient() {
        override fun onPermissionRequest(request: PermissionRequest) {
          val wantsCamera = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
          if (wantsCamera && !granted(Manifest.permission.CAMERA)) {
            pendingWebPermission = request
            permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA))
            return
          }
          request.grant(request.resources)
        }
      }
    WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
    web.loadUrl(site)

    onBackPressedDispatcher.addCallback(
      this,
      object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
          if (picker.visibility == View.VISIBLE) {
            ble.cancelIfPicking()
            return
          }
          if (web.canGoBack()) web.goBack() else finish()
        }
      },
    )

    withBlePermission { }
  }

  override fun onResume() {
    super.onResume()
    web.onResume()
    ble.flushBuffer()
  }

  override fun onPause() {
    web.onPause()
    super.onPause()
  }

  override fun onDestroy() {
    if (isFinishing) {
      ble.disconnect()
      stopService(Intent(this, KeepAliveService::class.java))
    }
    web.destroy()
    super.onDestroy()
  }

  fun withBlePermission(done: (Boolean) -> Unit) {
    val need = neededPermissions().filter { !granted(it) }
    if (need.isEmpty()) {
      done(true)
      return
    }
    permissionDone = done
    permissionLauncher.launch(need.toTypedArray())
  }

  private fun granted(permission: String): Boolean =
    ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

  private fun neededPermissions(): Array<String> {
    val list = mutableListOf<String>()
    if (Build.VERSION.SDK_INT >= 31) {
      list += Manifest.permission.BLUETOOTH_SCAN
      list += Manifest.permission.BLUETOOTH_CONNECT
    } else {
      list += Manifest.permission.ACCESS_FINE_LOCATION
    }
    if (Build.VERSION.SDK_INT >= 33) list += Manifest.permission.POST_NOTIFICATIONS
    return list.toTypedArray()
  }
}
