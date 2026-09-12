import SwiftUI

@main
struct AetherBandApp: App {
  @StateObject private var ble = HeartRateCentral()

  var body: some Scene {
    WindowGroup {
      ContentView(ble: ble)
        .preferredColorScheme(.dark)
    }
  }
}
