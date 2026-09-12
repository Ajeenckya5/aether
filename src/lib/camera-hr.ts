export type PpgSample = { t: number; v: number };

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** True when the frame is a saturated red/pink finger-over-lens, not a room view. */
export function fingerLikelyOnLens(meanRed: number): boolean {
  return meanRed >= 90;
}

/**
 * Peak-interval BPM from a short PPG window (finger on camera).
 * Samples should be ~15–30 Hz. Returns null until a plausible pulse is stable.
 */
export function estimateBpmFromPpg(
  samples: PpgSample[],
  now = samples.at(-1)?.t ?? 0,
): number | null {
  const windowed = samples.filter((s) => now - s.t <= 8000);
  if (windowed.length < 24) return null;
  const values = windowed.map((s) => s.v);
  const avg = mean(values);
  const centered = values.map((v) => v - avg);
  const peaks: number[] = [];
  for (let i = 1; i < centered.length - 1; i++) {
    if (
      centered[i] > centered[i - 1] &&
      centered[i] > centered[i + 1] &&
      centered[i] > 0
    ) {
      peaks.push(windowed[i].t);
    }
  }
  const spaced: number[] = [];
  for (const t of peaks) {
    if (!spaced.length || t - spaced[spaced.length - 1] >= 300) spaced.push(t);
  }
  if (spaced.length < 4) return null;
  const intervals: number[] = [];
  for (let i = 1; i < spaced.length; i++) intervals.push(spaced[i] - spaced[i - 1]);
  intervals.sort((a, b) => a - b);
  const mid = intervals[Math.floor(intervals.length / 2)];
  if (mid <= 0) return null;
  const bpm = 60_000 / mid;
  if (bpm < 40 || bpm > 180) return null;
  return Math.round(bpm);
}
