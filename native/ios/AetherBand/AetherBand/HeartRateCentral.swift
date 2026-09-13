import Combine
import CoreBluetooth
import Foundation

struct BleScanHit: Identifiable, Equatable {
  let id: UUID
  var name: String
  var rssi: Int
}

enum NativeBleError: LocalizedError {
  case cancelled
  case poweredOff
  case unauthorized
  case notFound
  case disconnected
  case missingService(String)
  case missingCharacteristic(String)

  var name: String {
    switch self {
    case .cancelled, .notFound: return "NotFoundError"
    case .poweredOff, .unauthorized: return "SecurityError"
    case .disconnected: return "NetworkError"
    case .missingService, .missingCharacteristic: return "NetworkError"
    }
  }

  var errorDescription: String? {
    switch self {
    case .cancelled: return "Pairing cancelled."
    case .poweredOff: return "Turn on Bluetooth on this iPhone."
    case .unauthorized: return "Allow Bluetooth for Aether in Settings."
    case .notFound: return "No heart-rate strap found."
    case .disconnected: return "The strap dropped Bluetooth."
    case .missingService(let uuid):
      return "That device did not expose \(uuid)."
    case .missingCharacteristic(let uuid):
      return "Missing characteristic \(uuid)."
    }
  }
}

final class HeartRateCentral: NSObject, ObservableObject {
  @Published var hits: [BleScanHit] = []
  @Published var showPicker = false
  @Published var statusText = "Ready"

  private var central: CBCentralManager!
  private var peripheral: CBPeripheral?
  private var characteristics: [String: CBCharacteristic] = [:]
  private var services: Set<String> = []
  private var scanAll = false
  private var pickContinuation: CheckedContinuation<[String: String], Error>?
  private var connectContinuation: CheckedContinuation<Void, Error>?
  private var readWaiters: [String: CheckedContinuation<String, Error>] = [:]
  private var readyWaiters: [CheckedContinuation<Void, Error>] = []
  private var rememberedId: UUID? {
    get {
      UserDefaults.standard.string(forKey: "aether.ble.peripheral").flatMap(UUID.init(uuidString:))
    }
    set {
      UserDefaults.standard.set(newValue?.uuidString, forKey: "aether.ble.peripheral")
    }
  }
  private var rememberedName: String {
    get { UserDefaults.standard.string(forKey: "aether.ble.name") ?? "HR strap" }
    set { UserDefaults.standard.set(newValue, forKey: "aether.ble.name") }
  }
  private var seen: [UUID: CBPeripheral] = [:]
  private var reconnecting = false
  var onNotify: ((String, Data) -> Void)?
  var onDisconnect: (() -> Void)?
  var onFlush: (([[String: String]]) -> Void)?
  private var buffer: [[String: String]] = []
  private var lastBufferAt: TimeInterval = 0

  override init() {
    super.init()
    central = CBCentralManager(delegate: self, queue: .main)
  }

