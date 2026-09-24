/**
 * NWS Rothfusz heat index. Inputs °C and relative humidity %, output °C.
 * Below 80°F the index is the air temperature.
 */
export function heatIndexC(tempC: number, rh: number): number {
  if (!Number.isFinite(tempC)) return 0;
  if (!Number.isFinite(rh)) return tempC;
  const t = tempC * (9 / 5) + 32;
  const r = Math.max(0, Math.min(100, rh));
  if (t < 80) return tempC;
  let hi =
    -42.379 +
    2.04901523 * t +
    10.14333127 * r -
    0.22475541 * t * r -
    0.00683783 * t * t -
    0.05481717 * r * r +
    0.00122874 * t * t * r +
    0.00085282 * t * r * r -
    0.00000199 * t * t * r * r;
  if (r < 13 && t >= 80 && t <= 112) {
    hi -= ((13 - r) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
  }
  if (r > 85 && t >= 80 && t <= 87) {
    hi += ((r - 85) / 10) * ((87 - t) / 5);
  }
  return (hi - 32) * (5 / 9);
}

export type TrainingWindowHour = {
  iso: string;
  /** Local hour 0–23. */
  hour: number;
  atMs: number;
  tempC: number | null;
  uv: number | null;
  /** Precipitation probability 0–100. */
  precipChance: number | null;
};

/**
 * Best outdoor training hour over the next 36 hours.
 * Prefers daylight (06:00–20:00) closest to 16°C, with lower UV and rain chance.
 * Score = |tempC − 16| + 0.35·UV + 0.08·precipChance. Returns null when no hour qualifies.
 */
export function bestTrainingWindow<T extends TrainingWindowHour>(
  hours: readonly T[],
  nowMs: number,
): T | null {
  if (!Number.isFinite(nowMs)) return null;
  const daylight = hours.filter((hour) => hour.hour >= 6 && hour.hour <= 20);
  const upcoming = daylight.filter((hour) => hour.atMs >= nowMs - 30 * 60_000);
  const pool = (
    upcoming.length
      ? upcoming.filter((hour) => hour.atMs <= nowMs + 36 * 3_600_000)
      : daylight
  );
  if (!pool.length) return null;
  let best = pool[0];
  let bestScore = Infinity;
  for (const hour of pool) {
    const heat = hour.tempC ?? 20;
    const uv = hour.uv ?? 0;
    const rain = hour.precipChance ?? 0;
    const score = Math.abs(heat - 16) + uv * 0.35 + rain * 0.08;
    if (score < bestScore) {
      bestScore = score;
      best = hour;
    }
  }
  return best;
}

/**
 * Australian Bureau of Meteorology outdoor WBGT approximation (full sun).
 * WBGT ≈ 0.567 Ta + 0.393 e + 3.94, with e in hPa from temperature and humidity.
 * Output °C.
 */
export function bomWbgtC(tempC: number, rh: number): number {
  if (!Number.isFinite(tempC)) return 0;
  if (!Number.isFinite(rh)) return tempC;
  const e =
    (Math.max(0, rh) / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return 0.567 * tempC + 0.393 * e + 3.94;
}
