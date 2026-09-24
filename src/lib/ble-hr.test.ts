import { describe, expect, it } from "vitest";
import {
  WHOOP_NO_PUBLIC_HR,
  WHOOP_PUBLIC_HR,
  explainBleError,
  explainCameraError,
  heartRateRequestOptions,
  isPlausibleHr,
  isWhoopBandName,
  parseHeartRate,
  parseHeartRateMeasurement,
  rmssdMs,
  sdnnMs,
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

  it("reads R-R intervals when flag bit 4 is set", () => {
    const sample = parseHeartRateMeasurement(
      view([0x10, 64, 0x00, 0x04, 0x00, 0x04]),
    );
    expect(sample?.bpm).toBe(64);
    expect(sample?.rrMs).toHaveLength(2);
    expect(sample?.rrMs[0]).toBeCloseTo(1000, 0);
  });

  it("computes RMSSD from successive R-R", () => {
    expect(rmssdMs([800, 820, 790])).toBeGreaterThan(10);
    expect(rmssdMs([800])).toBeNull();
    expect(sdnnMs([800, 820, 790])).toBeGreaterThan(5);
  });
});

describe("Web Bluetooth chooser", () => {
  it("filters Polar-class straps and always requests the heart_rate service", () => {
    const opts = heartRateRequestOptions(false);
    expect(opts.acceptAllDevices).toBeUndefined();
    expect(opts.optionalServices).toEqual([
      "heart_rate",
      "battery_service",
      "pulse_oximeter",
      "health_thermometer",
    ]);
    expect(opts.filters?.some((f) => f.services?.includes("heart_rate"))).toBe(true);
    expect(opts.filters?.some((f) => f.namePrefix === "Polar")).toBe(true);
  });

  it("can scan every BLE device when the strap does not advertise HR", () => {
    const opts = heartRateRequestOptions(true);
    expect(opts.acceptAllDevices).toBe(true);
    expect(opts.filters).toBeUndefined();
    expect(opts.optionalServices).toContain("pulse_oximeter");
    expect(opts.optionalServices).toContain("health_thermometer");
  });

  it("lists WHOOP in the chooser and uses public Heart Rate GATT", () => {
    const opts = heartRateRequestOptions(false);
    expect(opts.filters?.some((f) => f.namePrefix === "WHOOP")).toBe(true);
    expect(opts.optionalServices).toContain("heart_rate");
    expect(opts.optionalServices).toContain("pulse_oximeter");
  });

  it("explains missing Web Bluetooth without refusing WHOOP by name", () => {
    expect(explainBleError(null, false)).toMatch(/Bluefy/);
    expect(explainBleError({ name: "NotFoundError" }, true)).toMatch(/heart-rate strap/);
    expect(explainBleError(new Error(WHOOP_NO_PUBLIC_HR), true)).toBe(WHOOP_NO_PUBLIC_HR);
  });

  it("maps camera failures to the actual cause", () => {
    expect(explainCameraError({ name: "NotAllowedError" })).toMatch(/permission/i);
    expect(explainCameraError({ name: "NotFoundError" })).toMatch(/No camera/);
    expect(explainCameraError({ name: "NotReadableError" })).toMatch(/in use/);
    expect(explainCameraError({ name: "SecurityError" })).toMatch(/secure/);
    expect(explainCameraError(new Error("nope"))).not.toMatch(/Bluefy/);
  });

  it("recognizes WHOOP names so live copy can mention the public HR profile", () => {
    expect(isWhoopBandName("WHOOP 4.0")).toBe(true);
    expect(isWhoopBandName("Polar H10")).toBe(false);
    expect(WHOOP_PUBLIC_HR).toMatch(/public Heart Rate/);
    expect(WHOOP_PUBLIC_HR).toMatch(/pulse-oximeter/);
    expect(WHOOP_PUBLIC_HR).toMatch(/Aether sleep/);
  });
});
