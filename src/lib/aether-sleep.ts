type HeartNightPoint = {
  t: number;
  bpm: number;
  rmssd: number | null;
};

export const AETHER_SLEEP_EPOCH_MS = 5 * 60_000;
export const AETHER_SLEEP_STAGE_MIN_MS = 2.5 * 3600_000;
const MAX_GAP_MS = 180_000;
const MIN_RUN_MS = 10 * 60_000;
const MIN_WAKE_RUN_MS = 5 * 60_000;
const CYCLE_ACTIVE_MS = 12 * 60_000;
const CYCLE_NREM_MS = 20 * 60_000;

export type AetherSleepPhase = "wake" | "quiet" | "deep" | "active";

export type AetherSleepEpoch = {
  t: number;
  durMs: number;
  phase: AetherSleepPhase;
};

export type AetherSleepAnalysis = {
  start: number;
  end: number;
  restMs: number;
  awakeMs: number;
  quietMs: number;
  deepMs: number;
  activeMs: number;
  cycles: number;
  disturbances: number;
  restHr: number | null;
  rmssd: number | null;
  staged: boolean;
  epochs: AetherSleepEpoch[];
  pointCount: number;
};

export const AETHER_SLEEP_PHASES = [
  { id: "wake" as const, label: "Wake", color: "#c9c2b6" },
  { id: "active" as const, label: "Active rest", color: "#9d8cff" },
  { id: "quiet" as const, label: "Quiet", color: "#7ad7ff" },
  { id: "deep" as const, label: "Deep rest", color: "#d6ff4b" },
];

export function aetherSleepPhaseLabel(phase: AetherSleepPhase): string {
  return AETHER_SLEEP_PHASES.find((row) => row.id === phase)?.label ?? phase;
}

export function aetherSleepPhaseColor(phase: AetherSleepPhase): string {
  return AETHER_SLEEP_PHASES.find((row) => row.id === phase)?.color ?? "#c9c2b6";
}

export function quietRestHr(bpmSamples: number[]): number | null {
  const rest = bpmSamples.filter((bpm) => bpm >= 38 && bpm <= 90);
  if (rest.length < 12) return null;
  const sorted = [...rest].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length * 0.1)]!);
}

