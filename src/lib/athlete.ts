export type Sex = "female" | "male" | "unspecified";
export type Units = "metric" | "imperial";

export type Athlete = {
  displayName: string;
  age: number;
  sex: Sex;
  heightCm: number | null;
  weightKg: number | null;
  units: Units;
  maxHrOverride: number | null;
  restHrOverride: number | null;
  /** When on, cycle day is counted from cycleStart. */
  cycleTracking: boolean;
  /** Local calendar date, YYYY-MM-DD. */
  cycleStart: string | null;
  cycleDay: number | null;
  systolicMmHg: number | null;
};

export const DEFAULT_ATHLETE: Athlete = {
  displayName: "",
  age: 32,
  sex: "unspecified",
  heightCm: null,
  weightKg: null,
  units: "metric",
  maxHrOverride: null,
  restHrOverride: null,
  cycleTracking: false,
  cycleStart: null,
  cycleDay: null,
  systolicMmHg: null,
};

const KEY = "aether-athlete-v1";
const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;
const DAY_MS = 24 * 60 * 60 * 1000;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function validWeightKg(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 30 && value <= 250;
}

export function validHeightCm(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 120 && value <= 230;
}

export function validSystolicMmHg(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 80 && value <= 220;
}

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalIn = cm / CM_PER_IN;
  let feet = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_IN;
}

export function validCycleStart(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return value;
}

function isoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Day 1 is the start date. The count repeats every 28 days. */
export function cycleDayFromStart(start: string | null, now = new Date()): number | null {
  const valid = validCycleStart(start);
  if (!valid) return null;
  const startDate = new Date(`${valid}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - startDate.getTime()) / DAY_MS);
  if (days < 0) return null;
  return (days % 28) + 1;
}

export function sanitizeAthlete(raw: Partial<Athlete> | null | undefined): Athlete {
  const merged = { ...DEFAULT_ATHLETE, ...(raw ?? {}) };
  const age = Number(merged.age);
  const height = merged.heightCm == null ? null : Number(merged.heightCm);
  const weight = merged.weightKg == null ? null : Number(merged.weightKg);
  const maxHr = merged.maxHrOverride == null ? null : Number(merged.maxHrOverride);
  const restHr = merged.restHrOverride == null ? null : Number(merged.restHrOverride);
  const cycle = merged.cycleDay == null ? null : Number(merged.cycleDay);
  const sbp = merged.systolicMmHg == null ? null : Number(merged.systolicMmHg);
  const name = typeof merged.displayName === "string" ? merged.displayName.slice(0, 40) : "";
  const legacyDay = cycle && cycle >= 1 && cycle <= 28 ? Math.round(cycle) : null;
  const rawTracking = raw?.cycleTracking;
  let cycleStart = validCycleStart(raw?.cycleStart);
  if (rawTracking == null && !cycleStart && legacyDay != null) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (legacyDay - 1));
    cycleStart = isoDate(date);
  }
  const cycleTracking = rawTracking === true || (rawTracking == null && cycleStart != null);
  if (!cycleTracking) cycleStart = null;
  return {
    displayName: name,
    age: Number.isFinite(age) ? clamp(Math.round(age), 16, 90) : DEFAULT_ATHLETE.age,
    sex: merged.sex === "female" || merged.sex === "male" ? merged.sex : "unspecified",
    heightCm: validHeightCm(height) ? Math.round(height * 10) / 10 : null,
    weightKg: validWeightKg(weight) ? Math.round(weight * 10) / 10 : null,
    units: merged.units === "imperial" ? "imperial" : "metric",
    maxHrOverride: maxHr && maxHr >= 120 && maxHr <= 230 ? Math.round(maxHr) : null,
    restHrOverride: restHr && restHr >= 30 && restHr <= 110 ? Math.round(restHr) : null,
    cycleTracking,
    cycleStart,
    cycleDay: cycleTracking ? cycleDayFromStart(cycleStart) : null,
    systolicMmHg: validSystolicMmHg(sbp) ? Math.round(sbp) : null,
  };
}

export function loadAthlete(): Athlete {
  if (typeof window === "undefined") return { ...DEFAULT_ATHLETE };
  try {
    return sanitizeAthlete(JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Athlete>);
  } catch {
    return { ...DEFAULT_ATHLETE };
  }
}

export function saveAthlete(athlete: Athlete) {
  localStorage.setItem(KEY, JSON.stringify(sanitizeAthlete(athlete)));
}

/** Personal entry first. WHOOP body only when that band is actually connected. */
export function resolvedWeightKg(
  athlete: Athlete,
  bodyWeightKg?: number | null,
  connected = false,
): number | null {
  if (validWeightKg(athlete.weightKg)) return athlete.weightKg;
  if (connected && validWeightKg(bodyWeightKg)) return bodyWeightKg;
  return null;
}

export function resolvedHeightCm(
  athlete: Athlete,
  bodyHeightM?: number | null,
  connected = false,
): number | null {
  if (validHeightCm(athlete.heightCm)) return athlete.heightCm;
  const fromBand = bodyHeightM != null ? bodyHeightM * 100 : null;
  if (connected && validHeightCm(fromBand)) return Math.round(fromBand * 10) / 10;
  return null;
}

export function resolvedRestHr(athlete: Athlete, measured?: number | null): number {
  if (athlete.restHrOverride && athlete.restHrOverride >= 30) return athlete.restHrOverride;
  if (measured && measured >= 30) return measured;
  return 60;
}

export function greetingName(
  athlete: Athlete,
  profileName?: string | null,
  connected = false,
): string {
  const personal = athlete.displayName.trim();
  if (personal) return personal.split(/\s+/)[0];
  const band = connected ? (profileName ?? "").trim() : "";
  if (band) return band.split(/\s+/)[0];
  return "there";
}

export function hasPersonalBody(athlete: Athlete): boolean {
  return validHeightCm(athlete.heightCm) && validWeightKg(athlete.weightKg);
}

export function bodyMassIndex(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function tanakaMaxHr(age: number): number {
  return 208 - 0.7 * age;
}

export function foxMaxHr(age: number): number {
  return 220 - age;
}

export function gellishMaxHr(age: number): number {
  return 207 - 0.7 * age;
}

/** Nes, Janszky, Wisløff, Støylen 2013, Scand J Med Sci Sports. */
export function nesMaxHr(age: number): number {
  return 211 - 0.64 * age;
}

/** Gulati et al. 2010, Circulation — derived in women. */
export function gulatiMaxHr(age: number): number {
  return 206 - 0.88 * age;
}

export function resolvedMaxHr(athlete: Athlete, whoopMax?: number | null): number {
  if (athlete.maxHrOverride && athlete.maxHrOverride > 100) return athlete.maxHrOverride;
  if (whoopMax && whoopMax > 100) return whoopMax;
  return Math.round(tanakaMaxHr(athlete.age));
}
