import type { CoachBlock, CoachSession } from "./coach";
import { mediaForSport } from "./media";

export type TrainingLevel = "Recover" | "Build" | "Push";

export type WorkoutBlock = {
  id: string;
  title: string;
  seconds: number;
  cue: string;
  targetZone: number | null;
};

export type CustomWorkout = {
  id: string;
  title: string;
  sport: string;
  level: TrainingLevel;
  summary: string;
  blocks: WorkoutBlock[];
  createdAt: string;
  updatedAt: string;
};

export type LiveSample = {
  t: number;
  bpm: number | null;
  lat: number | null;
  lon: number | null;
};

export type LiveLog = {
  id: string;
  title: string;
  sport: string;
  planId: string | null;
  source: "strap" | "practice" | "none";
  start: string;
  end: string;
  durationMs: number;
  samples: LiveSample[];
  avgHr: number | null;
  maxHr: number | null;
  distanceM: number | null;
  zoneMs: [number, number, number, number, number, number];
  edwardsTrimp: number;
  strainProxy: number;
  gps: boolean;
};

const WORKOUT_KEY = "aether-custom-workouts-v1";
const LOG_KEY = "aether-live-logs-v1";
const DRAFT_KEY = "aether-live-draft-v1";
export const LOCAL_SYNC_EVENT = "aether-local";

function notifyLocal() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LOCAL_SYNC_EVENT));
}

