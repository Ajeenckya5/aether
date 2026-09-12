import type { Workout, ZoneDurations } from "./types";

export type HrPoint = {
  t: number;
  bpm: number;
  zone: number;
};

const ZONE_BPM = [
  [0.48, 0.56],
  [0.56, 0.62],
  [0.62, 0.7],
  [0.7, 0.8],
  [0.8, 0.9],
  [0.9, 1.0],
];

function zoneOrder(z: ZoneDurations): number[] {
  return [
    z.zone_zero_milli,
    z.zone_one_milli,
    z.zone_two_milli,
    z.zone_three_milli,
    z.zone_four_milli,
    z.zone_five_milli,
  ];
}

export function workoutDurationMs(workout: Workout): number {
  return Math.max(
    60_000,
    new Date(workout.end).getTime() - new Date(workout.start).getTime(),
  );
}

export function buildHrCurve(workout: Workout, samples = 240): HrPoint[] {
  const score = workout.score;
  const duration = workoutDurationMs(workout);
  const maxHr = score?.max_heart_rate ?? 180;
  const avgHr = score?.average_heart_rate ?? 130;
  const zones = score?.zone_durations;

  if (!zones) {
    return Array.from({ length: samples }, (_, i) => {
      const t = i / (samples - 1);
      const wave = Math.sin(t * Math.PI) * 0.7 + Math.sin(t * 18) * 0.08;
      const bpm = Math.round(avgHr - 18 + wave * (maxHr - avgHr + 18));
      return { t: t * duration, bpm, zone: 2 };
    });
  }

  const parts = zoneOrder(zones);
  const total = parts.reduce((a, b) => a + b, 0) || duration;
  const timeline: { start: number; end: number; zone: number }[] = [];
  let cursor = 0;
  parts.forEach((ms, zone) => {
    if (ms <= 0) return;
    timeline.push({ start: cursor, end: cursor + ms, zone });
    cursor += ms;
  });

  return Array.from({ length: samples }, (_, i) => {
    const tAbs = (i / (samples - 1)) * total;
    const slice =
      timeline.find((s) => tAbs >= s.start && tAbs <= s.end) ??
      timeline[timeline.length - 1] ?? { start: 0, end: total, zone: 2 };
    const [lo, hi] = ZONE_BPM[slice.zone] ?? [0.6, 0.75];
    const local =
      (tAbs - slice.start) / Math.max(1, slice.end - slice.start);
    const jitter = Math.sin(i * 0.55) * 0.04 + Math.sin(i * 0.13) * 0.02;
    const frac = lo + (hi - lo) * (0.35 + 0.65 * Math.sin(local * Math.PI)) + jitter;
    const bpm = Math.round(
      Math.min(maxHr, Math.max(avgHr - 35, frac * maxHr)),
    );
    return { t: (i / (samples - 1)) * duration, bpm, zone: slice.zone };
  });
}

export function zonePercents(z: ZoneDurations | null | undefined) {
  const parts = z
    ? [
        z.zone_zero_milli,
        z.zone_one_milli,
        z.zone_two_milli,
        z.zone_three_milli,
        z.zone_four_milli,
        z.zone_five_milli,
      ]
    : [0, 0, 0, 0, 0, 0];
  const total = parts.reduce((a, b) => a + b, 0) || 1;
  return parts.map((ms) => ms / total);
}
