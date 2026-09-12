export type BrowserKind =
  | "safari"
  | "chrome"
  | "firefox"
  | "edge"
  | "samsung"
  | "bluefy"
  | "other";

export type DeviceProbe = {
  bluetooth: boolean;
  geolocation: boolean;
  wakeLock: boolean;
  ios: boolean;
  browser: BrowserKind;
  standalone: boolean;
  coarse: boolean;
};

export function detectBrowser(userAgent: string): BrowserKind {
  const ua = userAgent || "";
  if (/Bluefy/i.test(ua)) return "bluefy";
  if (/EdgiOS\/|EdgA\/|Edg\//i.test(ua)) return "edge";
  if (/FxiOS\/|Firefox\//i.test(ua)) return "firefox";
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/CriOS\//i.test(ua)) return "chrome";
  if (/Chrome\//i.test(ua) && !/OPR\//i.test(ua)) return "chrome";
  if (/Safari/i.test(ua)) return "safari";
  return "other";
}

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
    browser: detectBrowser(ua),
    standalone: Boolean(input.standalone),
    coarse: Boolean(input.coarse),
  };
}

export function describeHrSupport(
  device: Pick<DeviceProbe, "bluetooth" | "ios" | "browser">,
): string {
  if (device.ios && device.bluetooth) {
    return "This iPhone browser can pair Bluetooth. Tap Connect WHOOP, pick the band, keep this screen open. Live bpm and R-R/HRV use the public Heart Rate service.";
  }
  if (device.bluetooth) {
    return "Pair your WHOOP or a Polar/Garmin-class strap in this browser (Chrome or Edge on Android or a laptop). Live bpm uses the public Bluetooth Heart Rate service.";
  }
  if (device.ios) {
    return "Safari and Chrome on iPhone cannot pair a WHOOP. Open Aether in Bluefy (free Web BLE browser) to connect the band on this iPhone, or use Camera pulse.";
  }
  if (device.browser === "safari") {
    return "This Android Safari-like browser has no Web Bluetooth. Apple does not ship Safari on Android. Use Chrome or Edge on Android, or Camera pulse.";
  }
  return "This browser has no Web Bluetooth. Use Chrome or Edge on a laptop or Android, Bluefy on iPhone, or Camera pulse.";
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

export function installGuideHref(
  device: Pick<DeviceProbe, "ios" | "browser">,
): string {
  if (device.ios && device.browser === "chrome") return "/download#ios-chrome";
  if (device.ios) return "/download#ios";
  if (device.browser === "safari") return "/download#android-safari";
  return "/download#android";
}

export function whoopGuideHref(
  device: Pick<DeviceProbe, "ios" | "bluetooth">,
): string {
  if (device.ios && !device.bluetooth) return "/download#ios-whoop";
  return "/download#bluetooth";
}

export function installGuideLabel(
  device: Pick<DeviceProbe, "ios" | "browser">,
): string {
  if (device.ios && device.browser === "chrome") return "Show Chrome iPhone steps";
  if (device.ios) return "Show Safari iPhone steps";
  if (device.browser === "safari") return "Show Android Safari steps";
  return "Show Android Chrome steps";
}

export function installBannerCopy(
  device: Pick<DeviceProbe, "ios" | "browser">,
): string {
  if (device.ios && device.browser === "chrome") {
    return "Chrome on iPhone: Share (next to the address) → Add to Home Screen, then open the Aether icon. That is the app.";
  }
  if (device.ios) {
    return "Safari on iPhone: Share → Add to Home Screen, then open the Aether icon. Chrome works the same way. To pair a WHOOP on this iPhone, open Aether in Bluefy.";
  }
  if (device.browser === "safari") {
    return "Apple does not ship Safari on Android. In this Safari-like browser: menu → Add to Home Screen, then open the Aether icon.";
  }
  return "Install Aether on this phone so it opens from the home screen, not a browser tab.";
}

export function readDevice(): DeviceProbe {
  if (typeof navigator === "undefined") {
    return {
      bluetooth: false,
      geolocation: false,
      wakeLock: false,
      ios: false,
      browser: "other",
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
