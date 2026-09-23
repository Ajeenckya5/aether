import { sleepPerformancePct } from "@ajeenckya/engine";
import {
  analyzeAetherSleep,
  hasAetherSleepArchitecture,
  type AetherSleepEpoch,
} from "./aether-sleep";
import type { Sleep } from "./types";

export const NIGHT_KEY = "aether-band-night-v1";
export const AETHER_OVERNIGHT_SLEEP_ID = "aether-overnight";

const MAX_AGE_MS = 16 * 3600_000;
const SUMMARY_WINDOW_MS = 14 * 3600_000;
const MIN_REST_MS = 45 * 60_000;
const MIN_POINTS = 40;
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
  quietMs: number;
  deepMs: number;
  activeMs: number;
  cycles: number;
  disturbances: number;
  staged: boolean;
  epochs: AetherSleepEpoch[];
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
  quietMs: number;
  deepMs: number;
  activeMs: number;
  staged: boolean;
};

export function appendNightPoint(
  points: NightPoint[],
  next: NightPoint,
  minGapMs = 20_000,
): NightPoint[] {
  const merged = [...points, next].sort((a, b) => a.t - b.t);
  const out: NightPoint[] = [];
  for (const point of merged) {
    const prev = out[out.length - 1];
    if (prev && point.t - prev.t < minGapMs) continue;
    out.push(point);
  }
  const newest = out[out.length - 1]?.t ?? next.t;
  return out.filter((point) => newest - point.t <= MAX_AGE_MS);
}

/** Quiet vs active heart rate while the public HR stream stayed open — not WHOOP stages. */
export function summarizeOvernight(
  points: NightPoint[],
  now = Date.now(),
): OvernightSummary | null {
  const analysis = analyzeAetherSleep(points, now, SUMMARY_WINDOW_MS);
  if (!analysis) return null;
  if (analysis.pointCount < MIN_POINTS) return null;
  if (analysis.restMs < MIN_REST_MS) return null;
  return {
    start: analysis.start,
    end: analysis.end,
    restMs: analysis.restMs,
    awakeMs: analysis.awakeMs,
    quietMs: analysis.quietMs,
    deepMs: analysis.deepMs,
    activeMs: analysis.activeMs,
    cycles: analysis.cycles,
    disturbances: analysis.disturbances,
    staged: analysis.staged,
    epochs: analysis.epochs,
    rmssd: analysis.rmssd,
    restHr: analysis.restHr,
    recovery: overnightRecovery(analysis.rmssd, analysis.restHr, analysis.restMs),
    spo2: null,
    skinTempC: null,
    pointCount: analysis.pointCount,
  };
}

export function overnightProgress(
  points: NightPoint[],
  now = Date.now(),
): OvernightProgress {
  const analysis = analyzeAetherSleep(points, now, SUMMARY_WINDOW_MS);
  if (!analysis) {
    return {
      restMs: 0,
      durationMs: 0,
      pointCount: points.filter((p) => now - p.t <= SUMMARY_WINDOW_MS && p.t <= now)
        .length,
      quietMs: 0,
      deepMs: 0,
      activeMs: 0,
      staged: false,
    };
  }
  return {
    restMs: analysis.restMs,
    durationMs: analysis.restMs + analysis.awakeMs,
    pointCount: analysis.pointCount,
    quietMs: analysis.quietMs,
    deepMs: analysis.deepMs,
    activeMs: analysis.activeMs,
    staged: analysis.staged,
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
  const quietMs = typeof row.quietMs === "number" ? row.quietMs : row.restMs;
  const deepMs = typeof row.deepMs === "number" ? row.deepMs : 0;
  const activeMs = typeof row.activeMs === "number" ? row.activeMs : 0;
  return {
    start: row.start,
    end: row.end,
    restMs: row.restMs,
    awakeMs: row.awakeMs,
    quietMs,
    deepMs,
    activeMs,
    cycles: typeof row.cycles === "number" ? row.cycles : 0,
    disturbances: typeof row.disturbances === "number" ? row.disturbances : 0,
    staged: Boolean(row.staged) || hasAetherSleepArchitecture({ deepMs, activeMs, staged: row.staged }),
    epochs: parseEpochs(row.epochs),
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
  const performance = sleepPerformancePct(summary.restMs, NEED_MS);
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
        total_light_sleep_time_milli: summary.quietMs,
        total_slow_wave_sleep_time_milli: summary.deepMs,
        total_rem_sleep_time_milli: summary.activeMs,
        sleep_cycle_count: summary.cycles,
        disturbance_count: summary.disturbances,
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

export function scoredSleepMs(stages: {
  total_in_bed_time_milli: number;
  total_light_sleep_time_milli: number;
  total_slow_wave_sleep_time_milli: number;
  total_rem_sleep_time_milli: number;
  total_awake_time_milli: number;
}, asleep: boolean): number {
  if (!asleep) return stages.total_in_bed_time_milli;
  const tst =
    stages.total_light_sleep_time_milli +
    stages.total_slow_wave_sleep_time_milli +
    stages.total_rem_sleep_time_milli;
  return tst > 0 ? tst : stages.total_in_bed_time_milli - stages.total_awake_time_milli;
}

function parseEpochs(raw: unknown): AetherSleepEpoch[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const epoch = row as Partial<AetherSleepEpoch>;
    if (typeof epoch.t !== "number" || typeof epoch.durMs !== "number") return [];
    if (!isPhase(epoch.phase)) return [];
    return [{ t: epoch.t, durMs: epoch.durMs, phase: epoch.phase }];
  });
}

function isPhase(value: unknown): value is AetherSleepEpoch["phase"] {
  return value === "wake" || value === "quiet" || value === "deep" || value === "active";
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
