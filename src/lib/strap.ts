export function strapTip(device: {
  ios: boolean;
  bluetooth: boolean;
  nativeShell: boolean;
}): string {
  if (device.nativeShell) {
    return "Tap Pair and choose your strap. Leave the app open overnight if you want the night scored from that heart rate.";
  }
  if (device.ios && !device.bluetooth) {
    return "This iPhone browser cannot pair a strap. Install the Aether iPhone app, or open this page in Bluefy.";
  }
  if (device.bluetooth) {
    return "Tap Pair and choose your strap. Leave this page open to keep the live reading.";
  }
  return "This browser cannot pair a strap. Use Chrome or Edge, or install the phone app.";
}

export function installRowLabel(device: { ios: boolean; coarse: boolean; browser: string }): string {
  if (device.ios || device.browser === "safari") return "Add to your home screen";
  if (device.coarse) return "Install on this phone";
  return "Install on this computer";
}
