import { describe, expect, it } from "vitest";
import { DEFAULT_ATHLETE, sanitizeAthlete } from "./athlete";
import { effectiveResidual, estimateBioAge, friendFitnessAge, kdm } from "./bio-age";
import { buildDemoDashboard } from "./mock";
import { EMPTY_DASHBOARD } from "./types";

describe("Klemera–Doubal biological age", () => {
  it("recovers chronological age when every marker sits on its age line", () => {
    const ca = 40;
    const vo2 = { x: 60.2 - 0.49 * ca, q: 60.2, k: -0.49, s: 7.8 };
    const hrv = { x: 4.14 - 0.015 * ca, q: 4.14, k: -0.015, s: 0.36 };
    const se = { x: 97.2 - 0.18 * ca, q: 97.2, k: -0.18, s: 4.8 };
    expect(kdm([vo2, hrv, se], ca, false)).toBeCloseTo(ca, 6);
    expect(kdm([vo2, hrv, se], ca, true)).toBeCloseTo(ca, 6);
  });

  it("pulls biological age below calendar age when VO2 is younger than expected", () => {
    const ca = 40;
    const youngVo2 = { x: 52, q: 60.2, k: -0.49, s: effectiveResidual(7.8, 7) };
    const onLineHrv = { x: 4.14 - 0.015 * ca, q: 4.14, k: -0.015, s: 0.36 };
    const unconstrained = kdm([youngVo2, onLineHrv], ca, false);
    const withPrior = kdm([youngVo2, onLineHrv], ca, true);
    expect(unconstrained).not.toBeNull();
    expect(withPrior).not.toBeNull();
    expect(unconstrained!).toBeLessThan(ca);
    expect(withPrior!).toBeLessThan(ca);
    expect(withPrior!).toBeGreaterThan(unconstrained!);
  });

  it("gives 7-night means more weight than a single reading", () => {
    const ca = 40;
    const young = { x: 52, q: 60.2, k: -0.49, s: 7.8 };
    const averaged = { ...young, s: effectiveResidual(7.8, 7) };
    const oneNight = kdm([young], ca, true)!;
    const week = kdm([averaged], ca, true)!;
    expect(week).toBeLessThan(oneNight);
  });

  it("inverts FRIEND VO2 so higher aerobic capacity is a younger fitness age", () => {
    expect(friendFitnessAge(52, "male")).toBeLessThan(friendFitnessAge(38, "male"));
    expect(friendFitnessAge(44, "female")).toBeLessThan(friendFitnessAge(30, "female"));
  });

  it("stays unavailable without enough trait markers", () => {
    const report = estimateBioAge(EMPTY_DASHBOARD, DEFAULT_ATHLETE);
    expect(report.biological).toBeNull();
    expect(report.confidence).toBe("unavailable");
    expect(report.markersUsed).toBe(0);
    expect(report.rows.some((row) => row.id === "bmi")).toBe(false);
  });

  it("does not treat demo WHOOP body as this person when disconnected", () => {
    const report = estimateBioAge(buildDemoDashboard(), DEFAULT_ATHLETE);
    expect(report.rows.some((row) => row.id === "bmi")).toBe(false);
    expect(report.missing.some((line) => /height and weight/i.test(line))).toBe(true);
  });

  it("never gives sample nights a confidence label", () => {
    const athlete = sanitizeAthlete({
      age: 36,
      sex: "female",
      heightCm: 168,
      weightKg: 62,
      systolicMmHg: 112,
    });
    const report = estimateBioAge(buildDemoDashboard(), athlete);
    expect(report.biological).toBeNull();
    expect(report.confidence).toBe("unavailable");
    expect(report.recoveryAge.publish).toBe(false);
    expect(report.recoveryAge.nightsCollected).toBe(0);
    const real = estimateBioAge({ ...buildDemoDashboard(), connected: true }, athlete);
    expect(real.recoveryAge.publish).toBe(true);
    expect(real.confidence).not.toBe("unavailable");
    expect(real.biological).not.toBeNull();
  });

  it("needs three markers before publishing a number", () => {
    const athlete = sanitizeAthlete({
      restHrOverride: 48,
      heightCm: 175,
      weightKg: 70,
    });
    const twoPlus = estimateBioAge(EMPTY_DASHBOARD, athlete);
    expect(twoPlus.markersUsed).toBe(2);
    expect(twoPlus.biological).toBeNull();
    const withSbp = estimateBioAge(
      EMPTY_DASHBOARD,
      sanitizeAthlete({ ...athlete, systolicMmHg: 118 }),
    );
    expect(withSbp.markersUsed).toBe(3);
    expect(withSbp.biological).toBeNull();
    expect(withSbp.confidence).toBe("unavailable");
    expect(withSbp.recoveryAge.publish).toBe(false);
  });

  it("prefers live band RMSSD over overnight sample when streaming", () => {
    const athlete = sanitizeAthlete({
      age: 36,
      heightCm: 175,
      weightKg: 70,
      systolicMmHg: 118,
    });
    const live = estimateBioAge(buildDemoDashboard(), athlete, {
      rmssdMs: 90,
      restHr: 52,
    });
    const hrv = live.rows.find((row) => row.id === "ln-rmssd");
    expect(hrv?.name).toMatch(/live band/);
    expect(hrv?.observed).toBeCloseTo(Math.log(90), 5);
  });
});
