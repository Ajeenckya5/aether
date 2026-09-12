import { dayKey } from "./format";
import type { JournalFlags } from "./journal";
import { scoreReadiness, type Attribution } from "./model";
import type { Dashboard, Sleep, Workout, ZoneDurations } from "./types";

export type TrainingCall = "push" | "build" | "recover";

export type DayPoint = {
  key: string;
  iso: string;
  whoopRecovery: number | null;
  hrv: number | null;
  rhr: number | null;
  temp: number | null;
  spo2: number | null;
  resp: number | null;
  strain: number;
  load: number;
  sleepPerf: number | null;
  sleepEff: number | null;
  deepFrac: number | null;
  remFrac: number | null;
  sleepDebtH: number;
  midpointHour: number | null;
  inBedH: number | null;
};

export type LabReport = {
  call: TrainingCall;
  callWhy: string[];
  aether: number;
  whoop: number | null;
  delta: number | null;
  risk: number;
  riskLabel: "low" | "watch" | "high";
  attributions: Attribution[];
  ctl: number;
  atl: number;
  tsb: number;
  acwr: number;
  acwrBand: "underload" | "sweet" | "caution" | "spike";
  hrvZ: number;
  rhrZ: number;
  consecutiveLowHrv: number;
  overreaching: boolean;
  vitalSlope: "improving" | "stable" | "slipping";
  vitalNote: string;
  stress: number;
  polarized: { easy: number; moderate: number; hard: number };
  zone2WeekMin: number;
  zone2TargetMin: number;
  mechanicalWeek: number;
  predictedTomorrow: number;
  counterfactuals: { label: string; load: number; readiness: number; acwr: number }[];
  series: {
    keys: string[];
    ctl: number[];
    atl: number[];
    tsb: number[];
    hrv: number[];
    load: number[];
    aether: number[];
    whoop: number[];
  };
  coachSlug: string;
  coachLabel: string;
};

const LIFTING = new Set([
  "weightlifting",
  "functional fitness",
  "functional-fitness",
  "hiit",
  "pilates",
]);

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 1;
  const m = mean(values);
  return Math.sqrt(
    values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1),
  ) || 1;
}

function zScore(value: number, history: number[]): number {
  if (history.length < 3) return 0;
  return (value - mean(history)) / stdev(history);
}

function ema(values: number[], tau: number): number[] {
  if (values.length === 0) return [];
  const k = 1 / tau;
  const out: number[] = [];
  let prev = values[0] ?? 0;
  for (const v of values) {
    prev = prev + k * (v - prev);
    out.push(prev);
  }
  return out;
}

