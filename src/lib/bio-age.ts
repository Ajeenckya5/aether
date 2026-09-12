import {
  bodyMassIndex,
  resolvedHeightCm,
  resolvedMaxHr,
  resolvedRestHr,
  resolvedWeightKg,
  type Athlete,
  type Sex,
} from "./athlete";
import { buildDaySeries } from "./intelligence";
import type { Dashboard } from "./types";

export type BioAgeSystemId = "fitness" | "autonomic" | "sleep" | "body" | "respiratory";

export type BioAgeSystem = {
  id: BioAgeSystemId;
  label: string;
  age: number | null;
  markers: number;
};

export type BioAgeMarkerRow = {
  id: string;
  system: BioAgeSystemId;
  name: string;
  observed: number;
  expected: number;
  unit: string;
  citation: string;
};

export type BioAgeReport = {
  chronological: number;
  biological: number | null;
  unconstrained: number | null;
  delta: number | null;
  confidence: "high" | "medium" | "low" | "unavailable";
  markersUsed: number;
  markersPossible: number;
  systems: BioAgeSystem[];
  rows: BioAgeMarkerRow[];
  missing: string[];
  method: string;
  citation: string;
  notes: string[];
};

type Marker = {
  id: string;
  system: BioAgeSystemId;
  name: string;
  x: number;
  q: number;
  k: number;
  s: number;
  unit: string;
  citation: string;
};

/** Typical KDM residual SD (years) when a NHANES-style panel cannot be re-fit. */
export const KDM_S_BA = 6;

export const BIO_AGE_CITATION =
  "Klemera & Doubal 2006, Mech Ageing Dev 127:240. Marker slopes: FRIEND VO2 (Kaminsky 2015 Mayo Clin Proc), Uth 2004 VO2 from HR, Umetani 1998 JACC HRV, Ohayon 2004 sleep meta-analysis, Quer 2020 Nat Digit Med RHR. Not GrimAge or Levine PhenoAge (those need DNA or a blood panel). Not a medical diagnosis.";

export const BIO_AGE_NOTES = [
  "Wearable KDM is not a DNA methylation clock or a Levine PhenoAge blood panel.",
  "Illness, alcohol, and other journal flags stay out — those are today’s state, not a trait age.",
];

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function lastSample(
  values: Array<number | null | undefined>,
  window = 7,
  min = 1,
): { mean: number; n: number } | null {
  const xs = values
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .slice(-window);
  if (xs.length < min) return null;
  return { mean: mean(xs), n: xs.length };
}

function clampAge(value: number): number {
  return Math.min(90, Math.max(16, value));
}

/** Repeat nights shrink residual RMSE, capped so device bias is not treated as √n-vanishing. */
export function effectiveResidual(s: number, repeats: number, maxRepeats = 3): number {
  return s / Math.sqrt(Math.max(1, Math.min(repeats, maxRepeats)));
}

function vo2Line(sex: Sex): { q: number; k: number; s: number } {
  // FRIEND registry 50th-percentile VO2peak linearized (Kaminsky et al. 2015).
  if (sex === "female") return { q: 46.6, k: -0.36, s: 6.6 };
  if (sex === "male") return { q: 60.2, k: -0.49, s: 7.8 };
  return { q: 53.4, k: -0.425, s: 7.2 };
}

/** Invert FRIEND 50th-percentile VO2 vs age. */
export function friendFitnessAge(vo2: number, sex: Sex): number {
  const { q, k } = vo2Line(sex);
  return clampAge((vo2 - q) / k);
}

export function kdm(
  markers: Array<{ x: number; q: number; k: number; s: number }>,
  chronological: number,
  includeCa: boolean,
  sBa = KDM_S_BA,
): number | null {
  if (!markers.length) return null;
  let num = 0;
  let den = 0;
  for (const m of markers) {
    if (!Number.isFinite(m.s) || m.s === 0) continue;
    num += ((m.x - m.q) * m.k) / (m.s * m.s);
    den += (m.k * m.k) / (m.s * m.s);
  }
  if (includeCa) {
    const s2 = sBa * sBa;
    num += chronological / s2;
    den += 1 / s2;
  }
  if (den <= 0) return null;
  return clampAge(num / den);
}

