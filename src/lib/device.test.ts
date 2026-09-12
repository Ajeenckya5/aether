import { describe, expect, it } from "vitest";
import { describeHrSupport, gpsLabel, preferPhoneShell, probeNavigator } from "./device";

describe("device copy for phone and laptop", () => {
  it("tells iPhone users to use practice pulse, not Web Bluetooth", () => {
    const ios = probeNavigator({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      bluetooth: undefined,
      geolocation: {},
    });
    expect(ios.ios).toBe(true);
    expect(ios.bluetooth).toBe(false);
    expect(describeHrSupport(ios)).toMatch(/iPhone\/iPad Safari has no Web Bluetooth/);
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
    expect(describeHrSupport(laptop)).toMatch(/laptop Chrome\/Edge or Android Chrome/);
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
