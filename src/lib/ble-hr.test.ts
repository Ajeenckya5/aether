import { describe, expect, it } from "vitest";
import {
  explainBleError,
  heartRateRequestOptions,
  isPlausibleHr,
  isWhoopBandName,
  parseHeartRate,
} from "./ble-hr";

function view(bytes: number[]): DataView {
  return new DataView(Uint8Array.from(bytes).buffer);
}

describe("GATT heart-rate measurement", () => {
  it("reads 8-bit bpm when flag bit 0 is clear", () => {
    expect(parseHeartRate(view([0x00, 142]))).toBe(142);
  });

  it("reads little-endian 16-bit bpm when flag bit 0 is set", () => {
    expect(parseHeartRate(view([0x01, 0x2c, 0x01]))).toBe(300);
  });

  it("rejects truncated packets", () => {
    expect(parseHeartRate(view([0x00]))).toBeNull();
    expect(parseHeartRate(view([0x01, 0x2c]))).toBeNull();
  });

  it("keeps live bpm in a wearable range", () => {
    expect(isPlausibleHr(142)).toBe(true);
    expect(isPlausibleHr(12)).toBe(false);
    expect(isPlausibleHr(300)).toBe(false);
  });
});

describe("Web Bluetooth chooser", () => {
  it("filters Polar-class straps and always requests the heart_rate service", () => {
    const opts = heartRateRequestOptions(false);
    expect(opts.acceptAllDevices).toBeUndefined();
    expect(opts.optionalServices).toEqual(["heart_rate"]);
    expect(opts.filters?.some((f) => f.services?.includes("heart_rate"))).toBe(true);
    expect(opts.filters?.some((f) => f.namePrefix === "Polar")).toBe(true);
  });

  it("can scan every BLE device when the strap does not advertise HR", () => {
    const opts = heartRateRequestOptions(true);
    expect(opts.acceptAllDevices).toBe(true);
    expect(opts.filters).toBeUndefined();
    expect(opts.optionalServices).toEqual(["heart_rate"]);
  });

  it("tells iPhone users the WHOOP band is not the live strap", () => {
    expect(explainBleError(null, false)).toMatch(/does not use the WHOOP cloud/);
    expect(explainBleError({ name: "NotFoundError" }, true)).toMatch(/not the WHOOP band/);
  });

  it("refuses WHOOP-named devices instead of guessing their GATT", () => {
    expect(isWhoopBandName("WHOOP 4.0")).toBe(true);
    expect(isWhoopBandName("Polar H10")).toBe(false);
  });
});
