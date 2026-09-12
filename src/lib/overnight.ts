import type { Sleep } from "./types";

export const NIGHT_KEY = "aether-band-night-v1";
export const AETHER_OVERNIGHT_SLEEP_ID = "aether-overnight";

const MAX_AGE_MS = 16 * 3600_000;
const SUMMARY_WINDOW_MS = 14 * 3600_000;
const MIN_REST_MS = 45 * 60_000;
const MIN_POINTS = 40;
const MAX_GAP_MS = 180_000;
const NEED_MS = 7.5 * 3600_000;

export type NightPoint = {
  t: number;
  bpm: number;
  rmssd: number | null;
};

export type OvernightSummary = {
  start: number;
  end: number;
  restMs: number;
  awakeMs: number;
  rmssd: number | null;
  restHr: number | null;
  recovery: number | null;
  spo2: number | null;
  skinTempC: number | null;
  pointCount: number;
};

export type OvernightProgress = {
  restMs: number;
  durationMs: number;
  pointCount: number;
};

export function appendNightPoint(
  points: NightPoint[],
  next: NightPoint,
  minGapMs = 20_000,
): NightPoint[] {
  const last = points[points.length - 1];
  if (last && next.t - last.t < minGapMs) return points;
  return [...points, next].filter((p) => next.t - p.t <= MAX_AGE_MS);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function quietRestHr(bpmSamples: number[]): number | null {
  const rest = bpmSamples.filter((bpm) => bpm >= 38 && bpm <= 90);
  if (rest.length < 12) return null;
  const sorted = [...rest].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length * 0.1)]!);
}

function restCutBpm(bpms: number[]): { restHr: number | null; restCut: number } {
  const restHr = quietRestHr(bpms);
  return { restHr, restCut: restHr != null ? restHr + 12 : 70 };
}

function splitRestAwake(window: NightPoint[], restCut: number): { restMs: number; awakeMs: number } {
  let restMs = 0;
  let awakeMs = 0;
  for (let i = 1; i < window.length; i += 1) {
    const dt = Math.min(window[i]!.t - window[i - 1]!.t, MAX_GAP_MS);
    if (window[i]!.bpm <= restCut && window[i]!.bpm >= 38) restMs += dt;
    else awakeMs += dt;
  }
  return { restMs, awakeMs };
}

/** Quiet vs active heart rate while the public HR stream stayed open — not WHOOP stages. */
export function summarizeOvernight(
  points: NightPoint[],
  now = Date.now(),
): OvernightSummary | null {
  const window = points.filter((p) => now - p.t <= SUMMARY_WINDOW_MS && p.t <= now);
  if (window.length < MIN_POINTS) return null;
  const bpms = window.map((p) => p.bpm);
  const { restHr, restCut } = restCutBpm(bpms);
  const { restMs, awakeMs } = splitRestAwake(window, restCut);
  if (restMs < MIN_REST_MS) return null;
  const hrvSamples = window
    .map((p) => p.rmssd)
    .filter((v): v is number => v != null);
  const rmssd = hrvSamples.length ? Math.round(median(hrvSamples)) : null;
  return {
    start: window[0]!.t,
    end: window[window.length - 1]!.t,
    restMs,
    awakeMs,
    rmssd,
    restHr,
    recovery: overnightRecovery(rmssd, restHr, restMs),
    spo2: null,
    skinTempC: null,
    pointCount: window.length,
  };
}

export function overnightProgress(
  points: NightPoint[],
  now = Date.now(),
): OvernightProgress {
  const window = points.filter((p) => now - p.t <= SUMMARY_WINDOW_MS && p.t <= now);
  if (window.length < 2) {
    return { restMs: 0, durationMs: 0, pointCount: window.length };
  }
  const { restCut } = restCutBpm(window.map((p) => p.bpm));
  const { restMs, awakeMs } = splitRestAwake(window, restCut);
  return {
    restMs,
    durationMs: restMs + awakeMs,
    pointCount: window.length,
  };
}

