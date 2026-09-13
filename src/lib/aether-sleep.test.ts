import { describe, expect, it } from "vitest";
import {
  analyzeAetherSleep,
  classifyEpoch,
  type AetherSleepPhase,
} from "./aether-sleep";
import type { NightPoint } from "./overnight";

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

function wave(i: number, jitter: number): number {
  return Math.round(
    (Math.sin(i / 2.7) + Math.sin(i / 5.1) * 0.35) * jitter,
  );
}

function stretch(
  start: number,
  minutes: number,
  bpm: number,
  jitter: number,
  rmssd: number | null,
): NightPoint[] {
  const points: NightPoint[] = [];
  for (let i = 0; i < minutes; i += 1) {
    points.push({
      t: start + i * 60_000,
      bpm: bpm + wave(i, jitter),
      rmssd,
    });
  }
  return points;
}

/** Typical night: settle, deep, active, quiet, deep, active, quiet, active, morning. */
function fullNight(start: number, extraWalk = false): NightPoint[] {
  const blocks: Array<[number, number, number, number | null]> = [
    [15, 78, 6, 34],
    [80, 48, 0.6, 108],
    [25, 59, 4.2, 46],
    [50, 54, 1.3, 74],
    [70, 47, 0.5, 112],
    [35, 60, 4.6, 41],
    [45, 53, 1.2, 71],
    [40, 61, 5, 39],
    [20, 55, 1.4, 69],
    [15, 82, 7, 31],
  ];
  if (extraWalk) blocks.push([10, 118, 3, null]);
  const points: NightPoint[] = [];
  let t = start;
  for (const [minutes, bpm, jitter, rmssd] of blocks) {
    points.push(...stretch(t, minutes, bpm, jitter, rmssd));
    t += minutes * 60_000;
  }
  return points;
}

describe("Aether sleep from public heart rate", () => {
  it("labels high HR as wake, not active rest", () => {
    expect(
      classifyEpoch({
        meanBpm: 118,
        relHr: 66,
        stdBpm: 3,
        rmssd: 20,
        hrvMed: 80,
        nightFrac: 0.7,
      }),
    ).toBe("wake");
  });

  it("labels the lowest stable HRV-rich epochs as deep rest", () => {
    expect(
      classifyEpoch({
        meanBpm: 48,
        relHr: 0,
        stdBpm: 0.6,
        rmssd: 110,
        hrvMed: 72,
        nightFrac: 0.2,
      }),
    ).toBe("deep");
  });

  it("labels later variable HR as active rest", () => {
    expect(
      classifyEpoch({
        meanBpm: 60,
        relHr: 10,
        stdBpm: 3.2,
        rmssd: 42,
        hrvMed: 72,
        nightFrac: 0.65,
      }),
    ).toBe("active");
  });

  it("keeps a short flat rest as quiet vs wake, without inventing stages", () => {
    const start = 1_700_000_000_000;
    const analysis = analyzeAetherSleep(restNight(start, 50), start + 50 * 60_000);
    expect(analysis).not.toBeNull();
    expect(analysis!.staged).toBe(false);
    expect(analysis!.deepMs).toBe(0);
    expect(analysis!.activeMs).toBe(0);
    expect(analysis!.quietMs).toBe(analysis!.restMs);
    expect(analysis!.restMs).toBeGreaterThan(40 * 60_000);
  });

  it("builds Aether sleep architecture from a cycling HR night", () => {
    const start = 1_700_000_000_000;
    const points = fullNight(start);
    const now = points[points.length - 1]!.t;
    const analysis = analyzeAetherSleep(points, now);
    expect(analysis).not.toBeNull();
    expect(analysis!.staged).toBe(true);
    expect(analysis!.deepMs).toBeGreaterThan(90 * 60_000);
    expect(analysis!.activeMs).toBeGreaterThan(50 * 60_000);
    expect(analysis!.quietMs).toBeGreaterThan(30 * 60_000);
    expect(analysis!.awakeMs).toBeGreaterThan(12 * 60_000);
    expect(analysis!.cycles).toBeGreaterThanOrEqual(2);
    const phases = new Set(analysis!.epochs.map((row) => row.phase));
    expect(phases.has("deep")).toBe(true);
    expect(phases.has("active")).toBe(true);
    expect(phases.has("wake")).toBe(true);
  });

  it("counts a morning walk as wake, not active rest", () => {
    const start = 1_700_000_000_000;
    const points = fullNight(start, true);
    const analysis = analyzeAetherSleep(points, points[points.length - 1]!.t);
    expect(analysis).not.toBeNull();
    const last: AetherSleepPhase = analysis!.epochs[analysis!.epochs.length - 1]!.phase;
    expect(last).toBe("wake");
    expect(analysis!.awakeMs).toBeGreaterThan(20 * 60_000);
  });
});