  func waitUntilReady() async throws {
    switch central.state {
    case .poweredOn:
      return
    case .poweredOff:
      throw NativeBleError.poweredOff
    case .unauthorized:
      throw NativeBleError.unauthorized
    default:
      try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
        readyWaiters.append(cont)
      }
    }
  }

  func requestDevice(scanAll: Bool) async throws -> [String: String] {
    try await waitUntilReady()
    self.scanAll = scanAll
    hits = []
    showPicker = true
    statusText = "Scanning…"
    central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
    return try await withCheckedThrowingContinuation { cont in
      pickContinuation = cont
    }
  }

  func cancelIfPicking() {
    if pickContinuation != nil {
      cancelPicker()
    }
  }

  func cancelPicker() {
    central.stopScan()
    showPicker = false
    if let pickContinuation {
      self.pickContinuation = nil
      pickContinuation.resume(throwing: NativeBleError.cancelled)
    }
  }

  func pick(_ hit: BleScanHit) {
    central.stopScan()
    showPicker = false
    rememberedId = hit.id
    rememberedName = hit.name
    let info = ["id": hit.id.uuidString, "name": hit.name]
    pickContinuation?.resume(returning: info)
    pickContinuation = nil
  }

  func rememberedDevices() -> [[String: String]] {
    guard let rememberedId else { return [] }
    return [["id": rememberedId.uuidString, "name": rememberedName]]
  }

  func connect(deviceId: String) async throws {
    try await waitUntilReady()
    guard let uuid = UUID(uuidString: deviceId) else { throw NativeBleError.notFound }
    let known = seen[uuid] ?? central.retrievePeripherals(withIdentifiers: [uuid]).first
    guard let target = known else {
      throw NativeBleError.notFound
    }
    characteristics = [:]
    services = []
    peripheral = target
    target.delegate = self
    if target.state == .connected {
      target.discoverServices(nil)
    } else {
      central.connect(target, options: nil)
    }
    try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
      connectContinuation = cont
    }
  }

  func disconnect() {
    reconnecting = false
    if let peripheral {
      central.cancelPeripheralConnection(peripheral)
    }
  }

  func requireService(_ uuid: String) throws {
    let key = Self.canonical(uuid)
    if !services.contains(key) {
      throw NativeBleError.missingService(uuid)
    }
  }

  func requireCharacteristic(_ uuid: String) throws {
    if characteristic(uuid) == nil {
      throw NativeBleError.missingCharacteristic(uuid)
    }
  }

  func startNotifications(_ uuid: String) throws {
    guard let peripheral, let char = characteristic(uuid) else {
      throw NativeBleError.missingCharacteristic(uuid)
    }
    peripheral.setNotifyValue(true, for: char)
  }

  func stopNotifications(_ uuid: String) {
    guard let peripheral, let char = characteristic(uuid) else { return }
    peripheral.setNotifyValue(false, for: char)
  }

  func readValue(_ uuid: String) async throws -> String {
    guard let peripheral, let char = characteristic(uuid) else {
      throw NativeBleError.missingCharacteristic(uuid)
    }
    return try await withCheckedThrowingContinuation { cont in
      readWaiters[Self.canonical(uuid)] = cont
      peripheral.readValue(for: char)
    }
  }

  func flushBuffer() {
    guard !buffer.isEmpty else { return }
    let copy = buffer
    buffer.removeAll()
    onFlush?(copy)
  }

  func enableReconnect() {
    reconnecting = true
  }

  private func characteristic(_ uuid: String) -> CBCharacteristic? {
    characteristics[Self.canonical(uuid)]
  }

  private func finishConnect() {
    connectContinuation?.resume()
    connectContinuation = nil
    statusText = "Connected"
  }

  private func failConnect(_ error: Error) {
    connectContinuation?.resume(throwing: error)
    connectContinuation = nil
  }

  static func canonical(_ raw: String) -> String {
    let value = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let aliases: [String: String] = [
      "heart_rate": "180d",
      "heart_rate_measurement": "2a37",
      "battery_service": "180f",
      "battery_level": "2a19",
      "pulse_oximeter": "1822",
      "plx_continuous_measurement": "2a5f",
      "plx_spot_check_measurement": "2a5e",
      "health_thermometer": "1809",
      "temperature_measurement": "2a1c",
      "intermediate_temperature": "2a1e",
    ]
    if let mapped = aliases[value] { return mapped }
    if value.count == 36 {
      let hex = value.split(separator: "-").joined()
      if hex.hasPrefix("0000") && hex.hasSuffix("00001000800000805f9b34fb") {
        return String(hex.dropFirst(4).prefix(4))
      }
    }
    return value
  }

  private func keepName(_ peripheral: CBPeripheral) -> String {
    peripheral.name?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
      ? peripheral.name!
      : "Heart rate strap"
  }

  private func matchesFilter(_ peripheral: CBPeripheral) -> Bool {
    if scanAll { return true }
    let name = (peripheral.name ?? "").lowercased()
    let prefixes = ["whoop", "polar", "garmin", "wahoo", "tickr", "hrm", "coospo", "magene", "scosche"]
    return prefixes.contains { name.contains($0) }
  }
}