function slope(values: number[]): number {
  if (values.length < 5) return 0;
  const n = values.length;
  const xs = values.map((_, i) => i);
  const xBar = mean(xs);
  const yBar = mean(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - xBar) * (values[i] - yBar);
    den += (xs[i] - xBar) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function edwardsTrimp(zones: ZoneDurations | null | undefined): number {
  if (!zones) return 0;
  const mins = [
    zones.zone_zero_milli,
    zones.zone_one_milli,
    zones.zone_two_milli,
    zones.zone_three_milli,
    zones.zone_four_milli,
    zones.zone_five_milli,
  ].map((ms) => ms / 60000);
  return (
    mins[0] * 0.5 +
    mins[1] * 1 +
    mins[2] * 2 +
    mins[3] * 3 +
    mins[4] * 4 +
    mins[5] * 5
  );
}

function workoutLoad(workout: Workout): number {
  const trimp = edwardsTrimp(workout.score?.zone_durations);
  const strainLoad = (workout.score?.strain ?? 0) * 8;
  const base = Math.max(trimp, strainLoad * 0.35);
  const name = workout.sport_name.toLowerCase();
  const mechanical = LIFTING.has(name) || LIFTING.has(name.replace(/\s+/g, "-"));
  return base * (mechanical ? 1.28 : 1);
}

function sleepMidpointHour(sleep: Sleep): number | null {
  const start = new Date(sleep.start).getTime();
  const end = new Date(sleep.end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const mid = new Date((start + end) / 2);
  return mid.getHours() + mid.getMinutes() / 60;
}

export function buildDaySeries(data: Dashboard): DayPoint[] {
  const byKey = new Map<string, DayPoint>();

  const ensure = (iso: string): DayPoint => {
    const key = dayKey(iso);
    const existing = byKey.get(key);
    if (existing) return existing;
    const row: DayPoint = {
      key,
      iso,
      whoopRecovery: null,
      hrv: null,
      rhr: null,
      temp: null,
      spo2: null,
      resp: null,
      strain: 0,
      load: 0,
      sleepPerf: null,
      sleepEff: null,
      deepFrac: null,
      remFrac: null,
      sleepDebtH: 0,
      midpointHour: null,
      inBedH: null,
    };
    byKey.set(key, row);
    return row;
  };

  for (const rec of data.recoveries) {
    const row = ensure(rec.created_at);
    if (rec.score) {
      row.whoopRecovery = rec.score.recovery_score;
      row.hrv = rec.score.hrv_rmssd_milli;
      row.rhr = rec.score.resting_heart_rate;
      row.temp = rec.score.skin_temp_celsius;
      row.spo2 = rec.score.spo2_percentage;
    }
  }

  for (const cycle of data.cycles) {
    const row = ensure(cycle.start);
    row.strain = cycle.score?.strain ?? 0;
    if (row.load === 0) row.load = row.strain * 8;
  }

  for (const sleep of data.sleeps) {
    if (sleep.nap) continue;
    const row = ensure(sleep.end);
    const score = sleep.score;
    if (!score) continue;
    const stages = score.stage_summary;
    const total =
      stages.total_light_sleep_time_milli +
      stages.total_slow_wave_sleep_time_milli +
      stages.total_rem_sleep_time_milli || 1;
    row.sleepPerf = score.sleep_performance_percentage / 100;
    row.sleepEff = score.sleep_efficiency_percentage / 100;
    row.deepFrac = stages.total_slow_wave_sleep_time_milli / total;
    row.remFrac = stages.total_rem_sleep_time_milli / total;
    row.resp = score.respiratory_rate;
    row.inBedH = stages.total_in_bed_time_milli / 3600000;
    const need =
      (score.sleep_needed.baseline_milli +
        score.sleep_needed.need_from_sleep_debt_milli +
        score.sleep_needed.need_from_recent_strain_milli +
        score.sleep_needed.need_from_recent_nap_milli) /
      3600000;
    row.sleepDebtH = Math.max(0, need - (row.inBedH ?? 0));
    row.midpointHour = sleepMidpointHour(sleep);
  }

  for (const workout of data.workouts) {
    const row = ensure(workout.start);
    row.load += workoutLoad(workout);
  }

  return [...byKey.values()].sort((a, b) => +new Date(a.iso) - +new Date(b.iso));
}

function rollingMean(values: number[], end: number, window: number): number {
  const slice = values.slice(Math.max(0, end - window + 1), end + 1);
  return mean(slice);
}

function featuresFor(
  days: DayPoint[],
  index: number,
  journal: JournalFlags,
  ctl: number[],
  atl: number[],
): Record<string, number> {
  const day = days[index];
  const prior = days.slice(Math.max(0, index - 14), index);
  const hrvHist = prior.map((d) => d.hrv).filter((v): v is number => v != null);
  const rhrHist = prior.map((d) => d.rhr).filter((v): v is number => v != null);
  const tempHist = prior.map((d) => d.temp).filter((v): v is number => v != null);
  const respHist = prior.map((d) => d.resp).filter((v): v is number => v != null);
  const spo2Hist = prior.map((d) => d.spo2).filter((v): v is number => v != null);
  const hrvZ = day.hrv != null ? zScore(Math.log(Math.max(day.hrv, 1)), hrvHist.map((v) => Math.log(Math.max(v, 1)))) : 0;
  let consecutive = 0;
  for (let i = index; i >= 0; i -= 1) {
    const hist = days.slice(Math.max(0, i - 14), i);
    const series = hist.map((d) => d.hrv).filter((v): v is number => v != null);
    const value = days[i]?.hrv;
    if (value == null || series.length < 3) break;
    const z = zScore(Math.log(Math.max(value, 1)), series.map((v) => Math.log(Math.max(v, 1))));
    if (z < -0.75) consecutive += 1;
    else break;
  }
  const mids = prior
    .map((d) => d.midpointHour)
    .filter((v): v is number => v != null);
  const regularity = mids.length < 3 ? 0.75 : Math.max(0, 1 - Math.min(1, stdev(mids) / 2.8));
  const loads = days.map((d) => d.load);
  const atl7 = rollingMean(loads, index, 7);
  const ctl28 = rollingMean(loads, Math.max(0, index - 1), 28) || 1;
  const acwr = atl7 / ctl28;
  const tsb = (ctl[index] ?? 0) - (atl[index] ?? 0);
  const loadScale = Math.max(40, ...loads, 1);

  return {
    hrv_ln_z: hrvZ,
    rhr_z: day.rhr != null ? zScore(day.rhr, rhrHist) : 0,
    sleep_performance: day.sleepPerf ?? 0.72,
    sleep_efficiency: day.sleepEff ?? 0.88,
    sleep_debt_h: day.sleepDebtH,
    deep_frac: day.deepFrac ?? 0.2,
    rem_frac: day.remFrac ?? 0.21,
    yday_load: (days[index - 1]?.load ?? 0) / loadScale,
    atl_norm: (atl[index] ?? 0) / loadScale,
    tsb_norm: tsb / loadScale,
    acwr,
    temp_z: day.temp != null ? zScore(day.temp, tempHist) : 0,
    resp_z: day.resp != null ? zScore(day.resp, respHist) : 0,
    spo2_z: day.spo2 != null ? zScore(day.spo2, spo2Hist) : 0,
    alcohol: journal.alcohol ? 1 : 0,
    illness: journal.illness ? 1 : 0,
    travel: journal.travel ? 1 : 0,
    consecutive_low_hrv: consecutive,
    sleep_regularity: regularity,
    soreness: journal.soreness / 3,
  };
}

function decideCall(input: {
  readiness: number;
  acwr: number;
  hrvZ: number;
  tsb: number;
  risk: number;
  overreaching: boolean;
  illness: boolean;
}): { call: TrainingCall; why: string[] } {
  const why: string[] = [];
  if (input.illness) {
    why.push("Illness flagged — keep load near zero until symptoms clear.");
    return { call: "recover", why };
  }
  if (input.overreaching) {
    why.push("HRV has been suppressed for several days while acute load stays high.");
    return { call: "recover", why };
  }
  if (input.acwr >= 1.5) {
    why.push(`Acute:chronic ratio is ${input.acwr.toFixed(2)} — Gabbett's spike zone.`);
    return { call: "recover", why };
  }
  if (input.readiness < 38 || input.hrvZ < -1.35 || input.risk > 0.55) {
    why.push("Open readiness and HRV both say the nervous system is still paying last week's bill.");
    if (input.tsb < 0) why.push("Training stress balance is negative (more fatigue than fitness).");
    return { call: "recover", why };
  }
  if (input.readiness >= 72 && input.acwr < 1.25 && input.hrvZ > -0.25 && input.tsb >= 0) {
    why.push("You are fresh: HRV is at or above baseline and chronic load can absorb a hard day.");
    why.push("Keep the hard work quality — don't dump junk volume on a green day.");
    return { call: "push", why };
  }
  why.push("Build day: enough recovery for aerobic or technique work, not a breakthrough session.");
  if (input.acwr > 1.2) why.push("Ratio is climbing — bias to zone 2 so tomorrow's ACWR stays in range.");
  return { call: "build", why };
}

function coachFor(call: TrainingCall): { slug: string; label: string } {
  if (call === "recover") return { slug: "tide-breath", label: "Tide Breath · 15 min downshift" };
  if (call === "push") return { slug: "iron-circuit", label: "Iron Circuit · 28 min strength" };
  return { slug: "ember-zone-two", label: "Ember Zone Two · 40 min aerobic" };
}

export function analyzeDashboard(
  data: Dashboard,
  journal: JournalFlags,
  workouts?: Workout[],
): LabReport | null {
  const days = buildDaySeries(data);
  if (days.length < 5) return null;
  const loads = days.map((d) => d.load);
  const ctlSeries = ema(loads, 42);
  const atlSeries = ema(loads, 7);
  const last = days.length - 1;
  const feats = featuresFor(days, last, journal, ctlSeries, atlSeries);
  if (journal.lateCaffeine) feats.sleep_debt_h += 0.55;
  const scored = scoreReadiness(feats);
  const hrvZ = feats.hrv_ln_z;
  const rhrZ = feats.rhr_z;
  const acwr = feats.acwr;
  const tsb = (ctlSeries[last] ?? 0) - (atlSeries[last] ?? 0);
  const consecutive = feats.consecutive_low_hrv;
  const overreaching = consecutive >= 3 && acwr > 1.15 && tsb < 0;
  const { call, why } = decideCall({
    readiness: scored.readiness,
    acwr,
    hrvZ,
    tsb,
    risk: scored.risk,
    overreaching,
    illness: journal.illness,
  });

  const hrvSeries = days
    .map((d) => d.hrv)
    .filter((v): v is number => v != null);
  const rhrSeries = days
    .map((d) => d.rhr)
    .filter((v): v is number => v != null);
  const hrvTrend = slope(hrvSeries.slice(-21).map((v) => Math.log(Math.max(v, 1))));
  const rhrTrend = slope(rhrSeries.slice(-21));
  let vitalSlope: LabReport["vitalSlope"] = "stable";
  if (hrvTrend > 0.004 && rhrTrend < 0) vitalSlope = "improving";
  else if (hrvTrend < -0.004 || rhrTrend > 0.08) vitalSlope = "slipping";
  const vitalNote =
    vitalSlope === "improving"
      ? "HRV is drifting up and resting HR down across three weeks — that's the open vital slope WHOOP 5.0 wraps into Healthspan."
      : vitalSlope === "slipping"
        ? "Cardio markers are sliding. That's usually load, alcohol, or illness — not 'getting older' this week."
        : "Vital trajectory is flat. Hold the line on sleep timing before you add intensity.";

  const leftover = Math.max(0, (days[last]?.strain ?? 0) - 8);
  const stress = Math.max(
    6,
    Math.min(
      96,
      38 + leftover * 4 + Math.max(0, -hrvZ) * 14 + feats.sleep_debt_h * 6 + (journal.alcohol ? 12 : 0),
    ),
  );

  const weekWorkouts = (workouts ?? data.workouts).filter((w) => {
    const age = Date.now() - new Date(w.start).getTime();
    return age >= 0 && age < 7 * 86400000;
  });
  let easy = 0;
  let moderate = 0;
  let hard = 0;
  let zone2 = 0;
  let mechanical = 0;
  for (const w of weekWorkouts) {
    const z = w.score?.zone_durations;
    if (z) {
      easy += (z.zone_zero_milli + z.zone_one_milli + z.zone_two_milli) / 60000;
      moderate += z.zone_three_milli / 60000;
      hard += (z.zone_four_milli + z.zone_five_milli) / 60000;
      zone2 += z.zone_two_milli / 60000;
    }
    const name = w.sport_name.toLowerCase();
    if (LIFTING.has(name) || LIFTING.has(name.replace(/\s+/g, "-"))) {
      mechanical += (new Date(w.end).getTime() - new Date(w.start).getTime()) / 60000;
    }
  }
  const totalMin = easy + moderate + hard || 1;

  const aetherSeries = days.map((_, i) => {
    const f = featuresFor(days, i, i === last ? journal : {
      alcohol: false,
      lateCaffeine: false,
      travel: false,
      illness: false,
      soreness: 0,
    }, ctlSeries, atlSeries);
    return scoreReadiness(f).readiness;
  });

  const tomorrowFeats = { ...feats, yday_load: (days[last]?.load ?? 0) / Math.max(40, ...loads) };
  const predictedTomorrow = scoreReadiness(tomorrowFeats).readiness;

  const loadScale = Math.max(40, ...loads, 1);
  const counterfactuals = [
    { label: "Rest", load: 0 },
    { label: "Zone 2 · 40m", load: 48 },
    { label: "Hard session", load: 110 },
  ].map((option) => {
    const nextLoad = [...loads, option.load];
    const nextCtl = ema(nextLoad, 42);
    const nextAtl = ema(nextLoad, 7);
    const i = nextLoad.length - 1;
    const nextAcwr =
      rollingMean(nextLoad, i, 7) / (rollingMean(nextLoad, i - 1, 28) || 1);
    const cf = {
      ...feats,
      yday_load: option.load / loadScale,
      atl_norm: (nextAtl[i] ?? 0) / loadScale,
      tsb_norm: ((nextCtl[i] ?? 0) - (nextAtl[i] ?? 0)) / loadScale,
      acwr: nextAcwr,
    };
    return {
      label: option.label,
      load: option.load,
      readiness: scoreReadiness(cf).readiness,
      acwr: nextAcwr,
    };
  });

  let acwrBand: LabReport["acwrBand"] = "sweet";
  if (acwr < 0.8) acwrBand = "underload";
  else if (acwr >= 1.5) acwrBand = "spike";
  else if (acwr >= 1.3) acwrBand = "caution";

  const whoop = days[last]?.whoopRecovery ?? null;
  const coach = coachFor(call);

  return {
    call,
    callWhy: why,
    aether: scored.readiness,
    whoop,
    delta: whoop == null ? null : scored.readiness - whoop,
    risk: scored.risk,
    riskLabel: scored.risk > 0.55 || acwrBand === "spike" ? "high" : scored.risk > 0.3 ? "watch" : "low",
    attributions: scored.attributions.slice(0, 6),
    ctl: ctlSeries[last] ?? 0,
    atl: atlSeries[last] ?? 0,
    tsb,
    acwr,
    acwrBand,
    hrvZ,
    rhrZ,
    consecutiveLowHrv: consecutive,
    overreaching,
    vitalSlope,
    vitalNote,
    stress,
    polarized: {
      easy: easy / totalMin,
      moderate: moderate / totalMin,
      hard: hard / totalMin,
    },
    zone2WeekMin: zone2,
    zone2TargetMin: 150,
    mechanicalWeek: mechanical,
    predictedTomorrow,
    counterfactuals,
    series: {
      keys: days.map((d) => d.key),
      ctl: ctlSeries,
      atl: atlSeries,
      tsb: ctlSeries.map((c, i) => c - (atlSeries[i] ?? 0)),
      hrv: days.map((d) => d.hrv ?? 0),
      load: loads,
      aether: aetherSeries,
      whoop: days.map((d) => d.whoopRecovery ?? 0),
    },
    coachSlug: coach.slug,
    coachLabel: coach.label,
  };
}
