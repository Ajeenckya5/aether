import type { Dashboard, Recovery, Sleep, Workout, ZoneDurations } from "./types";

export const HISTORY_DAYS = 90;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const RETENTION_MS = HISTORY_DAYS * DAY_MS;
/** Fitness CTL uses a 42-day average, so a 90-day chart needs the days just before the on-device window. */
export const TREND_WARMUP_MS = 42 * DAY_MS;

export type StoredNight = {
  kind: "night";
  at: number;
  end: string;
  restMs: number;
  awakeMs: number;
  quietMs: number;
  deepMs: number;
  activeMs: number;
  rmssd: number | null;
  restHr: number | null;
  recovery: number | null;
};

export type StoredWorkout = {
  kind: "workout";
  at: number;
  id: string;
  start: string;
  end: string;
  sport: string;
  strain: number;
  avgHr: number | null;
  maxHr: number | null;
  distanceM: number | null;
  zoneMs: [number, number, number, number, number, number];
};

export type StoredRecord = StoredNight | StoredWorkout;

export type Ciphertext = { v: 1; iv: string; ct: string };

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function splitByAge<T extends { at: number }>(
  rows: T[],
  now: number,
  retentionMs = RETENTION_MS,
): { recent: T[]; older: T[] } {
  const cutoff = now - retentionMs;
  const recent: T[] = [];
  const older: T[] = [];
  for (const row of rows) {
    if (!Number.isFinite(row.at) || row.at >= cutoff) recent.push(row);
    else older.push(row);
  }
  return { recent, older };
}

/** Days the chart must read from the backup because they sit before the 90-day device window. */
export function archiveWindow(now: number, trendDays: number): { from: number; to: number } | null {
  const trendStart = now - trendDays * DAY_MS;
  const warmupStart = trendStart - TREND_WARMUP_MS;
  const retentionStart = now - RETENTION_MS;
  if (warmupStart >= retentionStart) return null;
  return { from: warmupStart, to: retentionStart };
}

export function ciphertextBody(input: unknown): Ciphertext | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 3 || record.v !== 1) return null;
  if (!keys.includes("v") || !keys.includes("iv") || !keys.includes("ct")) return null;
  if (typeof record.iv !== "string" || typeof record.ct !== "string") return null;
  if (!B64.test(record.iv) || !B64.test(record.ct)) return null;
  if (record.iv.length > 64 || record.ct.length > 200_000) return null;
  return { v: 1, iv: record.iv, ct: record.ct };
}

export function blobId(id: string): string | null {
  return /^[a-f0-9]{32}$/.test(id) ? id : null;
}

export function mergeArchived(data: Dashboard, rows: StoredRecord[]): Dashboard {
  if (rows.length === 0) return data;
  const sleeps = [...data.sleeps];
  const workouts = [...data.workouts];
  const recoveries = [...data.recoveries];
  const sleepDays = new Set(sleeps.map((sleep) => sleep.end.slice(0, 10)));
  const workoutIds = new Set(workouts.map((workout) => workout.id));
  for (const row of rows) {
    if (row.kind === "night") {
      const day = row.end.slice(0, 10);
      if (sleepDays.has(day)) continue;
      sleepDays.add(day);
      sleeps.push(nightToSleep(row));
      if (row.recovery != null || row.rmssd != null || row.restHr != null) recoveries.push(nightToRecovery(row));
    } else if (!workoutIds.has(row.id)) {
      workoutIds.add(row.id);
      workouts.push(workoutToDashboard(row));
    }
  }
  return { ...data, sleeps, workouts, recoveries };
}

function nightToSleep(night: StoredNight): Sleep {
  const inBed = night.restMs + night.awakeMs;
  const end = night.end;
  const start = new Date(night.at - inBed).toISOString();
  const efficiency = inBed > 0 ? Math.round((night.restMs / inBed) * 1000) / 10 : 0;
  return {
    id: `archive-${night.at}`,
    cycle_id: 0,
    v1_id: 0,
    user_id: 0,
    created_at: end,
    updated_at: end,
    start,
    end,
    timezone_offset: "+00:00",
    nap: false,
    score_state: "SCORED",
    score: {
      stage_summary: {
        total_in_bed_time_milli: inBed,
        total_awake_time_milli: night.awakeMs,
        total_no_data_time_milli: 0,
        total_light_sleep_time_milli: night.quietMs,
        total_slow_wave_sleep_time_milli: night.deepMs,
        total_rem_sleep_time_milli: night.activeMs,
        sleep_cycle_count: 0,
        disturbance_count: 0,
      },
      sleep_needed: {
        baseline_milli: 7.5 * 3600_000,
        need_from_sleep_debt_milli: 0,
        need_from_recent_strain_milli: 0,
        need_from_recent_nap_milli: 0,
      },
      respiratory_rate: 0,
      sleep_performance_percentage: efficiency,
      sleep_consistency_percentage: 0,
      sleep_efficiency_percentage: efficiency,
    },
  };
}

function nightToRecovery(night: StoredNight): Recovery {
  return {
    cycle_id: 0,
    sleep_id: `archive-${night.at}`,
    user_id: 0,
    created_at: night.end,
    updated_at: night.end,
    score_state: "SCORED",
    score: {
      user_calibrating: false,
      recovery_score: night.recovery ?? 0,
      resting_heart_rate: night.restHr ?? 0,
      hrv_rmssd_milli: night.rmssd ?? 0,
      spo2_percentage: null,
      skin_temp_celsius: null,
    },
  };
}

function workoutToDashboard(workout: StoredWorkout): Workout {
  const zones = workout.zoneMs;
  const zone_durations: ZoneDurations = {
    zone_zero_milli: zones[0] ?? 0,
    zone_one_milli: zones[1] ?? 0,
    zone_two_milli: zones[2] ?? 0,
    zone_three_milli: zones[3] ?? 0,
    zone_four_milli: zones[4] ?? 0,
    zone_five_milli: zones[5] ?? 0,
  };
  return {
    id: workout.id,
    v1_id: 0,
    user_id: 0,
    created_at: workout.start,
    updated_at: workout.end,
    start: workout.start,
    end: workout.end,
    timezone_offset: "+00:00",
    sport_name: workout.sport,
    sport_id: 0,
    score_state: "SCORED",
    score: {
      strain: workout.strain,
      average_heart_rate: workout.avgHr ?? 0,
      max_heart_rate: workout.maxHr ?? 0,
      kilojoule: 0,
      percent_recorded: 100,
      distance_meter: workout.distanceM,
      altitude_gain_meter: null,
      altitude_change_meter: null,
      zone_durations,
    },
  };
}
