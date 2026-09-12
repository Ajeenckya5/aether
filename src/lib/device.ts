export type DeviceProbe = {
  bluetooth: boolean;
  geolocation: boolean;
  wakeLock: boolean;
  ios: boolean;
  standalone: boolean;
  coarse: boolean;
};

export function probeNavigator(input: {
  userAgent: string;
  bluetooth?: unknown;
  geolocation?: unknown;
  wakeLock?: unknown;
  standalone?: boolean;
  coarse?: boolean;
}): DeviceProbe {
  const ua = input.userAgent || "";
  const ios = /iP(hone|ad|od)/.test(ua) || (/(Mac OS X)/.test(ua) && input.coarse === true);
  return {
    bluetooth: Boolean(input.bluetooth),
    geolocation: Boolean(input.geolocation),
    wakeLock: Boolean(input.wakeLock),
    ios,
    standalone: Boolean(input.standalone),
    coarse: Boolean(input.coarse),
  };
}

export function describeHrSupport(device: Pick<DeviceProbe, "bluetooth" | "ios">): string {
  if (device.bluetooth) {
    return "Pair a Polar/Garmin-class strap in this browser (laptop Chrome/Edge or Android Chrome). Aether only connects over Bluetooth — not the WHOOP cloud. The WHOOP band is not this GATT profile.";
  }
  if (device.ios) {
    return "iPhone/iPad Safari has no Web Bluetooth. Use Practice pulse here, or pair a strap in Chrome on a laptop or Android. Aether does not use the WHOOP cloud.";
  }
  return "This browser has no Web Bluetooth. Use Chrome or Edge on a laptop or Android, or Practice pulse.";
}

export function gpsLabel(coarse: boolean): string {
  return coarse ? "Phone GPS distance" : "Device GPS distance";
}

/** Installed home-screen app, or a phone — not a laptop dashboard. */
export function preferPhoneShell(
  device: Pick<DeviceProbe, "standalone" | "coarse">,
): boolean {
  return device.standalone || device.coarse;
}

export function readDevice(): DeviceProbe {
  if (typeof navigator === "undefined") {
    return {
      bluetooth: false,
      geolocation: false,
      wakeLock: false,
      ios: false,
      standalone: false,
      coarse: false,
    };
  }
  const nav = navigator as Navigator & {
    bluetooth?: unknown;
    wakeLock?: unknown;
    standalone?: boolean;
  };
  const standalone =
    nav.standalone === true ||
    (typeof window !== "undefined" &&
      window.matchMedia("(display-mode: standalone)").matches);
  const coarse =
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  return probeNavigator({
    userAgent: navigator.userAgent,
    bluetooth: nav.bluetooth,
    geolocation: navigator.geolocation,
    wakeLock: nav.wakeLock,
    standalone,
    coarse,
  });
}