export function medianNumber(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

/** Public-HR sleep phase. Not AASM, not WHOOP. */
export function classifyEpoch(features: {
  meanBpm: number;
  relHr: number;
  stdBpm: number;
  rmssd: number | null;
  hrvMed: number | null;
  nightFrac: number;
}): AetherSleepPhase {
  const { meanBpm, relHr, stdBpm, rmssd, hrvMed, nightFrac } = features;
  if (meanBpm >= 85 || relHr >= 22 || (relHr >= 16 && stdBpm >= 6)) {
    return "wake";
  }

  const highHrv = rmssd == null || hrvMed == null || rmssd >= hrvMed * 0.92;
  const richerHrv = rmssd != null && hrvMed != null && rmssd >= hrvMed * 1.12;
  const lowHrv = rmssd == null || hrvMed == null || rmssd <= hrvMed * 1.02;
  const muchLowerHrv = rmssd != null && hrvMed != null && rmssd <= hrvMed * 0.78;

  if (highHrv && stdBpm <= 2.6 && nightFrac <= 0.75) {
    if (relHr <= 4) return "deep";
    if (richerHrv && relHr <= 6 && stdBpm <= 2 && nightFrac <= 0.5) return "deep";
  }

  if (nightFrac >= 0.08 && relHr < 22) {
    if (muchLowerHrv && relHr >= 5.5) return "active";
    if (lowHrv && stdBpm >= 2.05 && relHr >= 2.2) return "active";
    if (nightFrac >= 0.45 && relHr >= 7 && stdBpm >= 1.6) return "active";
    if (nightFrac >= 0.18 && stdBpm >= 2.5 && relHr >= 4) return "active";
  }

  return "quiet";
}

/**
 * Aether sleep from public Heart Rate (+ R-R/HRV when present).
 * Quiet / deep rest / active rest are Aether labels, not WHOOP REM/light/deep.
 */
export function analyzeAetherSleep(
  points: HeartNightPoint[],
  now = Date.now(),
  windowMs = 14 * 3600_000,
): AetherSleepAnalysis | null {
  const window = points.filter((p) => now - p.t <= windowMs && p.t <= now);
  if (window.length < 2) return null;

  const start = window[0]!.t;
  const end = window[window.length - 1]!.t;
  const bpms = window.map((p) => p.bpm);
  const restHr = quietRestHr(bpms);
  const hrvSamples = window
    .map((p) => p.rmssd)
    .filter((v): v is number => v != null);
  const rmssd = medianNumber(hrvSamples);
  const raw = epochize(window);
  if (!raw.length) {
    return totalsFromBinary(window, restHr, rmssd);
  }

  const hrvMed = medianNumber(
    raw
      .map((row) => row.rmssd)
      .filter((v): v is number => v != null),
  );
  const span = Math.max(end - start, 1);
  const restAnchor = restHr ?? 55;

  let phases = raw.map((row) =>
    classifyEpoch({
      meanBpm: row.meanBpm,
      relHr: row.meanBpm - restAnchor,
      stdBpm: row.stdBpm,
      rmssd: row.rmssd,
      hrvMed,
      nightFrac: (row.t - start) / span,
    }),
  );
  phases = smoothPhases(phases);

  let epochs = mergeEpochs(
    raw.map((row, i) => ({
      t: row.t,
      durMs: row.durMs,
      phase: phases[i]!,
    })),
  );
  epochs = absorbShortRuns(epochs);

  const bpmRange =
    Math.max(...raw.map((row) => row.meanBpm)) -
    Math.min(...raw.map((row) => row.meanBpm));
  const sleepMs = durationOf(
    epochs,
    (phase) => phase === "quiet" || phase === "deep" || phase === "active",
  );
  const staged =
    sleepMs >= AETHER_SLEEP_STAGE_MIN_MS &&
    (hrvSamples.length >= 12 || bpmRange >= 6);

  if (!staged) {
    epochs = epochs.map((row) =>
      row.phase === "wake" ? row : { ...row, phase: "quiet" as const },
    );
    epochs = mergeEpochs(epochs);
  }

  const quietMs = durationOf(epochs, (phase) => phase === "quiet");
  const deepMs = durationOf(epochs, (phase) => phase === "deep");
  const activeMs = durationOf(epochs, (phase) => phase === "active");
  const awakeMs = durationOf(epochs, (phase) => phase === "wake");
  const restMs = quietMs + deepMs + activeMs;

  return {
    start,
    end,
    restMs,
    awakeMs,
    quietMs,
    deepMs,
    activeMs,
    cycles: countCycles(epochs),
    disturbances: countDisturbances(epochs),
    restHr,
    rmssd: rmssd != null ? Math.round(rmssd) : null,
    staged,
    epochs,
    pointCount: window.length,
  };
}

export function hasAetherSleepArchitecture(
  analysis: { staged?: boolean; deepMs?: number; activeMs?: number } | null | undefined,
): boolean {
  if (!analysis) return false;
  if (analysis.staged) return true;
  return (analysis.deepMs ?? 0) + (analysis.activeMs ?? 0) > 0;
}

function epochize(points: HeartNightPoint[]): Array<{
  t: number;
  durMs: number;
  meanBpm: number;
  stdBpm: number;
  rmssd: number | null;
}> {
  const start = points[0]!.t;
  const end = points[points.length - 1]!.t;
  const rows: Array<{
    t: number;
    durMs: number;
    meanBpm: number;
    stdBpm: number;
    rmssd: number | null;
  }> = [];
  let index = 0;
  for (let t = start; t < end; t += AETHER_SLEEP_EPOCH_MS) {
    const nextT = Math.min(t + AETHER_SLEEP_EPOCH_MS, end);
    const bpms: number[] = [];
    const hrv: number[] = [];
    while (index < points.length && points[index]!.t < t) index += 1;
    let look = index;
    while (look < points.length && points[look]!.t < nextT) {
      bpms.push(points[look]!.bpm);
      if (points[look]!.rmssd != null) hrv.push(points[look]!.rmssd!);
      look += 1;
    }
    if (bpms.length < 2) continue;
    rows.push({
      t,
      durMs: Math.max(60_000, nextT - t),
      meanBpm: mean(bpms),
      stdBpm: stdev(bpms),
      rmssd: medianNumber(hrv),
    });
  }
  if (rows.length) {
    const last = rows[rows.length - 1]!;
    last.durMs = Math.max(last.durMs, end - last.t);
  }
  return rows;
}

function totalsFromBinary(
  window: HeartNightPoint[],
  restHr: number | null,
  rmssd: number | null,
): AetherSleepAnalysis {
  const restCut = restHr != null ? restHr + 12 : 70;
  let restMs = 0;
  let awakeMs = 0;
  const epochs: AetherSleepEpoch[] = [];
  for (let i = 1; i < window.length; i += 1) {
    const dt = Math.min(window[i]!.t - window[i - 1]!.t, MAX_GAP_MS);
    const rest = window[i]!.bpm <= restCut && window[i]!.bpm >= 38;
    if (rest) restMs += dt;
    else awakeMs += dt;
    const phase: AetherSleepPhase = rest ? "quiet" : "wake";
    const prev = epochs[epochs.length - 1];
    if (prev && prev.phase === phase) prev.durMs += dt;
    else epochs.push({ t: window[i - 1]!.t, durMs: dt, phase });
  }
  return {
    start: window[0]!.t,
    end: window[window.length - 1]!.t,
    restMs,
    awakeMs,
    quietMs: restMs,
    deepMs: 0,
    activeMs: 0,
    cycles: 0,
    disturbances: 0,
    restHr,
    rmssd: rmssd != null ? Math.round(rmssd) : null,
    staged: false,
    epochs,
    pointCount: window.length,
  };
}

function smoothPhases(phases: AetherSleepPhase[]): AetherSleepPhase[] {
  const out = [...phases];
  for (let i = 1; i < out.length - 1; i += 1) {
    if (out[i] !== out[i - 1] && out[i - 1] === out[i + 1]) {
      out[i] = out[i - 1]!;
    }
  }
  return out;
}

function mergeEpochs(rows: AetherSleepEpoch[]): AetherSleepEpoch[] {
  const out: AetherSleepEpoch[] = [];
  for (const row of rows) {
    const prev = out[out.length - 1];
    if (prev && prev.phase === row.phase) prev.durMs += row.durMs;
    else out.push({ ...row });
  }
  return out;
}

function absorbShortRuns(rows: AetherSleepEpoch[]): AetherSleepEpoch[] {
  if (rows.length < 2) return rows;
  const next = rows.map((row) => ({ ...row }));
  for (let i = 0; i < next.length; i += 1) {
    const row = next[i]!;
    const minMs = row.phase === "wake" ? MIN_WAKE_RUN_MS : MIN_RUN_MS;
    if (row.durMs >= minMs) continue;
    const neighbor = next[i - 1] ?? next[i + 1];
    if (!neighbor) continue;
    row.phase = neighbor.phase;
  }
  return mergeEpochs(next);
}

function durationOf(
  epochs: AetherSleepEpoch[],
  match: (phase: AetherSleepPhase) => boolean,
): number {
  return epochs.reduce((sum, row) => (match(row.phase) ? sum + row.durMs : sum), 0);
}

function countCycles(epochs: AetherSleepEpoch[]): number {
  let cycles = 0;
  let nremMs = 0;
  let seenSleep = false;
  for (const row of epochs) {
    if (row.phase === "wake") continue;
    if (row.phase === "quiet" || row.phase === "deep") {
      nremMs += row.durMs;
      seenSleep = true;
      continue;
    }
    if (row.phase === "active" && seenSleep && row.durMs >= CYCLE_ACTIVE_MS && nremMs >= CYCLE_NREM_MS) {
      cycles += 1;
      nremMs = 0;
    }
  }
  return cycles;
}

function countDisturbances(epochs: AetherSleepEpoch[]): number {
  const firstSleep = epochs.find((row) => row.phase !== "wake");
  const lastSleep = [...epochs].reverse().find((row) => row.phase !== "wake");
  if (!firstSleep || !lastSleep) return 0;
  const onset = firstSleep.t;
  const offset = lastSleep.t + lastSleep.durMs;
  return epochs.filter(
    (row) =>
      row.phase === "wake" &&
      row.durMs >= MIN_WAKE_RUN_MS &&
      row.t > onset &&
      row.t + row.durMs < offset,
  ).length;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
