import { describe, expect, it } from "vitest";
import {
  AETHER_OVERNIGHT_SLEEP_ID,
  appendNightPoint,
  mergeOvernight,
  overnightProgress,
  parseOvernightSummary,
  scoredSleepMs,
  sleepFromOvernight,
  summarizeOvernight,
  type NightPoint,
  type OvernightSummary,
} from "./overnight";

function restNight(
  start: number,
  minutes = 50,
  bpm = 52,
  rmssd: number | null = 88,
): NightPoint[] {
  const points: NightPoint[] = [];
  for (let i = 0; i < minutes; i += 1) {
    points.push({ t: start + i * 60_000, bpm, rmssd });
  }
  return points;
}

describe("Aether overnight from public heart rate", () => {
  it("downsamples points closer than the gap", () => {
    const a = { t: 1_000, bpm: 50, rmssd: 80 };
    const b = { t: 10_000, bpm: 51, rmssd: 81 };
    const c = { t: 25_000, bpm: 52, rmssd: 82 };
    expect(appendNightPoint([a], b)).toEqual([a]);
    expect(appendNightPoint([a], c)).toEqual([a, c]);
    const earlier = { t: a.t - 40_000, bpm: 49, rmssd: 79 };
    expect(appendNightPoint([a], earlier)).toEqual([earlier, a]);
  });

  it("needs ~45 minutes of quiet HR before scoring rest", () => {
    const start = 1_700_000_000_000;
    expect(summarizeOvernight(restNight(start, 20), start + 20 * 60_000)).toBeNull();
    const summary = summarizeOvernight(restNight(start, 50), start + 50 * 60_000);
    expect(summary).not.toBeNull();
    expect(summary!.restMs).toBeGreaterThanOrEqual(45 * 60_000);
    expect(summary!.restHr).toBe(52);
    expect(summary!.rmssd).toBe(88);
    expect(summary!.recovery).toBeGreaterThan(0);
  });

  it("counts walking HR as awake, not REM or deep", () => {
    const start = 1_700_000_000_000;
    const points = [
      ...restNight(start, 50, 54, 90),
      ...restNight(start + 50 * 60_000, 10, 118, null),
    ];
    const summary = summarizeOvernight(points, start + 60 * 60_000);
    expect(summary).not.toBeNull();
    expect(summary!.awakeMs).toBeGreaterThan(0);
    const sleep = sleepFromOvernight(summary!);
    expect(sleep.id).toBe(AETHER_OVERNIGHT_SLEEP_ID);
    expect(summary!.staged).toBe(false);
    expect(sleep.score?.stage_summary.total_rem_sleep_time_milli).toBe(0);
    expect(sleep.score?.stage_summary.total_slow_wave_sleep_time_milli).toBe(0);
    expect(sleep.score?.stage_summary.total_light_sleep_time_milli).toBe(summary!.quietMs);
  });

  it("keeps last night's summary until a new night qualifies", () => {
    const stored: OvernightSummary = {
      start: 100,
      end: 200,
      restMs: 6 * 3600_000,
      awakeMs: 40 * 60_000,
      quietMs: 6 * 3600_000,
      deepMs: 0,
      activeMs: 0,
      cycles: 0,
      disturbances: 0,
      staged: false,
      epochs: [],
      rmssd: 80,
      restHr: 50,
      recovery: 72,
      spo2: null,
      skinTempC: null,
      pointCount: 80,
    };
    expect(mergeOvernight(stored, null, 200 + 2 * 3600_000)?.recovery).toBe(72);
    const next: OvernightSummary = { ...stored, start: 200 + 8 * 3600_000, restMs: 5 * 3600_000 };
    expect(mergeOvernight(stored, next)?.restMs).toBe(5 * 3600_000);
  });

  it("reports in-progress rest before the 45-minute bar", () => {
    const start = 1_700_000_000_000;
    const progress = overnightProgress(restNight(start, 20), start + 20 * 60_000);
    expect(progress.pointCount).toBe(20);
    expect(progress.restMs).toBeGreaterThan(0);
  });

  it("maps Aether sleep architecture onto the sleep totals", () => {
    const staged: OvernightSummary = {
      start: 1_000,
      end: 8 * 3600_000,
      restMs: 7 * 3600_000,
      awakeMs: 40 * 60_000,
      quietMs: 3.2 * 3600_000,
      deepMs: 2.1 * 3600_000,
      activeMs: 1.7 * 3600_000,
      cycles: 4,
      disturbances: 2,
      staged: true,
      epochs: [
        { t: 1_000, durMs: 2.1 * 3600_000, phase: "deep" },
        { t: 1_000 + 2.1 * 3600_000, durMs: 1.7 * 3600_000, phase: "active" },
      ],
      rmssd: 90,
      restHr: 50,
      recovery: 80,
      spo2: null,
      skinTempC: null,
      pointCount: 400,
    };
    const sleep = sleepFromOvernight(staged);
    expect(sleep.score?.stage_summary.total_light_sleep_time_milli).toBe(staged.quietMs);
    expect(sleep.score?.stage_summary.total_slow_wave_sleep_time_milli).toBe(staged.deepMs);
    expect(sleep.score?.stage_summary.total_rem_sleep_time_milli).toBe(staged.activeMs);
    expect(sleep.score?.stage_summary.sleep_cycle_count).toBe(4);
    expect(sleep.score?.stage_summary.disturbance_count).toBe(2);
    expect(scoredSleepMs(sleep.score!.stage_summary, true)).toBe(staged.restMs);
    expect(scoredSleepMs(sleep.score!.stage_summary, false)).toBe(
      staged.restMs + staged.awakeMs,
    );
  });

  it("backfills quiet rest on older saved nights", () => {
    const parsed = parseOvernightSummary({ start: 1, end: 2, restMs: 9, awakeMs: 1 });
    expect(parsed?.quietMs).toBe(9);
    expect(parsed?.deepMs).toBe(0);
    expect(parsed?.staged).toBe(false);
    expect(parsed?.epochs).toEqual([]);
  });
});
