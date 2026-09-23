/**
 * NWS Rothfusz heat index. Inputs °C and relative humidity %, output °C.
 * Below 80°F the index is the air temperature.
 */
export function heatIndexC(tempC: number, rh: number): number {
  if (!Number.isFinite(tempC) || !Number.isFinite(rh)) return Number.NaN;
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

/**
 * Australian Bureau of Meteorology outdoor WBGT approximation (full sun).
 * WBGT ≈ 0.567 Ta + 0.393 e + 3.94, with e in hPa from temperature and humidity.
 * Output °C.
 */
export function bomWbgtC(tempC: number, rh: number): number {
  if (!Number.isFinite(tempC) || !Number.isFinite(rh)) return Number.NaN;
  const e =
    (Math.max(0, rh) / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  return 0.567 * tempC + 0.393 * e + 3.94;
}
