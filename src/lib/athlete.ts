export type Sex = "female" | "male" | "unspecified";

export type Athlete = {
  age: number;
  sex: Sex;
  maxHrOverride: number | null;
  cycleDay: number | null;
};

export const DEFAULT_ATHLETE: Athlete = {
  age: 32,
  sex: "unspecified",
  maxHrOverride: null,
  cycleDay: null,
};

const KEY = "aether-athlete-v1";

export function loadAthlete(): Athlete {
  if (typeof window === "undefined") return { ...DEFAULT_ATHLETE };
  try {
    return { ...DEFAULT_ATHLETE, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULT_ATHLETE };
  }
}

export function saveAthlete(athlete: Athlete) {
  localStorage.setItem(KEY, JSON.stringify(athlete));
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
