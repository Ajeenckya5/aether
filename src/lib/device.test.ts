import { describe, expect, it } from "vitest";
import {
  describeHrSupport,
  detectBrowser,
  gpsLabel,
  installBannerCopy,
  installGuideHref,
  installGuideLabel,
  preferPhoneShell,
  probeNavigator,
} from "./device";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const ANDROID_SAFARI_LIKE =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("device copy for phone and laptop", () => {
  it("tells iPhone Safari and Chrome users to open Bluefy for the WHOOP", () => {
    const ios = probeNavigator({
      userAgent: IPHONE_SAFARI,
      bluetooth: undefined,
      geolocation: {},
    });
    expect(ios.ios).toBe(true);
    expect(ios.browser).toBe("safari");
    expect(ios.bluetooth).toBe(false);
    expect(describeHrSupport(ios)).toMatch(/Bluefy/);
  });

  it("detects Chrome on iPhone and points install at Chrome Share", () => {
    expect(detectBrowser(IPHONE_CHROME)).toBe("chrome");
    const chromeIos = probeNavigator({ userAgent: IPHONE_CHROME });
    expect(chromeIos.ios).toBe(true);
    expect(chromeIos.browser).toBe("chrome");
    expect(installGuideHref(chromeIos)).toBe("/download#ios-chrome");
    expect(installGuideLabel(chromeIos)).toMatch(/Chrome iPhone/);
    expect(installBannerCopy(chromeIos)).toMatch(/Chrome on iPhone/);
    expect(describeHrSupport(chromeIos)).toMatch(/Bluefy/);
  });

  it("treats a Safari-like Android UA as Android Safari, not iPhone", () => {
    expect(detectBrowser(ANDROID_SAFARI_LIKE)).toBe("safari");
    const androidSafari = probeNavigator({
      userAgent: ANDROID_SAFARI_LIKE,
      coarse: true,
    });
    expect(androidSafari.ios).toBe(false);
    expect(androidSafari.browser).toBe("safari");
    expect(installGuideHref(androidSafari)).toBe("/download#android-safari");
    expect(installBannerCopy(androidSafari)).toMatch(/does not ship Safari on Android/);
    expect(describeHrSupport(androidSafari)).toMatch(/Safari-like/);
  });

  it("keeps Android Chrome on the Install app path", () => {
    expect(detectBrowser(ANDROID_CHROME)).toBe("chrome");
    const android = probeNavigator({ userAgent: ANDROID_CHROME, bluetooth: {} });
    expect(android.ios).toBe(false);
    expect(installGuideHref(android)).toBe("/download#android");
    expect(describeHrSupport(android)).toMatch(/Chrome or Edge on Android/);
  });

  it("lets Bluefy on iPhone pair like Chrome on Android", () => {
    const bluefy = probeNavigator({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Bluefy/1.1",
      bluetooth: {},
      coarse: true,
    });
    expect(bluefy.ios).toBe(true);
    expect(bluefy.browser).toBe("bluefy");
    expect(bluefy.bluetooth).toBe(true);
    expect(describeHrSupport(bluefy)).toMatch(/can pair Bluetooth/);
  });

  it("treats iPadOS desktop UA + coarse pointer as iOS", () => {
    const ipad = probeNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      coarse: true,
    });
    expect(ipad.ios).toBe(true);
  });

  it("points Chromium laptops at a Polar-class strap", () => {
    const laptop = probeNavigator({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120",
      bluetooth: {},
      geolocation: {},
      wakeLock: {},
    });
    expect(laptop.ios).toBe(false);
    expect(laptop.browser).toBe("chrome");
    expect(describeHrSupport(laptop)).toMatch(/Chrome or Edge on Android or a laptop/);
  });

  it("labels GPS for touch vs pointer", () => {
    expect(gpsLabel(true)).toBe("Phone GPS distance");
    expect(gpsLabel(false)).toBe("Device GPS distance");
  });

  it("uses the phone app shell after install, not a laptop dashboard", () => {
    expect(preferPhoneShell({ standalone: true, coarse: false })).toBe(true);
    expect(preferPhoneShell({ standalone: false, coarse: true })).toBe(true);
    expect(preferPhoneShell({ standalone: false, coarse: false })).toBe(false);
  });
});
