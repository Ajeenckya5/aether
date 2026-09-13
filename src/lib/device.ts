import { hasAetherNativeShell, isAetherBandUserAgent } from "./native-ble";

export type BrowserKind =
  | "safari"
  | "chrome"
  | "firefox"
  | "edge"
  | "samsung"
  | "bluefy"
  | "aether"
  | "other";

export type DeviceProbe = {
  bluetooth: boolean;
  geolocation: boolean;
  wakeLock: boolean;
  ios: boolean;
  browser: BrowserKind;
  standalone: boolean;
  coarse: boolean;
  nativeShell: boolean;
};

export function detectBrowser(userAgent: string): BrowserKind {
  const ua = userAgent || "";
  if (isAetherBandUserAgent(ua)) return "aether";
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
  nativeShell?: boolean;
}): DeviceProbe {
  const ua = input.userAgent || "";
  const nativeShell = hasAetherNativeShell({
    nativeShell: input.nativeShell,
    userAgent: ua,
  });
  const android = /Android/i.test(ua);
  const ios =
    !android &&
    (/iP(hone|ad|od)/.test(ua) ||
      (/(Mac OS X)/.test(ua) && input.coarse === true));
  return {
    bluetooth: Boolean(input.bluetooth) || nativeShell,
    geolocation: Boolean(input.geolocation),
    wakeLock: Boolean(input.wakeLock),
    ios,
    browser: detectBrowser(ua),
    standalone: Boolean(input.standalone) || nativeShell,
    coarse: Boolean(input.coarse),
    nativeShell,
  };
}

export function describeHrSupport(
  device: Pick<DeviceProbe, "bluetooth" | "ios" | "browser" | "nativeShell">,
): string {
  if (device.nativeShell || device.browser === "aether") {
    if (!device.ios) {
      return "This Aether Android app pairs your WHOOP with native Bluetooth. Chrome is not the Bluetooth stack. Public Heart Rate service only: live bpm, R-R/HRV, battery if exposed.";
    }
    return "This Aether iPhone app pairs your WHOOP with Core Bluetooth. Safari is not involved. Public Heart Rate service only: live bpm, R-R/HRV, battery if exposed.";
  }
  if (device.ios && device.bluetooth) {
    return "This iPhone browser can pair Bluetooth. Tap Connect WHOOP, pick the band, keep this screen open. Live bpm and R-R/HRV use the public Heart Rate service.";
  }
  if (device.bluetooth) {
    return "Pair your WHOOP or a Polar/Garmin-class strap in this browser (Chrome or Edge on Android or a laptop). Live bpm uses the public Bluetooth Heart Rate service.";
  }
  if (device.ios) {
    return "Safari and Chrome on iPhone cannot pair a WHOOP. Install the Aether iPhone app from GitHub (Xcode on a Mac) so Bluetooth runs in our app, not Safari. Bluefy is the no-Mac fallback. Camera pulse also works.";
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
  return "/download#android-apk";
}

export function whoopGuideHref(
  device: Pick<DeviceProbe, "ios" | "bluetooth" | "nativeShell">,
): string {
  if (device.nativeShell && device.ios) return "/download#ios-native";
  if (device.nativeShell) return "/download#android-apk";
  if (device.ios && !device.bluetooth) return "/download#ios-native";
  return "/download#bluetooth";
}

export function installGuideLabel(
  device: Pick<DeviceProbe, "ios" | "browser">,
): string {
  if (device.ios && device.browser === "chrome") return "Show Chrome iPhone steps";
  if (device.ios) return "Show Safari iPhone steps";
  if (device.browser === "safari") return "Show Android Safari steps";
  return "Show Android APK steps";
}

export function installBannerCopy(
  device: Pick<DeviceProbe, "ios" | "browser">,
): string {
  if (device.ios && device.browser === "chrome") {
    return "Chrome on iPhone: Share (next to the address) → Add to Home Screen, then open the Aether icon. That is the app.";
  }
  if (device.ios) {
    return "Safari on iPhone: Share → Add to Home Screen for the website app. Bluetooth on iPhone needs the Aether iPhone app (Xcode) or Bluefy — Safari cannot pair the band.";
  }
  if (device.browser === "safari") {
    return "Apple does not ship Safari on Android. In this Safari-like browser: menu → Add to Home Screen, then open the Aether icon.";
  }
  return "Install the Aether APK from GitHub (not Play Store) so Bluetooth can stay up overnight. Chrome Install app is the website-only fallback.";
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
      nativeShell: false,
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
    nativeShell: hasAetherNativeShell({ userAgent: navigator.userAgent }),
  });
}
