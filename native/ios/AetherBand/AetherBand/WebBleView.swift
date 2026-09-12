import SwiftUI
import WebKit

final class BleBridgeController: NSObject, WKScriptMessageHandler {
  let ble: HeartRateCentral
  weak var webView: WKWebView?

  init(ble: HeartRateCentral) {
    self.ble = ble
    super.init()
    ble.onNotify = { [weak self] uuid, data in
      self?.emit("notify", ["uuid": uuid, "data": data.base64EncodedString()])
    }
    ble.onDisconnect = { [weak self] in
      self?.emit("disconnected", [:])
    }
    ble.onFlush = { [weak self] packets in
      self?.call("window.__aetherBleFlush(\(Self.json(packets)))")
    }
  }

  func userContentController(
    _ userContentController: WKUserContentController,
    didReceive message: WKScriptMessage
  ) {
    guard
      let body = message.body as? [String: Any],
      let id = body["id"] as? String,
      let method = body["method"] as? String
    else { return }
    let payload = body["payload"] as? [String: Any] ?? [:]
    Task { @MainActor in
      await self.handle(id: id, method: method, payload: payload)
    }
  }

  @MainActor
  private func handle(id: String, method: String, payload: [String: Any]) async {
    do {
      switch method {
      case "bridgeReady":
        ble.flushBuffer()
        reply(id, ok: true, value: true)
      case "getDevices":
        reply(id, ok: true, value: ble.rememberedDevices())
      case "requestDevice":
        ble.enableReconnect()
        let scanAll = payload["acceptAllDevices"] as? Bool ?? false
        let info = try await ble.requestDevice(scanAll: scanAll)
        reply(id, ok: true, value: info)
      case "connect":
        ble.enableReconnect()
        let deviceId = payload["deviceId"] as? String ?? ""
        try await ble.connect(deviceId: deviceId)
        reply(id, ok: true, value: true)
      case "disconnect":
        ble.disconnect()
        reply(id, ok: true, value: true)
      case "getPrimaryService":
        let uuid = payload["uuid"] as? String ?? ""
        try ble.requireService(uuid)
        reply(id, ok: true, value: uuid)
      case "getCharacteristic":
        let uuid = payload["uuid"] as? String ?? ""
        try ble.requireCharacteristic(uuid)
        reply(id, ok: true, value: uuid)
      case "startNotifications":
        let uuid = payload["uuid"] as? String ?? ""
        try ble.startNotifications(uuid)
        reply(id, ok: true, value: true)
      case "stopNotifications":
        ble.stopNotifications(payload["uuid"] as? String ?? "")
        reply(id, ok: true, value: true)
      case "readValue":
        let uuid = payload["uuid"] as? String ?? ""
        let b64 = try await ble.readValue(uuid)
        reply(id, ok: true, value: b64)
      case "watchAdvertisements":
        reply(id, ok: true, value: true)
      default:
        fail(id, NativeBleError.notFound)
      }
    } catch let error as NativeBleError {
      fail(id, error)
    } catch {
      fail(id, NativeBleError.disconnected)
    }
  }

  private func reply(_ id: String, ok: Bool, value: Any) {
    let payload = Self.json(value)
    call("window.__aetherBleReply(\(Self.json(id)), \(ok ? "true" : "false"), \(payload), null, null)")
  }

  private func fail(_ id: String, _ error: NativeBleError) {
    call(
      "window.__aetherBleReply(\(Self.json(id)), false, null, \(Self.json(error.name)), \(Self.json(error.localizedDescription)))"
    )
  }

  private func emit(_ type: String, _ detail: [String: String]) {
    call("window.__aetherBleEvent(\(Self.json(type)), \(Self.json(detail)))")
  }

  private func call(_ js: String) {
    webView?.evaluateJavaScript(js, completionHandler: nil)
  }

  private static func json(_ value: Any) -> String {
    if value is NSNull { return "null" }
    if let flag = value as? Bool { return flag ? "true" : "false" }
    if let text = value as? String { return stringify(text) }
    if JSONSerialization.isValidJSONObject(value),
       let data = try? JSONSerialization.data(withJSONObject: value),
       let encoded = String(data: data, encoding: .utf8)
    {
      return encoded
    }
    return "null"
  }

  private static func stringify(_ text: String) -> String {
    let data = try! JSONSerialization.data(withJSONObject: [text])
    let wrapped = String(data: data, encoding: .utf8)!
    return String(wrapped.dropFirst().dropLast())
  }
}

struct WebBleView: UIViewRepresentable {
  @ObservedObject var ble: HeartRateCentral
  let startURL: URL

  func makeCoordinator() -> BleBridgeController {
    BleBridgeController(ble: ble)
  }

  func makeUIView(context: Context) -> WKWebView {
    let user = WKUserContentController()
    if let polyfill = Bundle.main.url(forResource: "WebBluetoothPolyfill", withExtension: "js"),
       let source = try? String(contentsOf: polyfill, encoding: .utf8)
    {
      user.addUserScript(
        WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
      )
    }
    user.add(context.coordinator, name: "aetherBle")
    let config = WKWebViewConfiguration()
    config.userContentController = user
    config.applicationNameForUserAgent = "AetherBand/1"
    config.allowsInlineMediaPlayback = true
    config.mediaTypesRequiringUserActionForPlayback = []
    let view = WKWebView(frame: .zero, configuration: config)
    view.scrollView.contentInsetAdjustmentBehavior = .never
    view.allowsBackForwardNavigationGestures = true
    if #available(iOS 16.4, *) {
      view.isInspectable = true
    }
    context.coordinator.webView = view
    view.load(URLRequest(url: startURL))
    return view
  }

  func updateUIView(_ uiView: WKWebView, context: Context) {
    context.coordinator.webView = uiView
  }
}