extension HeartRateCentral: CBCentralManagerDelegate {
  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    switch central.state {
    case .poweredOn:
      let waiters = readyWaiters
      readyWaiters.removeAll()
      waiters.forEach { $0.resume() }
      if reconnecting, let rememberedId {
        let known = central.retrievePeripherals(withIdentifiers: [rememberedId])
        if let target = known.first {
          peripheral = target
          target.delegate = self
          central.connect(target, options: nil)
        }
      }
    case .poweredOff:
      failReady(NativeBleError.poweredOff)
    case .unauthorized:
      failReady(NativeBleError.unauthorized)
    default:
      break
    }
  }

  private func failReady(_ error: NativeBleError) {
    let waiters = readyWaiters
    readyWaiters.removeAll()
    waiters.forEach { $0.resume(throwing: error) }
    if let pickContinuation {
      self.pickContinuation = nil
      pickContinuation.resume(throwing: error)
    }
  }

  func centralManager(
    _ central: CBCentralManager,
    didDiscover peripheral: CBPeripheral,
    advertisementData: [String: Any],
    rssi RSSI: NSNumber
  ) {
    seen[peripheral.identifier] = peripheral
    guard matchesFilter(peripheral) else { return }
    let name = (advertisementData[CBAdvertisementDataLocalNameKey] as? String)
      ?? peripheral.name
      ?? "Heart rate strap"
    let hit = BleScanHit(id: peripheral.identifier, name: name, rssi: RSSI.intValue)
    if let idx = hits.firstIndex(where: { $0.id == hit.id }) {
      hits[idx] = hit
    } else {
      hits.append(hit)
      hits.sort { $0.rssi > $1.rssi }
    }
  }

  func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
    rememberedId = peripheral.identifier
    rememberedName = keepName(peripheral)
    peripheral.delegate = self
    peripheral.discoverServices(nil)
  }

  func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
    failConnect(error ?? NativeBleError.disconnected)
    if reconnecting {
      DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
        self?.central.connect(peripheral, options: nil)
      }
    }
  }

  func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
    onDisconnect?()
    if reconnecting {
      statusText = "Reconnecting…"
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
        self?.central.connect(peripheral, options: nil)
      }
    }
  }
}

extension HeartRateCentral: CBPeripheralDelegate {
  func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
    if let error {
      failConnect(error)
      return
    }
    guard let found = peripheral.services, !found.isEmpty else {
      failConnect(NativeBleError.missingService("heart_rate"))
      return
    }
    for service in found {
      services.insert(Self.canonical(service.uuid.uuidString))
      peripheral.discoverCharacteristics(nil, for: service)
    }
  }

  func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    service.characteristics?.forEach { char in
      characteristics[Self.canonical(char.uuid.uuidString)] = char
    }
    let pending = peripheral.services?.contains { $0.characteristics == nil } ?? false
    if !pending {
      finishConnect()
    }
  }

  func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
    let key = Self.canonical(characteristic.uuid.uuidString)
    if let error {
      readWaiters[key]?.resume(throwing: error)
      readWaiters[key] = nil
      return
    }
    let data = characteristic.value ?? Data()
    let b64 = data.base64EncodedString()
    if let waiter = readWaiters[key] {
      readWaiters[key] = nil
      waiter.resume(returning: b64)
    }
    onNotify?(key, data)
    let now = Date().timeIntervalSince1970
    if now - lastBufferAt >= 20 {
      lastBufferAt = now
      let ms = String(Int(now * 1000))
      buffer.append(["uuid": key, "data": b64, "t": ms])
      if buffer.count > 2600 { buffer.removeFirst(buffer.count - 2600) }
    }
  }
}