export function overnightRecovery(
  rmssd: number | null,
  restHr: number | null,
  restMs: number,
): number {
  let score = 50;
  if (rmssd != null) score += Math.max(-20, Math.min(25, (rmssd - 50) * 0.4));
  if (restHr != null) score += Math.max(-15, Math.min(15, (60 - restHr) * 0.7));
  const hours = restMs / 3_600_000;
  score += Math.max(-15, Math.min(15, (hours - 7) * 6));
  return Math.round(Math.min(99, Math.max(1, score)));
}

export function mergeOvernight(
  stored: OvernightSummary | null,
  computed: OvernightSummary | null,
  now = Date.now(),
): OvernightSummary | null {
  if (computed) {
    if (!stored) return computed;
    if (computed.start - stored.end > 6 * 3600_000) return computed;
    return computed.restMs >= stored.restMs ? computed : stored;
  }
  if (stored && now - stored.end <= 20 * 3600_000) return stored;
  return null;
}

export function attachVitalsToOvernight(
  overnight: OvernightSummary | null,
  spo2: number | null,
  skinTempC: number | null,
): OvernightSummary | null {
  if (!overnight) return null;
  return {
    ...overnight,
    spo2: spo2 ?? overnight.spo2,
    skinTempC: skinTempC ?? overnight.skinTempC,
  };
}

export function parseOvernightSummary(raw: unknown): OvernightSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<OvernightSummary>;
  if (typeof row.start !== "number" || typeof row.end !== "number") return null;
  if (typeof row.restMs !== "number" || typeof row.awakeMs !== "number") return null;
  return {
    start: row.start,
    end: row.end,
    restMs: row.restMs,
    awakeMs: row.awakeMs,
    rmssd: numOrNull(row.rmssd),
    restHr: numOrNull(row.restHr),
    recovery: numOrNull(row.recovery),
    spo2: numOrNull(row.spo2),
    skinTempC: numOrNull(row.skinTempC),
    pointCount: typeof row.pointCount === "number" ? row.pointCount : 0,
  };
}

export function parseNightLog(raw: string | null | undefined): NightPoint[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const point = row as Partial<NightPoint>;
      if (typeof point.t !== "number" || typeof point.bpm !== "number") return [];
      return [{ t: point.t, bpm: point.bpm, rmssd: numOrNull(point.rmssd) }];
    });
  } catch {
    return [];
  }
}

export function loadNightLog(): NightPoint[] {
  if (typeof window === "undefined") return [];
  return parseNightLog(window.localStorage.getItem(NIGHT_KEY));
}

export function saveNightLog(points: NightPoint[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NIGHT_KEY, JSON.stringify(points));
}

export function sleepFromOvernight(
  summary: OvernightSummary,
  template?: Sleep | null,
): Sleep {
  const inBed = summary.restMs + summary.awakeMs;
  const efficiency =
    inBed > 0 ? Math.round((summary.restMs / inBed) * 1000) / 10 : 0;
  const performance = Math.round(Math.min(100, (summary.restMs / NEED_MS) * 100));
  const start = new Date(summary.start).toISOString();
  const end = new Date(summary.end).toISOString();
  return {
    id: AETHER_OVERNIGHT_SLEEP_ID,
    cycle_id: template?.cycle_id ?? 0,
    v1_id: template?.v1_id ?? 0,
    user_id: template?.user_id ?? 0,
    created_at: end,
    updated_at: end,
    start,
    end,
    timezone_offset: template?.timezone_offset ?? "+00:00",
    nap: false,
    score_state: "SCORED",
    score: {
      stage_summary: {
        total_in_bed_time_milli: inBed,
        total_awake_time_milli: summary.awakeMs,
        total_no_data_time_milli: 0,
        total_light_sleep_time_milli: summary.restMs,
        total_slow_wave_sleep_time_milli: 0,
        total_rem_sleep_time_milli: 0,
        sleep_cycle_count: 0,
        disturbance_count: 0,
      },
      sleep_needed: {
        baseline_milli: NEED_MS,
        need_from_sleep_debt_milli: 0,
        need_from_recent_strain_milli: 0,
        need_from_recent_nap_milli: 0,
      },
      respiratory_rate: 0,
      sleep_performance_percentage: performance,
      sleep_consistency_percentage: 0,
      sleep_efficiency_percentage: efficiency,
    },
  };
}

export function isAetherOvernightSleep(id: string | null | undefined): boolean {
  return id === AETHER_OVERNIGHT_SLEEP_ID;
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
