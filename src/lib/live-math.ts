import { edwardsTrimp } from "./intelligence";
import type { LiveLog, LiveSample } from "./sessions";
import type { ZoneDurations } from "./types";

/** WHOOP-style 6-zone edges as fractions of HRmax. */
const ZONE_FRAC = [0.5, 0.6, 0.7, 0.8, 0.9, 1];

export function zoneFromHr(bpm: number, maxHr: number): number {
  if (maxHr <= 0 || bpm <= 0) return 0;
  const p = bpm / maxHr;
  if (p < ZONE_FRAC[0]) return 0;
  if (p < ZONE_FRAC[1]) return 1;
  if (p < ZONE_FRAC[2]) return 2;
  if (p < ZONE_FRAC[3]) return 3;
  if (p < ZONE_FRAC[4]) return 4;
  return 5;
}

export function zoneDurationsFromMs(
  zoneMs: [number, number, number, number, number, number],
): ZoneDurations {
  return {
    zone_zero_milli: zoneMs[0],
    zone_one_milli: zoneMs[1],
    zone_two_milli: zoneMs[2],
    zone_three_milli: zoneMs[3],
    zone_four_milli: zoneMs[4],
    zone_five_milli: zoneMs[5],
  };
}

/** Ignore only pathological jumps (sleep/lock > 3 min), not ordinary background throttling. */
const MAX_SAMPLE_GAP_MS = 180_000;
export const SAMPLE_GAP_MS = 900;

export function wallElapsedMs(
  now: number,
  origin: number | null,
  pauseAcc: number,
  pauseAt: number | null,
): number {
  if (origin == null) return 0;
  const hangingPause = pauseAt != null ? Math.max(0, now - pauseAt) : 0;
  return Math.max(0, now - origin - pauseAcc - hangingPause);
}

export function appendSample(
  prev: LiveSample[],
  elapsed: number,
  bpm: number | null,
  lat: number | null,
  lon: number | null,
  minGap = SAMPLE_GAP_MS,
): LiveSample[] {
  const last = prev[prev.length - 1];
  if (last && elapsed - last.t < Math.max(1, minGap)) return prev;
  return [...prev, { t: Math.max(0, elapsed), bpm, lat, lon }];
}

export function sealSamples(
  samples: LiveSample[],
  durationMs: number,
  bpm: number | null,
  lat: number | null,
  lon: number | null,
): LiveSample[] {
  const duration = Math.max(0, durationMs);
  const last = samples[samples.length - 1];
  if (last && last.t === duration) return samples;
  return [...samples, { t: duration, bpm, lat, lon }];
}

export function accumulateZones(
  samples: LiveSample[],
  maxHr: number,
): [number, number, number, number, number, number] {
  const zoneMs: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  if (!samples.length) return zoneMs;
  const first = samples[0];
  if (first.t > 0 && first.bpm != null) {
    zoneMs[zoneFromHr(first.bpm, maxHr)] += Math.min(first.t, MAX_SAMPLE_GAP_MS);
  }
  for (let i = 1; i < samples.length; i += 1) {
    const dt = Math.max(0, Math.min(MAX_SAMPLE_GAP_MS, samples[i].t - samples[i - 1].t));
    const bpm = samples[i].bpm ?? samples[i - 1].bpm;
    if (bpm == null || dt <= 0) continue;
    zoneMs[zoneFromHr(bpm, maxHr)] += dt;
  }
  return zoneMs;
}

export function haversineM(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceFromSamples(samples: LiveSample[]): number | null {
  let meters = 0;
  let last: { lat: number; lon: number } | null = null;
  for (const s of samples) {
    if (s.lat == null || s.lon == null) continue;
    const here = { lat: s.lat, lon: s.lon };
    if (last) {
      const d = haversineM(last, here);
      if (d < 80) meters += d;
    }
    last = here;
  }
  return meters > 5 ? meters : null;
}

export function hrStats(samples: LiveSample[]): { avg: number | null; max: number | null } {
  const bpms = samples.map((s) => s.bpm).filter((v): v is number => v != null && v > 30);
  if (!bpms.length) return { avg: null, max: null };
  return {
    avg: bpms.reduce((a, b) => a + b, 0) / bpms.length,
    max: Math.max(...bpms),
  };
}

export function scoreLiveLog(
  samples: LiveSample[],
  durationMs: number,
  maxHr: number,
  gps: boolean,
): Pick<LiveLog, "avgHr" | "maxHr" | "distanceM" | "zoneMs" | "edwardsTrimp" | "strainProxy"> {
  const stats = hrStats(samples);
  const zoneMs = accumulateZones(samples, maxHr);
  const zones = zoneDurationsFromMs(zoneMs);
  const trimp = edwardsTrimp(zones);
  return {
    avgHr: stats.avg,
    maxHr: stats.max,
    distanceM: gps ? distanceFromSamples(samples) : null,
    zoneMs,
    edwardsTrimp: trimp,
    strainProxy: Math.min(21, trimp / 10),
  };
}

export function currentBlockIndex(elapsedSec: number, blockSeconds: number[]): number {
  let acc = 0;
  for (let i = 0; i < blockSeconds.length; i += 1) {
    acc += blockSeconds[i];
    if (elapsedSec < acc) return i;
  }
  return Math.max(0, blockSeconds.length - 1);
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const ZONE_COLORS = [
  "#5b564c",
  "#7ad7ff",
  "#d6ff4b",
  "#f0c14b",
  "#ff5c2a",
  "#ff2d55",
];