function systemAge(markers: Marker[], chronological: number): number | null {
  if (!markers.length) return null;
  return kdm(markers, chronological, true);
}

export type LivePhysiology = {
  rmssdMs?: number | null;
  restHr?: number | null;
};

export function estimateBioAge(
  data: Dashboard,
  athlete: Athlete,
  live?: LivePhysiology,
): BioAgeReport {
  const chronological = athlete.age;
  const days = buildDaySeries(data);
  const overnightHrv = lastSample(days.map((d) => d.hrv));
  const hrv =
    live?.rmssdMs != null && live.rmssdMs > 1
      ? { mean: live.rmssdMs, n: 1 }
      : overnightHrv;
  const rhrTrend = lastSample(days.map((d) => d.rhr));
  const spo2 = lastSample(days.map((d) => d.spo2));
  const resp = lastSample(days.map((d) => d.resp));
  const seFrac = lastSample(days.map((d) => d.sleepEff));
  const swsFrac = lastSample(days.map((d) => d.deepFrac));
  const tstHours = lastSample(
    days.map((d) =>
      d.inBedH != null && d.sleepEff != null ? d.inBedH * d.sleepEff : null,
    ),
  );

  const restHr = resolvedRestHr(
    athlete,
    live?.restHr ?? rhrTrend?.mean ?? null,
  );
  const maxHr = resolvedMaxHr(athlete, data.body.max_heart_rate || null);
  const hasMeasuredRest =
    (athlete.restHrOverride != null && athlete.restHrOverride >= 30) ||
    (live?.restHr != null && live.restHr >= 30) ||
    (rhrTrend != null && rhrTrend.mean >= 30);
  const vo2 = hasMeasuredRest && maxHr > restHr ? (15.3 * maxHr) / restHr : null;
  const vo2Repeats =
    athlete.restHrOverride != null && athlete.restHrOverride >= 30
      ? 1
      : Math.min(rhrTrend?.n ?? 1, 3);

  const weight = resolvedWeightKg(athlete, data.body.weight_kilogram, data.connected);
  const heightCm = resolvedHeightCm(athlete, data.body.height_meter, data.connected);
  const bmi = weight != null && heightCm != null ? bodyMassIndex(weight, heightCm) : null;
  const sbp = athlete.systolicMmHg;

  const vo2p = vo2Line(athlete.sex);
  const markers: Marker[] = [];
  const missing: string[] = [];

  const add = (row: Marker | null, need: string) => {
    if (row) markers.push(row);
    else missing.push(need);
  };

  add(
    vo2 != null
      ? {
          id: "vo2",
          system: "fitness",
          name: "VO2max (Uth × FRIEND)",
          x: vo2,
          q: vo2p.q,
          k: vo2p.k,
          s: effectiveResidual(vo2p.s, vo2Repeats),
          unit: "ml/kg/min",
          citation: "Uth 2004; Kaminsky FRIEND 2015",
        }
      : null,
    "VO2 from max/resting HR",
  );

  add(
    hrv != null
      ? {
          id: "ln-rmssd",
          system: "autonomic",
          name: live?.rmssdMs != null ? "ln RMSSD (live band)" : "ln RMSSD (7-night)",
          x: Math.log(Math.max(hrv.mean, 1)),
          q: 4.14,
          k: -0.015,
          s: effectiveResidual(0.36, hrv.n),
          unit: "ln ms",
          citation: "Umetani et al. 1998 JACC",
        }
      : null,
    "HRV RMSSD",
  );

  add(
    rhrTrend != null
      ? {
          id: "rhr",
          system: "autonomic",
          name: live?.restHr != null ? "Resting HR (live session)" : "Resting HR (7-night)",
          x: rhrTrend.mean,
          q: 61.5,
          k: 0.08,
          s: effectiveResidual(8.0, rhrTrend.n),
          unit: "bpm",
          citation: "Quer et al. 2020 Nat Digit Med",
        }
      : null,
    "Resting heart rate",
  );

  add(
    seFrac != null
      ? {
          id: "sleep-eff",
          system: "sleep",
          name: "Sleep efficiency (7-night)",
          x: seFrac.mean * 100,
          q: 97.2,
          k: -0.18,
          s: effectiveResidual(4.8, seFrac.n),
          unit: "%",
          citation: "Ohayon et al. 2004 Sleep Med Rev",
        }
      : null,
    "Sleep efficiency",
  );

  add(
    swsFrac != null
      ? {
          id: "sws",
          system: "sleep",
          name: "Slow-wave fraction (7-night)",
          x: swsFrac.mean * 100,
          q: 23.7,
          k: -0.24,
          s: effectiveResidual(5.5, swsFrac.n),
          unit: "% TST",
          citation: "Ohayon et al. 2004 Sleep Med Rev",
        }
      : null,
    "Slow-wave sleep",
  );

  add(
    tstHours != null
      ? {
          id: "tst",
          system: "sleep",
          name: "Total sleep time (7-night)",
          x: tstHours.mean,
          q: 7.85,
          k: -0.017,
          s: effectiveResidual(0.85, tstHours.n),
          unit: "h",
          citation: "Ohayon et al. 2004 Sleep Med Rev",
        }
      : null,
    "Total sleep time",
  );

  add(
    bmi != null
      ? {
          id: "bmi",
          system: "body",
          name: "BMI",
          x: bmi,
          q: 22.4,
          k: 0.055,
          s: 3.9,
          unit: "kg/m²",
          citation: "NHANES adult BMI vs age (linearized)",
        }
      : null,
    "Height and weight",
  );

  add(
    sbp != null
      ? {
          id: "sbp",
          system: "body",
          name: "Systolic blood pressure",
          x: sbp,
          q: 102,
          k: 0.48,
          s: 14,
          unit: "mmHg",
          citation: "Framingham / NHANES SBP vs age",
        }
      : null,
    "Systolic blood pressure (optional, Settings)",
  );

  add(
    spo2 != null
      ? {
          id: "spo2",
          system: "respiratory",
          name: "SpO2 (7-night)",
          x: spo2.mean,
          q: 98.15,
          k: -0.018,
          s: effectiveResidual(1.15, spo2.n),
          unit: "%",
          citation: "Adult overnight SpO2 vs age (wearable cohorts)",
        }
      : null,
    "Overnight SpO2",
  );

  add(
    resp != null
      ? {
          id: "rr",
          system: "respiratory",
          name: "Respiratory rate (7-night)",
          x: resp.mean,
          q: 14.4,
          k: 0.028,
          s: effectiveResidual(1.7, resp.n),
          unit: "/min",
          citation: "Sleep respiratory rate vs age",
        }
      : null,
    "Overnight respiratory rate",
  );

  const unconstrained = kdm(markers, chronological, false);
  const biological = markers.length >= 3 ? kdm(markers, chronological, true) : null;
  const delta = biological != null ? biological - chronological : null;

  const systems: BioAgeSystem[] = (
    [
      ["fitness", "Fitness"],
      ["autonomic", "Autonomic"],
      ["sleep", "Sleep"],
      ["body", "Body"],
      ["respiratory", "Oxygen"],
    ] as const
  ).map(([id, label]) => {
    const subset = markers.filter((m) => m.system === id);
    return {
      id,
      label,
      age: systemAge(subset, chronological),
      markers: subset.length,
    };
  });

  const rows: BioAgeMarkerRow[] = markers.map((m) => ({
    id: m.id,
    system: m.system,
    name: m.name,
    observed: m.x,
    expected: m.q + m.k * chronological,
    unit: m.unit,
    citation: m.citation,
  }));

  let confidence: BioAgeReport["confidence"] = "unavailable";
  if (biological != null) {
    if (markers.length >= 8) confidence = "high";
    else if (markers.length >= 5) confidence = "medium";
    else confidence = "low";
  }

  return {
    chronological,
    biological,
    unconstrained,
    delta,
    confidence,
    markersUsed: markers.length,
    markersPossible: 10,
    systems,
    rows,
    missing,
    method: "Klemera–Doubal KDM (CA as a biomarker; 7-night means)",
    citation: BIO_AGE_CITATION,
    notes: BIO_AGE_NOTES,
  };
}
