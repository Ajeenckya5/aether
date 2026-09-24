import { describe, expect, it } from "vitest";
import {
  bodyMassIndex,
  cmToFeetInches,
  cycleDayFromStart,
  DEFAULT_ATHLETE,
  feetInchesToCm,
  greetingName,
  kgToLb,
  lbToKg,
  resolvedHeightCm,
  resolvedRestHr,
  resolvedWeightKg,
  sanitizeAthlete,
} from "./athlete";

describe("personal body details stay on-device", () => {
  it("keeps height and weight empty until the person types them", () => {
    expect(DEFAULT_ATHLETE.heightCm).toBeNull();
    expect(DEFAULT_ATHLETE.weightKg).toBeNull();
    expect(DEFAULT_ATHLETE.displayName).toBe("");
  });

  it("does not treat demo WHOOP body as this person", () => {
    const blank = sanitizeAthlete({});
    expect(resolvedWeightKg(blank, 76.4, false)).toBeNull();
    expect(resolvedHeightCm(blank, 1.78, false)).toBeNull();
    expect(greetingName(blank, "Alex", false)).toBe("there");
  });

  it("prefers the typed body over a connected band", () => {
    const athlete = sanitizeAthlete({ heightCm: 165, weightKg: 58, displayName: "Sam Patel" });
    expect(resolvedWeightKg(athlete, 76.4, true)).toBe(58);
    expect(resolvedHeightCm(athlete, 1.78, true)).toBe(165);
    expect(greetingName(athlete, "Alex", true)).toBe("Sam");
  });

  it("can use the band only when connected and the person left fields blank", () => {
    const blank = sanitizeAthlete({});
    expect(resolvedWeightKg(blank, 76.4, true)).toBe(76.4);
    expect(resolvedHeightCm(blank, 1.78, true)).toBe(178);
    expect(greetingName(blank, "Alex", true)).toBe("Alex");
  });

  it("converts metric and imperial without inventing a body", () => {
    expect(kgToLb(70)).toBeCloseTo(154.32, 1);
    expect(lbToKg(154.32)).toBeCloseTo(70, 1);
    expect(cmToFeetInches(178)).toEqual({ feet: 5, inches: 10 });
    expect(feetInchesToCm(5, 10)).toBeCloseTo(177.8, 1);
  });

  it("computes BMI from the personal kg/cm pair", () => {
    expect(bodyMassIndex(70, 175)).toBeCloseTo(22.86, 2);
  });

  it("uses a typed resting HR before a measured one", () => {
    const athlete = sanitizeAthlete({ restHrOverride: 52 });
    expect(resolvedRestHr(athlete, 61)).toBe(52);
    expect(resolvedRestHr(sanitizeAthlete({}), 61)).toBe(61);
    expect(resolvedRestHr(sanitizeAthlete({}), null)).toBe(60);
  });

  it("drops impossible height or weight instead of storing junk", () => {
    const bad = sanitizeAthlete({ heightCm: 12, weightKg: 900, age: 9, cycleDay: 40 });
    expect(bad.heightCm).toBeNull();
    expect(bad.weightKg).toBeNull();
    expect(bad.age).toBe(16);
    expect(bad.cycleDay).toBeNull();
  });

  it("counts the cycle from a start date instead of a typed day number", () => {
    expect(cycleDayFromStart("2026-09-01", new Date("2026-09-15T15:00:00"))).toBe(15);
    expect(cycleDayFromStart("2026-09-24", new Date("2026-09-23T15:00:00"))).toBeNull();
    const tracked = sanitizeAthlete({ cycleTracking: true, cycleStart: "2026-09-01" });
    expect(tracked.cycleTracking).toBe(true);
    expect(tracked.cycleStart).toBe("2026-09-01");
    expect(tracked.cycleDay).toBeGreaterThanOrEqual(1);
    expect(tracked.cycleDay).toBeLessThanOrEqual(28);
    expect(sanitizeAthlete({ cycleTracking: false, cycleDay: 10 }).cycleDay).toBeNull();
  });

  it("keeps optional systolic empty until typed, and drops impossible values", () => {
    expect(DEFAULT_ATHLETE.systolicMmHg).toBeNull();
    expect(sanitizeAthlete({ systolicMmHg: 118 }).systolicMmHg).toBe(118);
    expect(sanitizeAthlete({ systolicMmHg: 40 }).systolicMmHg).toBeNull();
  });
});
