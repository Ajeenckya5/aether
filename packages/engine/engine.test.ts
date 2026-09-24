import { describe, expect, it } from "vitest";
import {
  bestTrainingWindow,
  bomWbgtC,
  decideCall,
  gateRecoveryAge,
  heatIndexC,
  parseLocaleNumber,
  sleepEfficiencyPct,
  sleepPerformancePct,
  strainFromZoneMinutes,
  timeOfDayGreeting,
  type CallInput,
} from "./src/index";

const fresh: CallInput = {
  readiness: 80,
  acwr: 1.05,
  hrvZ: 0.2,
  tsb: 4,
  risk: 0.1,
  overreaching: false,
  illness: false,
};

const rank = { recover: 0, build: 1, push: 2 } as const;

function nextRandom(seed: { n: number }): number {
  seed.n = (seed.n * 16807) % 2147483647;
  return seed.n / 2147483647;
}

describe("@ajeenckya/engine", () => {
  it("greets by local hour and stays inside the four phrases", () => {
    expect(timeOfDayGreeting(0)).toBe("Good night");
    expect(timeOfDayGreeting(4)).toBe("Good night");
    expect(timeOfDayGreeting(5)).toBe("Good morning");
    expect(timeOfDayGreeting(11)).toBe("Good morning");
    expect(timeOfDayGreeting(12)).toBe("Good afternoon");
    expect(timeOfDayGreeting(16)).toBe("Good afternoon");
    expect(timeOfDayGreeting(17)).toBe("Good evening");
    expect(timeOfDayGreeting(23)).toBe("Good evening");
    expect(timeOfDayGreeting(24)).toBe("Good evening");
    expect(timeOfDayGreeting(-4)).toBe("Good night");
    expect(timeOfDayGreeting(Number.NaN)).toBe("Good afternoon");
    for (let hour = -2; hour <= 30; hour += 1) {
      expect(["Good night", "Good morning", "Good afternoon", "Good evening"]).toContain(
        timeOfDayGreeting(hour),
      );
    }
  });

  it("accepts a decimal comma and a decimal dot", () => {
    expect(parseLocaleNumber("72,5")).toBeCloseTo(72.5);
    expect(parseLocaleNumber("72.5")).toBeCloseTo(72.5);
    expect(parseLocaleNumber(" 72,5 ")).toBeCloseTo(72.5);
    expect(parseLocaleNumber("1.234,5")).toBeCloseTo(1234.5);
    expect(parseLocaleNumber("1,234.5")).toBeCloseTo(1234.5);
    expect(parseLocaleNumber("1,234,567")).toBe(1234567);
    expect(parseLocaleNumber("+12.5")).toBeCloseTo(12.5);
    expect(parseLocaleNumber("-3.5")).toBeCloseTo(-3.5);
    expect(parseLocaleNumber("")).toBeNull();
    expect(parseLocaleNumber("nope")).toBeNull();
    expect(parseLocaleNumber("72.5kg")).toBeNull();
  });

  it("never publishes a recovery age from sample data", () => {
    for (let nights = -3; nights <= 40; nights += 1) {
      for (let markers = -1; markers <= 12; markers += 1) {
        const gated = gateRecoveryAge({ sample: true, realNights: nights, markerCount: markers });
        expect(gated.publish).toBe(false);
        expect(gated.nightsCollected).toBe(0);
        expect(gated).not.toHaveProperty("confidence");
        expect(JSON.stringify(gated)).not.toMatch(/confidence/i);
      }
    }
  });

  it("publishes only after 14 real nights and 6 markers", () => {
    expect(gateRecoveryAge({ sample: false, realNights: 13.9, markerCount: 8 }).publish).toBe(false);
    expect(gateRecoveryAge({ sample: false, realNights: 14, markerCount: 5 }).publish).toBe(false);
    expect(gateRecoveryAge({ sample: false, realNights: -4, markerCount: 9 }).nightsCollected).toBe(0);
    expect(gateRecoveryAge({ sample: false, realNights: 20, markerCount: 6.2 }).publish).toBe(true);
    const gated = gateRecoveryAge({ sample: false, realNights: 14, markerCount: 6 });
    expect(gated.publish).toBe(true);
    expect(gated.nightsRequired).toBe(14);
    expect(gated.markersRequired).toBe(6);
  });

  it("caps a sick day at Recover", () => {
    const seed = { n: 19 };
    for (let i = 0; i < 80; i += 1) {
      const input: CallInput = {
        readiness: nextRandom(seed) * 140 - 20,
        acwr: nextRandom(seed) * 3,
        hrvZ: nextRandom(seed) * 8 - 4,
        tsb: nextRandom(seed) * 40 - 20,
        risk: nextRandom(seed),
        overreaching: nextRandom(seed) > 0.7,
        illness: true,
      };
      expect(decideCall(input).call).toBe("recover");
    }
    expect(decideCall(fresh).call).toBe("push");
    expect(decideCall({ ...fresh, illness: true }).call).toBe("recover");
  });

  it("keeps the call bounded, finite, and monotonic in readiness", () => {
    const seed = { n: 23 };
    for (let i = 0; i < 40; i += 1) {
      const base: CallInput = {
        readiness: 0,
        acwr: nextRandom(seed) * 1.4,
        hrvZ: nextRandom(seed) * 4 - 2,
        tsb: nextRandom(seed) * 20 - 10,
        risk: nextRandom(seed) * 0.5,
        overreaching: false,
        illness: false,
      };
      let previous = -1;
      for (let readiness = 0; readiness <= 100; readiness += 5) {
        const result = decideCall({ ...base, readiness });
        expect(["push", "build", "recover"]).toContain(result.call);
        expect(result.why.length).toBeGreaterThan(0);
        expect(result.why.every((line) => line.length > 0 && !line.includes("NaN"))).toBe(true);
        const score = rank[result.call];
        expect(score).toBeGreaterThanOrEqual(previous);
        previous = score;
      }
    }
  });

  it("matches 30 hand-checked call fixtures", () => {
    const fixtures: Array<CallInput & { call: string }> = [
      { ...fresh, call: "push" },
      { ...fresh, illness: true, call: "recover" },
      { ...fresh, overreaching: true, call: "recover" },
      { ...fresh, acwr: 1.6, call: "recover" },
      { ...fresh, readiness: 30, call: "recover" },
      { ...fresh, hrvZ: -1.5, call: "recover" },
      { ...fresh, risk: 0.7, call: "recover" },
      { ...fresh, readiness: 50, acwr: 1.1, hrvZ: 0, tsb: 1, call: "build" },
      { ...fresh, readiness: 60, acwr: 1.22, hrvZ: 0, tsb: 1, call: "build" },
      { ...fresh, readiness: 71, acwr: 1, hrvZ: 0.1, tsb: 2, call: "build" },
      { ...fresh, readiness: 90, acwr: 0.9, hrvZ: 0.4, tsb: 8, call: "push" },
      { ...fresh, readiness: 72, acwr: 1.24, hrvZ: 0, tsb: 0, call: "push" },
      { ...fresh, readiness: 72, acwr: 1.25, hrvZ: 0, tsb: 0, call: "build" },
      { ...fresh, readiness: 80, acwr: 1, hrvZ: -0.24, tsb: 1, call: "push" },
      { ...fresh, readiness: 80, acwr: 1, hrvZ: -0.25, tsb: 1, call: "build" },
      { ...fresh, readiness: 80, acwr: 1, hrvZ: 0.2, tsb: -1, call: "build" },
      { ...fresh, readiness: 37, acwr: 1, hrvZ: 0, tsb: 1, risk: 0.1, call: "recover" },
      { ...fresh, readiness: 40, acwr: 1.49, hrvZ: -1, tsb: -2, risk: 0.2, call: "build" },
      { ...fresh, readiness: 20, acwr: 0.7, hrvZ: -2, tsb: -5, risk: 0.8, illness: true, call: "recover" },
      { ...fresh, readiness: 100, acwr: 0.5, hrvZ: 2, tsb: 20, risk: 0, call: "push" },
      { ...fresh, readiness: 55, acwr: 1.3, hrvZ: -0.2, tsb: 0, call: "build" },
      { ...fresh, readiness: 55, acwr: 1.21, hrvZ: -0.2, tsb: 0, call: "build" },
      { ...fresh, readiness: 10, acwr: 2, hrvZ: -3, tsb: -10, risk: 0.9, call: "recover" },
      { ...fresh, readiness: 80, acwr: 1.5, hrvZ: 1, tsb: 5, call: "recover" },
      { ...fresh, readiness: 80, acwr: 1.49, hrvZ: 1, tsb: 5, call: "build" },
      { ...fresh, readiness: 45, acwr: 0.9, hrvZ: -1.34, tsb: 0, call: "build" },
      { ...fresh, readiness: 45, acwr: 0.9, hrvZ: -1.36, tsb: 0, call: "recover" },
      { ...fresh, readiness: 45, acwr: 0.9, hrvZ: 0, tsb: 0, risk: 0.55, call: "build" },
      { ...fresh, readiness: 45, acwr: 0.9, hrvZ: 0, tsb: 0, risk: 0.56, call: "recover" },
      { ...fresh, readiness: 72, acwr: 1.1, hrvZ: 0, tsb: 0, overreaching: true, illness: false, call: "recover" },
    ];
    expect(fixtures).toHaveLength(30);
    for (const fixture of fixtures) {
      const { call, ...input } = fixture;
      expect(decideCall(input).call).toBe(call);
    }
  });

  it("scores sleep between 0 and 100 and rises as rest rises", () => {
    expect(sleepPerformancePct(7.5 * 3_600_000)).toBe(100);
    expect(sleepPerformancePct(3.75 * 3_600_000)).toBe(50);
    expect(sleepPerformancePct(-1)).toBe(0);
    expect(sleepPerformancePct(Number.NaN)).toBe(0);
    expect(sleepPerformancePct(3_600_000, 0)).toBe(0);
    expect(sleepEfficiencyPct(3_600_000, 7_200_000)).toBe(50);
    expect(sleepEfficiencyPct(9_000_000, 7_200_000)).toBe(100);
    expect(sleepEfficiencyPct(-1, 7_200_000)).toBe(0);
    expect(sleepEfficiencyPct(1000, 0)).toBe(0);
    let previous = -1;
    for (let hours = 0; hours <= 12; hours += 1) {
      const score = sleepPerformancePct(hours * 3_600_000);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThanOrEqual(previous);
      previous = score;
    }
  });

  it("weights zone minutes from 0.5 through 5 and ignores junk", () => {
    expect(strainFromZoneMinutes([10, 0, 0, 0, 0, 0])).toBe(5);
    expect(strainFromZoneMinutes([0, 0, 0, 0, 0, 2])).toBe(10);
    expect(strainFromZoneMinutes([Number.NaN, -5, Number.POSITIVE_INFINITY])).toBe(0);
    expect(strainFromZoneMinutes([])).toBe(0);
    let previous = 0;
    for (let minutes = 0; minutes <= 30; minutes += 5) {
      const strain = strainFromZoneMinutes([0, minutes, 0, 0, 0, 0]);
      expect(Number.isFinite(strain)).toBe(true);
      expect(strain).toBeGreaterThanOrEqual(previous);
      previous = strain;
    }
  });

  it("picks the cooler daylight hour inside the next 36 hours", () => {
    const now = Date.parse("2026-06-01T12:00:00Z");
    const chosen = bestTrainingWindow(
      [
        { iso: "hot", hour: 14, atMs: now + 3_600_000, tempC: 32, uv: 8, precipChance: 10 },
        { iso: "cool", hour: 7, atMs: now + 20 * 3_600_000, tempC: 16, uv: 1, precipChance: 0 },
        { iso: "night", hour: 2, atMs: now + 4 * 3_600_000, tempC: 16, uv: 0, precipChance: 0 },
      ],
      now,
    );
    expect(chosen?.iso).toBe("cool");
    expect(bestTrainingWindow([], now)).toBeNull();
    expect(bestTrainingWindow([{ iso: "night", hour: 2, atMs: now, tempC: 10, uv: 0, precipChance: 0 }], now)).toBeNull();
    expect(bestTrainingWindow([{ iso: "later", hour: 10, atMs: now + 40 * 3_600_000, tempC: 16, uv: 1, precipChance: 0 }], now)).toBeNull();
    expect(
      bestTrainingWindow(
        [{ iso: "past", hour: 9, atMs: now - 3 * 3_600_000, tempC: null, uv: null, precipChance: null }],
        now,
      )?.iso,
    ).toBe("past");
    expect(bestTrainingWindow([{ iso: "x", hour: 10, atMs: now, tempC: 16, uv: 0, precipChance: 0 }], Number.NaN)).toBeNull();
    const tie = bestTrainingWindow(
      [
        { iso: "first", hour: 8, atMs: now, tempC: 16, uv: 0, precipChance: 0 },
        { iso: "second", hour: 9, atMs: now + 1000, tempC: 16, uv: 0, precipChance: 0 },
      ],
      now,
    );
    expect(tie?.iso).toBe("first");
  });

  it("keeps heat and WBGT finite, bounded, and warmer as the air warms", () => {
    for (let temp = -10; temp <= 45; temp += 5) {
      for (let rh = 0; rh <= 100; rh += 10) {
        const hi = heatIndexC(temp, rh);
        const wbgt = bomWbgtC(temp, rh);
        expect(Number.isFinite(hi)).toBe(true);
        expect(Number.isFinite(wbgt)).toBe(true);
        expect(hi).toBeGreaterThan(-40);
        expect(hi).toBeLessThan(200);
        expect(wbgt).toBeGreaterThan(-30);
        expect(wbgt).toBeLessThan(90);
      }
    }
    expect(heatIndexC(Number.NaN, 40)).toBe(0);
    expect(heatIndexC(22, Number.NaN)).toBe(22);
    expect(bomWbgtC(Number.NaN, 40)).toBe(0);
    expect(bomWbgtC(22, Number.NaN)).toBe(22);
    expect(heatIndexC(20, 90)).toBe(20);
    expect(heatIndexC(30, 10)).toBeGreaterThan(20);
    expect(heatIndexC(28, 90)).toBeGreaterThan(heatIndexC(28, 40));
    let previous = -Infinity;
    for (let temp = 27; temp <= 40; temp += 1) {
      const hi = heatIndexC(temp, 60);
      expect(hi).toBeGreaterThanOrEqual(previous);
      previous = hi;
    }
    expect(heatIndexC(35, 60)).toBeGreaterThan(heatIndexC(25, 40));
    expect(bomWbgtC(32, 70)).toBeGreaterThan(bomWbgtC(18, 40));
  });
});
