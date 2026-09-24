const ZONE_EDGES = [0.5, 0.6, 0.7, 0.8, 0.9];

/** Zone 0–5 from bpm and max heart rate. Same edges as the live session math. */
export function zoneIndex(bpm: number, maxHr: number): number {
  if (!(maxHr > 0) || !(bpm > 0)) return 0;
  const fraction = bpm / maxHr;
  let zone = 0;
  for (const edge of ZONE_EDGES) {
    if (fraction >= edge) zone += 1;
  }
  return zone;
}

/**
 * Exponential approach to `target`. `tauMs` is the time constant.
 * A non-positive tau snaps to the target (reduced motion).
 */
export function smoothToward(current: number, target: number, dtMs: number, tauMs: number): number {
  if (!Number.isFinite(target)) return current;
  if (!Number.isFinite(current) || tauMs <= 0 || dtMs <= 0) return target;
  const gain = 1 - Math.exp(-dtMs / tauMs);
  return current + (target - current) * gain;
}

/** Accessible heart-rate text is allowed to change only on this interval. */
export function announceDue(nowMs: number, lastMs: number, everyMs = 15_000): boolean {
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastMs)) return false;
  return nowMs - lastMs >= everyMs;
}

export function prefersReducedMotion(): boolean {
  if (typeof matchMedia !== "function") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const ZONE_COLORS = ["#5b564c", "#7ad7ff", "#d6ff4b", "#f0c14b", "#ff5c2a", "#ff2d55"];
