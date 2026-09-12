import SwiftUI

struct ContentView: View {
  @ObservedObject var ble: HeartRateCentral
  @Environment(\.scenePhase) private var scenePhase

  private var startURL: URL {
    URL(string: "https://ajeenckya5.github.io/aether/")!
  }

  var body: some View {
    WebBleView(ble: ble, startURL: startURL)
      .ignoresSafeArea()
      .sheet(isPresented: $ble.showPicker, onDismiss: { ble.cancelIfPicking() }) {
        DevicePicker(ble: ble)
          .presentationDetents([.medium, .large])
      }
      .onChange(of: scenePhase) { _, phase in
        if phase == .active {
          ble.flushBuffer()
        }
      }
  }
}

struct DevicePicker: View {
  @ObservedObject var ble: HeartRateCentral

  var body: some View {
    NavigationStack {
      List {
        if ble.hits.isEmpty {
          Text("Wear the WHOOP, wake it, and disconnect the official WHOOP app. Scanning for public Heart Rate straps…")
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        ForEach(ble.hits) { hit in
          Button {
            ble.pick(hit)
          } label: {
            VStack(alignment: .leading, spacing: 4) {
              Text(hit.name)
                .foregroundStyle(.primary)
              Text("Bluetooth \(hit.rssi) dBm")
                .font(.caption)
                .foregroundStyle(.secondary)
            }
          }
        }
      }
      .navigationTitle("Connect WHOOP")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { ble.cancelPicker() }
        }
      }
    }
  }
}
