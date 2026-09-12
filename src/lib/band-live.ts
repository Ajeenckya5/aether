import { cleanRrIntervals, rmssdMs, sdnnMs } from "./ble-hr";
import {
  AETHER_OVERNIGHT_SLEEP_ID,
  attachVitalsToOvernight,
  parseOvernightSummary,
  sleepFromOvernight,
  type OvernightSummary,
} from "./overnight";
import type { Dashboard } from "./types";

export const BAND_LIVE_KEY = "aether-band-live-v1";

export type BandLive = {
  rmssd: number | null;
  sdnn: number | null;
  restHr: number | null;
  bpm: number | null;
  batteryPct: number | null;
  rrCount: number;
  deviceName: string | null;
  spo2: number | null;
  skinTempC: number | null;
  overnight: OvernightSummary | null;
  at: number;
};

export function emptyBandLive(): BandLive {
  return {
    rmssd: null,
    sdnn: null,
    restHr: null,
    bpm: null,
    batteryPct: null,
    rrCount: 0,
    deviceName: null,
    spo2: null,
    skinTempC: null,
    overnight: null,
    at: 0,
  };
}

export function parseBandLive(raw: string | null | undefined): BandLive | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BandLive>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      rmssd: numOrNull(parsed.rmssd),
      sdnn: numOrNull(parsed.sdnn),
      restHr: numOrNull(parsed.restHr),
      bpm: numOrNull(parsed.bpm),
      batteryPct: numOrNull(parsed.batteryPct),
      rrCount: typeof parsed.rrCount === "number" ? parsed.rrCount : 0,
      deviceName: typeof parsed.deviceName === "string" ? parsed.deviceName : null,
      spo2: numOrNull(parsed.spo2),
      skinTempC: numOrNull(parsed.skinTempC),
      overnight: parseOvernightSummary(parsed.overnight),
      at: typeof parsed.at === "number" ? parsed.at : 0,
    };
  } catch {
    return null;
  }
}

export function loadBandLive(): BandLive | null {
  if (typeof window === "undefined") return null;
  return parseBandLive(window.localStorage.getItem(BAND_LIVE_KEY));
}

export function saveBandLive(live: BandLive) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BAND_LIVE_KEY, JSON.stringify(live));
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Resting HR from the quietest part of a live session, not a walking spike. */
export function sessionRestHr(bpmSamples: number[]): number | null {
  const rest = bpmSamples.filter((bpm) => bpm >= 38 && bpm <= 90);
  if (rest.length < 12) return null;
  const sorted = [...rest].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length * 0.1)]!);
}

export function physiologyFromRr(
  rrMs: number[],
): { rmssd: number | null; sdnn: number | null; rrCount: number } {
  const clean = cleanRrIntervals(rrMs);
  const hrv = rmssdMs(clean);
  const sdnn = sdnnMs(clean);
  return {
    rmssd: hrv != null ? Math.round(hrv) : null,
    sdnn: sdnn != null ? Math.round(sdnn) : null,
    rrCount: clean.length,
  };
}

export function hasBandPhysiology(live: BandLive | null | undefined): boolean {
  if (!live) return false;
  return (
    live.rmssd != null ||
    live.restHr != null ||
    live.spo2 != null ||
    live.skinTempC != null ||
    live.overnight != null
  );
}

function withOvernightVitals(live: BandLive): BandLive {
  const overnight = attachVitalsToOvernight(
    live.overnight,
    live.spo2,
    live.skinTempC,
  );
  return overnight === live.overnight ? live : { ...live, overnight };
}

/** Put live-band vitals onto today. Overnight rest/wake replaces sample sleep only. */
export function overlayDashboard(data: Dashboard, live: BandLive | null): Dashboard {
  if (!hasBandPhysiology(live) || !live) return data;
  const band = withOvernightVitals(live);
  const overnight = band.overnight;
  const recoveries = data.recoveries.map((row, index) => {
    if (index !== 0 || !row.score) return row;
    const spo2 =
      band.spo2 ?? overnight?.spo2 ?? (data.connected ? row.score.spo2_percentage : null);
    const skinTemp =
      band.skinTempC ??
      overnight?.skinTempC ??
      (data.connected ? row.score.skin_temp_celsius : null);
    return {
      ...row,
      sleep_id: overnight && !data.connected ? AETHER_OVERNIGHT_SLEEP_ID : row.sleep_id,
      score: {
        ...row.score,
        hrv_rmssd_milli: band.rmssd ?? overnight?.rmssd ?? row.score.hrv_rmssd_milli,
        resting_heart_rate: band.restHr ?? overnight?.restHr ?? row.score.resting_heart_rate,
        spo2_percentage: spo2,
        skin_temp_celsius: skinTemp,
      },
    };
  });
  if (!overnight || data.connected) {
    return { ...data, recoveries };
  }
  const nextSleep = sleepFromOvernight(overnight, data.sleeps[0]);
  const sleeps = data.sleeps.length
    ? data.sleeps.map((row, index) => (index === 0 ? nextSleep : row))
    : [nextSleep];
  return { ...data, recoveries, sleeps };
}
