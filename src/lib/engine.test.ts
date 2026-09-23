import { describe, expect, it } from "vitest";
import {
  bestTrainingWindow,
  bomWbgtC,
  decideCall,
  gateRecoveryAge,
  heatIndexC,
  parseLocaleNumber,
  sleepPerformancePct,
  strainFromZoneMinutes,
  timeOfDayGreeting,
} from "@ajeenckya/engine";

const fresh = {
  readiness: 80,
  acwr: 1.05,
  hrvZ: 0.2,
  tsb: 4,
  risk: 0.1,
  overreaching: false,
  illness: false,
};

describe("@ajeenckya/engine", () => {
  it("greets by local hour, including midnight edges", () => {
    expect(timeOfDayGreeting(0)).toBe("Good night");
    expect(timeOfDayGreeting(8)).toBe("Good morning");
    expect(timeOfDayGreeting(13)).toBe("Good afternoon");
    expect(timeOfDayGreeting(19)).toBe("Good evening");
    expect(timeOfDayGreeting(24)).toBe("Good evening");
  });

  it("accepts a decimal comma and a decimal dot", () => {
    expect(parseLocaleNumber("72,5")).toBeCloseTo(72.5);
    expect(parseLocaleNumber("72.5")).toBeCloseTo(72.5);
    expect(parseLocaleNumber("1.234,5")).toBeCloseTo(1234.5);
    expect(parseLocaleNumber("1,234.5")).toBeCloseTo(1234.5);
    expect(parseLocaleNumber("")).toBeNull();
    expect(parseLocaleNumber("nope")).toBeNull();
  });

  it("never publishes a recovery age from sample data", () => {
    const gated = gateRecoveryAge({ sample: true, realNights: 40, markerCount: 10 });
    expect(gated.publish).toBe(false);
    expect(gated.nightsCollected).toBe(0);
  });

  it("publishes only after 14 real nights and 6 markers", () => {
    expect(
      gateRecoveryAge({ sample: false, realNights: 13, markerCount: 8 }).publish,
    ).toBe(false);
    expect(
      gateRecoveryAge({ sample: false, realNights: 14, markerCount: 5 }).publish,
    ).toBe(false);
    expect(
      gateRecoveryAge({ sample: false, realNights: 14, markerCount: 6 }).publish,
    ).toBe(true);
  });

  it("caps a sick day at Recover", () => {
    expect(decideCall({ ...fresh, illness: true }).call).toBe("recover");
    expect(decideCall(fresh).call).toBe("push");
  });

  it("scores sleep performance from time asleep", () => {
    expect(sleepPerformancePct(7.5 * 3_600_000)).toBe(100);
    expect(sleepPerformancePct(3.75 * 3_600_000)).toBe(50);
    expect(sleepPerformancePct(-1)).toBe(0);
  });

  it("weights zone minutes from 0.5 through 5", () => {
    expect(strainFromZoneMinutes([10, 0, 0, 0, 0, 0])).toBe(5);
    expect(strainFromZoneMinutes([0, 0, 0, 0, 0, 2])).toBe(10);
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
  });

  it("keeps heat and WBGT finite inside normal outdoor ranges", () => {
    for (let temp = -10; temp <= 45; temp += 5) {
      for (let rh = 0; rh <= 100; rh += 10) {
        const hi = heatIndexC(temp, rh);
        const wbgt = bomWbgtC(temp, rh);
        expect(Number.isFinite(hi)).toBe(true);
        expect(Number.isFinite(wbgt)).toBe(true);
      }
    }
    expect(heatIndexC(35, 60)).toBeGreaterThan(heatIndexC(25, 40));
    expect(bomWbgtC(32, 70)).toBeGreaterThan(bomWbgtC(18, 40));
  });

  it("matches 30 hand-checked call fixtures", () => {
    const fixtures: Array<Parameters<typeof decideCall>[0] & { call: string }> = [
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

  it("stays finite across random call inputs", () => {
    let seed = 17;
    const next = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 200; i += 1) {
      const result = decideCall({
        readiness: next() * 120 - 10,
        acwr: next() * 3,
        hrvZ: next() * 6 - 3,
        tsb: next() * 40 - 20,
        risk: next(),
        overreaching: next() > 0.8,
        illness: next() > 0.85,
      });
      expect(["push", "build", "recover"]).toContain(result.call);
      expect(result.why.length).toBeGreaterThan(0);
      if (next() > 2) expect(result.call).not.toBe("push");
    }
  });
});
