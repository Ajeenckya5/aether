import { describe, expect, it } from "vitest";
import {
  overlayDashboard,
  parseBandLive,
  physiologyFromRr,
  sessionRestHr,
} from "./band-live";
import { AETHER_OVERNIGHT_SLEEP_ID, type OvernightSummary } from "./overnight";
import { buildDemoDashboard } from "./mock";

const overnight: OvernightSummary = {
  start: Date.parse("2026-09-11T02:10:00.000Z"),
  end: Date.parse("2026-09-11T09:40:00.000Z"),
  restMs: 6.5 * 3600_000,
  awakeMs: 40 * 60_000,
  rmssd: 91,
  restHr: 51,
  recovery: 74,
  spo2: null,
  skinTempC: null,
  pointCount: 200,
};

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
      spo2: null,
      skinTempC: null,
      overnight: null,
      at: 1,
    });
    expect(next.recoveries[0]?.score?.hrv_rmssd_milli).toBe(91);
    expect(next.recoveries[0]?.score?.resting_heart_rate).toBe(51);
    expect(next.recoveries[0]?.score?.spo2_percentage).toBeNull();
    expect(demo.recoveries[0]?.score?.hrv_rmssd_milli).not.toBe(91);
  });

  it("replaces sample sleep with rest/wake when an overnight log exists", () => {
    const demo = buildDemoDashboard();
    const next = overlayDashboard(demo, {
      rmssd: 91,
      sdnn: 72,
      restHr: 51,
      bpm: 52,
      batteryPct: 80,
      rrCount: 40,
      deviceName: "WHOOP 4.0",
      spo2: 97.1,
      skinTempC: 33.2,
      overnight,
      at: 1,
    });
    expect(next.sleeps[0]?.id).toBe(AETHER_OVERNIGHT_SLEEP_ID);
    expect(next.sleeps[0]?.score?.stage_summary.total_rem_sleep_time_milli).toBe(0);
    expect(next.sleeps[0]?.score?.stage_summary.total_light_sleep_time_milli).toBe(
      overnight.restMs,
    );
    expect(next.recoveries[0]?.sleep_id).toBe(AETHER_OVERNIGHT_SLEEP_ID);
    expect(next.recoveries[0]?.score?.spo2_percentage).toBe(97.1);
    expect(next.recoveries[0]?.score?.skin_temp_celsius).toBe(33.2);
    expect(next.recoveries[0]?.score?.recovery_score).toBe(
      demo.recoveries[0]?.score?.recovery_score,
    );
  });

  it("does not replace official WHOOP sleep when the account is connected", () => {
    const demo = { ...buildDemoDashboard(), connected: true };
    const originalId = demo.sleeps[0]?.id;
    const next = overlayDashboard(demo, {
      rmssd: 91,
      sdnn: 72,
      restHr: 51,
      bpm: 52,
      batteryPct: 80,
      rrCount: 40,
      deviceName: "WHOOP 4.0",
      spo2: null,
      skinTempC: null,
      overnight,
      at: 1,
    });
    expect(next.sleeps[0]?.id).toBe(originalId);
    expect(next.sleeps[0]?.score?.stage_summary.total_rem_sleep_time_milli).toBeGreaterThan(0);
  });

  it("parses a saved band snapshot", () => {
    expect(parseBandLive(null)).toBeNull();
    expect(parseBandLive(JSON.stringify({ rmssd: 88, restHr: 52 }))?.rmssd).toBe(88);
    expect(
      parseBandLive(JSON.stringify({ overnight: { start: 1, end: 2, restMs: 3, awakeMs: 4 } }))
        ?.overnight?.restMs,
    ).toBe(3);
  });
});