export const BUILDER_SPORTS = [
  "running",
  "cycling",
  "walking",
  "weightlifting",
  "hiit",
  "yoga",
  "hiking",
  "rowing",
  "swimming",
  "functional-fitness",
  "boxing",
] as const;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export function uid(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}`;
}

export function emptyBlock(): WorkoutBlock {
  return {
    id: uid("bk"),
    title: "Block",
    seconds: 60,
    cue: "",
    targetZone: null,
  };
}

export function loadCustomWorkouts(): CustomWorkout[] {
  const rows = readJson<CustomWorkout[]>(WORKOUT_KEY, []);
  return rows.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export function saveCustomWorkouts(rows: CustomWorkout[]) {
  localStorage.setItem(WORKOUT_KEY, JSON.stringify(rows));
  notifyLocal();
}

export function getCustomWorkout(id: string): CustomWorkout | undefined {
  return loadCustomWorkouts().find((w) => w.id === id);
}

export function upsertCustomWorkout(workout: CustomWorkout) {
  const rows = loadCustomWorkouts().filter((w) => w.id !== workout.id);
  rows.unshift({ ...workout, updatedAt: new Date().toISOString() });
  saveCustomWorkouts(rows);
}

export function deleteCustomWorkout(id: string) {
  saveCustomWorkouts(loadCustomWorkouts().filter((w) => w.id !== id));
}

export function workoutDurationSec(workout: CustomWorkout): number {
  return workout.blocks.reduce((sum, b) => sum + b.seconds, 0);
}

export function asCoachSession(workout: CustomWorkout): CoachSession {
  const media = mediaForSport(workout.sport);
  const blocks: CoachBlock[] = workout.blocks.map((b) => ({
    title: b.title,
    seconds: b.seconds,
    cue: b.cue || (b.targetZone != null ? `Hold zone ${b.targetZone}` : "Stay with the clock."),
  }));
  return {
    slug: workout.id,
    title: workout.title,
    kicker: "Yours",
    durationMin: Math.max(1, Math.round(workoutDurationSec(workout) / 60)),
    level: workout.level,
    sport: workout.sport,
    summary: workout.summary || "A session you built in Aether.",
    video: media.video,
    poster: media.poster,
    blocks,
  };
}

export function loadLiveLogs(): LiveLog[] {
  const rows = readJson<LiveLog[]>(LOG_KEY, []);
  return rows.sort((a, b) => +new Date(b.start) - +new Date(a.start));
}

export function saveLiveLog(log: LiveLog) {
  const rows = loadLiveLogs().filter((r) => r.id !== log.id);
  rows.unshift(log);
  localStorage.setItem(LOG_KEY, JSON.stringify(rows.slice(0, 80)));
  notifyLocal();
}

export function getLiveLog(id: string): LiveLog | undefined {
  return loadLiveLogs().find((r) => r.id === id);
}

export function deleteLiveLog(id: string) {
  localStorage.setItem(
    LOG_KEY,
    JSON.stringify(loadLiveLogs().filter((r) => r.id !== id)),
  );
  notifyLocal();
}

export type LiveDraft = {
  origin: number;
  pauseAcc: number;
  pauseAt: number | null;
  running: boolean;
  title: string;
  sport: string;
  kind: string | null;
  planId: string | null;
  token: string | null;
  samples: LiveSample[];
  gpsOn: boolean;
  source: "strap" | "practice" | "none";
  savedAt: number;
};

export function loadLiveDraft(): LiveDraft | null {
  const row = readJson<LiveDraft | null>(DRAFT_KEY, null);
  if (!row || typeof row.origin !== "number") return null;
  if (Date.now() - row.savedAt > 6 * 60 * 60 * 1000) {
    clearLiveDraft();
    return null;
  }
  return row;
}

export function saveLiveDraft(draft: LiveDraft) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearLiveDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
}

export type BlockPreset = {
  label: string;
  blocks: Omit<WorkoutBlock, "id">[];
};

export const BLOCK_PRESETS: BlockPreset[] = [
  {
    label: "Warm-up 5",
    blocks: [
      { title: "Warm-up", seconds: 300, cue: "Easy. Raise temperature, not strain.", targetZone: 1 },
    ],
  },
  {
    label: "Zone 2 · 20",
    blocks: [
      { title: "Zone 2", seconds: 1200, cue: "Conversational. Nose breathing if you can.", targetZone: 2 },
    ],
  },
  {
    label: "6× 1:00 / 1:00",
    blocks: [
      { title: "Warm-up", seconds: 180, cue: "Easy roll-in.", targetZone: 1 },
      ...Array.from({ length: 6 }, (_, i) => [
        {
          title: `On ${i + 1}`,
          seconds: 60,
          cue: "Hard but repeatable. Don't sprint the first.",
          targetZone: 4,
        },
        {
          title: `Off ${i + 1}`,
          seconds: 60,
          cue: "Walk or shuffle. Reset the breath.",
          targetZone: 1,
        },
      ]).flat(),
      { title: "Cooldown", seconds: 180, cue: "Easy. Long exhales.", targetZone: 1 },
    ],
  },
  {
    label: "Hills 4× 90s",
    blocks: [
      { title: "Warm jog", seconds: 300, cue: "Easy until a light sweat.", targetZone: 1 },
      ...Array.from({ length: 4 }, (_, i) => [
        {
          title: `Climb ${i + 1}`,
          seconds: 90,
          cue: "Strong posture. Drive the knee.",
          targetZone: 4,
        },
        {
          title: "Walk down",
          seconds: 90,
          cue: "Shake the arms. Don't sit.",
          targetZone: 1,
        },
      ]).flat(),
      { title: "Cool walk", seconds: 300, cue: "No stretching yet.", targetZone: 1 },
    ],
  },
  {
    label: "Strength 5-round",
    blocks: [
      { title: "Prep", seconds: 120, cue: "Pattern the squat, hinge, push, pull.", targetZone: 1 },
      ...Array.from({ length: 5 }, (_, i) => ({
        title: `Round ${i + 1}`,
        seconds: 180,
        cue: "Leave two reps in the tank.",
        targetZone: 3,
      })),
      { title: "Downshift", seconds: 120, cue: "Walk and breathe.", targetZone: 1 },
    ],
  },
  {
    label: "Cooldown 5",
    blocks: [
      { title: "Cooldown", seconds: 300, cue: "Easy. Let heart rate come to you.", targetZone: 0 },
    ],
  },
];
