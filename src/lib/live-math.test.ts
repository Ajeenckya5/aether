import { describe, expect, it } from "vitest";
import { gulatiMaxHr, nesMaxHr, resolvedMaxHr, tanakaMaxHr } from "./athlete";
import { edwardsTrimp } from "./intelligence";
import {
  accumulateZones,
  appendSample,
  currentBlockIndex,
  formatClock,
  haversineM,
  scoreLiveLog,
  sealSamples,
  wallElapsedMs,
  zoneDurationsFromMs,
  zoneFromHr,
} from "./live-math";
import { idleClock, pauseClock, resumeClock, skipClockTo, startClock } from "./session-clock";

describe("max HR formulas (published regressions)", () => {
  it("Tanaka 2001: 208 − 0.7×age", () => {
    expect(tanakaMaxHr(32)).toBeCloseTo(185.6, 5);
  });

  it("Nes 2013: 211 − 0.64×age", () => {
    expect(nesMaxHr(32)).toBeCloseTo(190.52, 5);
  });

  it("Gulati 2010 (women): 206 − 0.88×age", () => {
    expect(gulatiMaxHr(32)).toBeCloseTo(177.84, 5);
  });

  it("resolvedMaxHr prefers override, then WHOOP, then Tanaka", () => {
    const athlete = { age: 32, sex: "unspecified" as const, maxHrOverride: null, cycleDay: null };
    expect(resolvedMaxHr(athlete, 188)).toBe(188);
    expect(resolvedMaxHr({ ...athlete, maxHrOverride: 190 }, 188)).toBe(190);
    expect(resolvedMaxHr(athlete, null)).toBe(186);
  });
});

describe("WHOOP-style %HRmax zones", () => {
  const max = 200;
  it("maps 0–50 / 50–60 / 60–70 / 70–80 / 80–90 / 90+ ", () => {
    expect(zoneFromHr(99, max)).toBe(0);
    expect(zoneFromHr(100, max)).toBe(1);
    expect(zoneFromHr(119, max)).toBe(1);
    expect(zoneFromHr(120, max)).toBe(2);
    expect(zoneFromHr(140, max)).toBe(3);
    expect(zoneFromHr(160, max)).toBe(4);
    expect(zoneFromHr(180, max)).toBe(5);
    expect(zoneFromHr(200, max)).toBe(5);
  });
});

describe("Edwards 1993 TRIMP", () => {
  it("is minutes × zone weight 0.5–5", () => {
    const zones = zoneDurationsFromMs([0, 0, 60000, 120000, 0, 0]);
    expect(edwardsTrimp(zones)).toBeCloseTo(1 * 2 + 2 * 3, 8);
  });
});

describe("wall clock — keeps updating after pauses and skips", () => {
  it("ignores time spent paused", () => {
    const origin = 1_000_000;
    expect(wallElapsedMs(origin + 10_000, origin, 0, null)).toBe(10_000);
    expect(wallElapsedMs(origin + 15_000, origin, 0, origin + 10_000)).toBe(10_000);
    const paused = pauseClock(startClock(origin), origin + 10_000);
    const resumed = resumeClock(paused, origin + 13_000);
    expect(wallElapsedMs(origin + 18_000, resumed.origin, resumed.pauseAcc, resumed.pauseAt)).toBe(15_000);
  });

  it("skip while paused lands on the target elapsed", () => {
    const origin = 5_000;
    const paused = pauseClock(startClock(origin), origin + 8_000);
    const skipped = skipClockTo(paused, origin + 20_000, 15_000);
    expect(wallElapsedMs(origin + 20_000, skipped.origin, skipped.pauseAcc, skipped.pauseAt)).toBe(15_000);
  });

  it("idle clock is zero", () => {
    const clock = idleClock();
    expect(wallElapsedMs(Date.now(), clock.origin, clock.pauseAcc, clock.pauseAt)).toBe(0);
  });
});

describe("samples and zones keep counting through background gaps", () => {
  it("drops sub-second duplicates, keeps ~1 Hz", () => {
    const a = appendSample([], 0, 140, null, null);
    const b = appendSample(a, 400, 141, null, null);
    const c = appendSample(b, 1000, 142, null, null);
    expect(b).toHaveLength(1);
    expect(c).toHaveLength(2);
    expect(c[1].bpm).toBe(142);
  });

  it("sealSamples stamps the finish timestamp", () => {
    const sealed = sealSamples([{ t: 0, bpm: 140, lat: null, lon: null }], 18500, 150, null, null);
    expect(sealed.at(-1)?.t).toBe(18500);
    expect(sealed.at(-1)?.bpm).toBe(150);
  });

  it("counts the first sample duration and a 60s background gap (not a 5s cap)", () => {
    const samples = [
      { t: 2000, bpm: 160, lat: null, lon: null },
      { t: 62000, bpm: 160, lat: null, lon: null },
    ];
    const zoneMs = accumulateZones(samples, 200);
    expect(zoneFromHr(160, 200)).toBe(4);
    expect(zoneMs[4]).toBe(2000 + 60000);
  });
});

describe("block index and clock format", () => {
  it("does not skip the last second of a block", () => {
    expect(currentBlockIndex(14.9, [15, 15])).toBe(0);
    expect(currentBlockIndex(15, [15, 15])).toBe(1);
    expect(currentBlockIndex(30, [15, 15])).toBe(1);
  });

  it("formatClock pads mm:ss and hours", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(18504)).toBe("00:18");
    expect(formatClock(3661000)).toBe("1:01:01");
  });
});

describe("haversine", () => {
  it("is ~111.195 km per degree of longitude at the equator", () => {
    expect(haversineM({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111_195, 0);
  });
});

describe("scoreLiveLog", () => {
  it("caps a single pathological gap at 3 minutes", () => {
    const samples = [
      { t: 0, bpm: 190, lat: null, lon: null },
      { t: 3_600_000, bpm: 190, lat: null, lon: null },
    ];
    const scored = scoreLiveLog(samples, 3_600_000, 200, false);
    expect(scored.edwardsTrimp).toBeCloseTo(3 * 5, 8);
    expect(scored.distanceM).toBeNull();
  });

  it("keeps adding Edwards load when samples continue for an hour", () => {
    const samples = Array.from({ length: 61 }, (_, i) => ({
      t: i * 60_000,
      bpm: 190,
      lat: null,
      lon: null,
    }));
    const scored = scoreLiveLog(samples, 3_600_000, 200, false);
    expect(scored.edwardsTrimp).toBeCloseTo(60 * 5, 8);
    expect(scored.strainProxy).toBe(21);
  });
});
