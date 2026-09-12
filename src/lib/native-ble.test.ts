import { describe, expect, it } from "vitest";
import { hasAetherNativeShell, isAetherBandUserAgent } from "./native-ble";

describe("Aether iPhone shell", () => {
  it("recognizes the native app user agent", () => {
    expect(isAetherBandUserAgent("Mobile/15E148 AetherBand/1")).toBe(true);
    expect(isAetherBandUserAgent("CriOS/129")).toBe(false);
    expect(hasAetherNativeShell({ nativeShell: true })).toBe(true);
    expect(hasAetherNativeShell({ userAgent: "Safari" })).toBe(false);
  });
});
