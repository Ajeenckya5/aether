import { describe, expect, it } from "vitest";
import {
  overlayDashboard,
  parseBandLive,
  physiologyFromRr,
  sessionRestHr,
} from "./band-live";
import { buildDemoDashboard } from "./mock";

describe("live WHOOP physiology from public Heart Rate GATT", () => {
  it("computes RMSSD from cleaned R-R", () => {
    const phys = physiologyFromRr([800, 820, 790, 805, 50, 810]);
    expect(phys.rrCount).toBeGreaterThanOrEqual(4);
    expect(phys.rmssd).not.toBeNull();
    expect(phys.rmssd!).toBeGreaterThan(0);
  });

  it("takes resting HR from the quiet 10th percentile, not a walk", () => {
    const samples = [
      ...Array.from({ length: 20 }, () => 54),
      ...Array.from({ length: 10 }, () => 118),
    ];
    expect(sessionRestHr(samples)).toBe(54);
    expect(sessionRestHr([60, 62])).toBeNull();
  });

  it("overlays band HRV and RHR onto sample recovery", () => {
    const demo = buildDemoDashboard();
    const next = overlayDashboard(demo, {
      rmssd: 91,
      sdnn: 72,
      restHr: 51,
      bpm: 58,
      batteryPct: 80,
      rrCount: 40,
      deviceName: "WHOOP 4.0",
      at: 1,
    });
    expect(next.recoveries[0]?.score?.hrv_rmssd_milli).toBe(91);
    expect(next.recoveries[0]?.score?.resting_heart_rate).toBe(51);
    expect(demo.recoveries[0]?.score?.hrv_rmssd_milli).not.toBe(91);
  });

  it("parses a saved band snapshot", () => {
    expect(parseBandLive(null)).toBeNull();
    expect(parseBandLive(JSON.stringify({ rmssd: 88, restHr: 52 }))?.rmssd).toBe(88);
  });
});
