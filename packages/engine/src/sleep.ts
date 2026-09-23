/** Default sleep need: 7.5 hours, in milliseconds. */
export const DEFAULT_SLEEP_NEED_MS = 7.5 * 3_600_000;

/**
 * Sleep performance 0–100 from time asleep versus need.
 * Formula: round(min(100, restMs / needMs * 100)). Invalid inputs return 0.
 */
export function sleepPerformancePct(
  restMs: number,
  needMs = DEFAULT_SLEEP_NEED_MS,
): number {
  if (!(needMs > 0) || !Number.isFinite(restMs) || restMs < 0) return 0;
  return Math.round(Math.min(100, (restMs / needMs) * 100));
}

/**
 * Sleep efficiency 0–100 from time asleep versus time in bed.
 */
export function sleepEfficiencyPct(restMs: number, inBedMs: number): number {
  if (!(inBedMs > 0) || !Number.isFinite(restMs) || restMs < 0) return 0;
  return Math.round(Math.min(100, (restMs / inBedMs) * 100));
}
