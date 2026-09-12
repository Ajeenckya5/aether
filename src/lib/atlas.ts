import {
  gellishMaxHr,
  gulatiMaxHr,
  nesMaxHr,
  resolvedMaxHr,
  tanakaMaxHr,
  foxMaxHr,
  type Athlete,
} from "./athlete";
import { buildDaySeries, edwardsTrimp } from "./intelligence";
import type { JournalFlags } from "./journal";
import type { Dashboard, Sleep, Workout } from "./types";

export type MetricConfidence = "measured" | "derived" | "estimated" | "unavailable";

export type AtlasMetric = {
  id: string;
  group: string;
  name: string;
  value: number | null;
  display: string;
  unit: string;
  formula: string;
  citation: string;
  confidence: MetricConfidence;
  note?: string;
};

export type AtlasReport = {
  generatedAt: string;
  metrics: AtlasMetric[];
  groups: string[];
};

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1));
}

function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}

function referenceNow(data: Dashboard): Date {
  const stamp =
    data.sleeps[0]?.end ||
    data.recoveries[0]?.created_at ||
    data.workouts[0]?.start ||
    data.cycles[0]?.start;
  const d = stamp ? new Date(stamp) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function fmt(value: number | null, digits = 1, suffix = ""): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}${suffix}`;
}

function metric(
  partial: Omit<AtlasMetric, "display"> & { digits?: number },
): AtlasMetric {
  const digits = partial.digits ?? 1;
  return {
    ...partial,
    display:
      partial.value == null ? "—" : `${partial.value.toFixed(digits)}${partial.unit ? ` ${partial.unit}` : ""}`,
  };
}

function ewmaTau(values: number[], tau: number): number[] {
  const k = 1 / tau;
  const out: number[] = [];
  let prev = values[0] ?? 0;
  for (const v of values) {
    prev = prev + k * (v - prev);
    out.push(prev);
  }
  return out;
}

function ewmaSpan(values: number[], n: number): number[] {
  const lambda = 2 / (n + 1);
  const out: number[] = [];
  let prev = values[0] ?? 0;
  for (const v of values) {
    prev = lambda * v + (1 - lambda) * prev;
    out.push(prev);
  }
  return out;
}

function rolling(values: number[], end: number, window: number): number[] {
  return values.slice(Math.max(0, end - window + 1), end + 1);
}

/** 30-min sleep/wake bins from onset/offset. Epoch hypnogram is not in the API. */
function sleepWakeGrid(
  sleeps: Sleep[],
  now: Date,
  days = 7,
  bins = 48,
): boolean[][] | null {
  const nights = sleeps.filter((s) => !s.nap);
  if (nights.length < 5) return null;
  const binMs = (24 * 60 * 60 * 1000) / bins;
  const origin = new Date(now);
  origin.setHours(0, 0, 0, 0);
  const grid: boolean[][] = [];
  for (let d = 0; d < days; d += 1) {
    const dayStart = new Date(origin);
    dayStart.setDate(origin.getDate() - (days - 1 - d));
    const row = Array.from({ length: bins }, () => false);
    for (const sleep of nights) {
      const a = new Date(sleep.start).getTime();
      const b = new Date(sleep.end).getTime();
      for (let i = 0; i < bins; i += 1) {
        const t0 = dayStart.getTime() + i * binMs;
        const t1 = t0 + binMs;
        if (a < t1 && b > t0) row[i] = true;
      }
    }
    grid.push(row);
  }
  return grid;
}

/** Phillips et al. 2017 Scientific Reports. SRI ∈ [0, 100]. */
function sleepRegularityIndex(sleeps: Sleep[], now: Date): number | null {
  const grid = sleepWakeGrid(sleeps, now);
  if (!grid || grid.length < 2) return null;
  const bins = grid[0]?.length ?? 0;
  let agree = 0;
  let pairs = 0;
  for (let d = 1; d < grid.length; d += 1) {
    for (let i = 0; i < bins; i += 1) {
      agree += grid[d][i] === grid[d - 1][i] ? 1 : 0;
      pairs += 1;
    }
  }
  if (!pairs) return null;
  return -100 + 200 * (agree / pairs);
}

/** Van Someren et al. 1999, Chronobiol Int. Rest–activity IS/IV on sleep/wake bins. */
function interdailyStability(grid: boolean[][]): number | null {
  const days = grid.length;
  const p = grid[0]?.length ?? 0;
  if (days < 5 || p < 8) return null;
  const flat = grid.flat().map((v) => (v ? 1 : 0));
  const n = flat.length;
  const grand = mean(flat);
  let denom = 0;
  for (const x of flat) denom += (x - grand) ** 2;
  if (denom === 0) return 1;
  let num = 0;
  for (let h = 0; h < p; h += 1) {
    const col = grid.map((row) => (row[h] ? 1 : 0));
    const mh = mean(col);
    num += (mh - grand) ** 2;
  }
  return (n * num) / (p * denom);
}

function intradailyVariability(grid: boolean[][]): number | null {
  const flat = grid.flat().map((v) => (v ? 1 : 0));
  const n = flat.length;
  if (n < 10) return null;
  const grand = mean(flat);
  let denom = 0;
  for (const x of flat) denom += (x - grand) ** 2;
  if (denom === 0) return 0;
  let num = 0;
  for (let i = 0; i < n - 1; i += 1) num += (flat[i] - flat[i + 1]) ** 2;
  return (n * num) / ((n - 1) * denom);
}

/** Wittmann et al. 2006 Chronobiology International. Hours. */
function socialJetlagHours(sleeps: Sleep[]): number | null {
  const nights = sleeps.filter((s) => !s.nap);
  const weekend: number[] = [];
  const weekday: number[] = [];
  for (const s of nights) {
    const mid = (new Date(s.start).getTime() + new Date(s.end).getTime()) / 2;
    const hour = new Date(mid).getHours() + new Date(mid).getMinutes() / 60;
    const dow = new Date(s.end).getDay();
    if (dow === 0 || dow === 6) weekend.push(hour);
    else weekday.push(hour);
  }
  if (!weekend.length || !weekday.length) return null;
  return Math.abs(mean(weekend) - mean(weekday));
}

/** Daniels Running Formula oxygen cost and %VO2 from duration. */
function vdotFromDistanceTime(distanceM: number, seconds: number): number | null {
  if (distanceM < 800 || seconds < 8 * 60) return null;
  const tMin = seconds / 60;
  const v = distanceM / tMin;
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const percent =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * tMin) +
    0.2989558 * Math.exp(-0.1932605 * tMin);
  if (percent <= 0) return null;
  return vo2 / percent;
}

/** ACSM running metabolic equation. VO2 ml/kg/min. Grade as decimal. */
function acsmRunningVo2(speedMPerMin: number, grade = 0): number {
  return 3.5 + 0.2 * speedMPerMin + 0.9 * speedMPerMin * grade;
}

/** ACSM walking metabolic equation. VO2 ml/kg/min. */
function acsmWalkingVo2(speedMPerMin: number, grade = 0): number {
  return 3.5 + 0.1 * speedMPerMin + 1.8 * speedMPerMin * grade;
}

/**
 * Invert Daniels VDOT for a race distance. Time in minutes.
 * Same oxygen-cost and %VO2 exponentials as vdotFromDistanceTime.
 */
function vdotRaceMinutes(vdot: number, distanceM: number): number | null {
  if (vdot < 20 || vdot > 90 || distanceM < 800) return null;
  let lo = 1.5;
  let hi = 600;
  for (let i = 0; i < 48; i += 1) {
    const tMin = (lo + hi) / 2;
    const v = distanceM / tMin;
    const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
    const percent =
      0.8 +
      0.1894393 * Math.exp(-0.012778 * tMin) +
      0.2989558 * Math.exp(-0.1932605 * tMin);
    const pred = vo2 / Math.max(0.01, percent);
    if (pred > vdot) lo = tMin;
    else hi = tMin;
  }
  return (lo + hi) / 2;
}

/** Riegel 1977 endurance formula. Seconds. */
function riegelPredict(t1s: number, d1: number, d2: number, exp = 1.06): number {
  return t1s * (d2 / d1) ** exp;
}

/**
 * Minetti et al. 2002 running energy cost vs gradient (J/kg/m).
 * i is decimal grade (0.05 = 5%).
 */
function minettiRunningCost(grade: number): number {
  const i = Math.max(-0.45, Math.min(0.45, grade));
  return (
    155.4 * i ** 5 -
    30.4 * i ** 4 -
    43.3 * i ** 3 +
    46.3 * i ** 2 +
    19.5 * i +
    3.6
  );
}

/** Stagno, Thatcher, van Someren 2007 five-zone weights, mapped onto WHOOP Z0–Z5. */
function stagnoTrimp(workout: Workout): number {
  const z = workout.score?.zone_durations;
  if (!z) return 0;
  const mins = [
    z.zone_zero_milli,
    z.zone_one_milli,
    z.zone_two_milli,
    z.zone_three_milli,
    z.zone_four_milli,
    z.zone_five_milli,
  ].map((ms) => ms / 60000);
  const weights = [1.0, 1.25, 1.71, 2.54, 3.61, 5.16];
  return mins.reduce((sum, m, i) => sum + m * (weights[i] ?? 1), 0);
}

function clockHour(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

function harrisBenedictBmr(
  weight: number,
  heightCm: number,
  age: number,
  female: boolean,
): number {
  return female
    ? 655.1 + 9.563 * weight + 1.85 * heightCm - 4.676 * age
    : 66.5 + 13.75 * weight + 5.003 * heightCm - 6.755 * age;
}

function rozaShizgalBmr(
  weight: number,
  heightCm: number,
  age: number,
  female: boolean,
): number {
  return female
    ? 447.593 + 9.247 * weight + 3.098 * heightCm - 4.33 * age
    : 88.362 + 13.397 * weight + 4.799 * heightCm - 5.677 * age;
}

function henryOxfordBmr(weight: number, age: number, female: boolean): number {
  if (age < 30) return female ? 13.1 * weight + 558 : 16.0 * weight + 545;
  if (age < 60) return female ? 9.74 * weight + 694 : 14.2 * weight + 593;
  return female ? 11.5 * weight + 694 : 13.5 * weight + 514;
}

function devineIbwKg(heightM: number, female: boolean): number {
  const inches = heightM * 39.3701;
  const over = inches - 60;
  return female ? 45.5 + 2.3 * over : 50 + 2.3 * over;
}

function bmiClass(bmi: number): string {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obesity";
}

function acwrBand(ratio: number): string {
  if (ratio < 0.8) return "underload";
  if (ratio <= 1.3) return "sweet spot";
  if (ratio <= 1.5) return "caution";
  return "spike";
}

function fitnessAgeYears(vo2: number, sex: Athlete["sex"]): number {
  const peak = sex === "female" ? 44 : 52;
  const decline = sex === "female" ? 0.35 : 0.39;
  return 20 + (peak - vo2) / decline;
}

function luciaTrimp(workout: Workout): number {
  const z = workout.score?.zone_durations;
  if (!z) return (workout.score?.strain ?? 0) * 6;
  const z1 = (z.zone_zero_milli + z.zone_one_milli + z.zone_two_milli) / 60000;
  const z2 = z.zone_three_milli / 60000;
  const z3 = (z.zone_four_milli + z.zone_five_milli) / 60000;
  return z1 * 1 + z2 * 2 + z3 * 3;
}

function banisterTrimp(
  durationMin: number,
  avgHr: number,
  restHr: number,
  maxHr: number,
  female: boolean,
): number {
  const delta = (avgHr - restHr) / Math.max(1, maxHr - restHr);
  const b = female ? 1.67 : 1.92;
  return durationMin * delta * 0.64 * Math.exp(b * delta);
}

function vo2Percentile(vo2: number, age: number, sex: Athlete["sex"]): string {
  // Simplified ACSM-style adult bands (ml/kg/min), not a lab ranking.
  const male = sex !== "female";
  const excellent = male ? (age < 40 ? 51 : 45) : age < 40 ? 44 : 38;
  const good = male ? (age < 40 ? 42 : 37) : age < 40 ? 35 : 30;
  const fair = male ? (age < 40 ? 34 : 31) : age < 40 ? 29 : 25;
  if (vo2 >= excellent) return "excellent";
  if (vo2 >= good) return "good";
  if (vo2 >= fair) return "fair";
  return "poor";
}

function unavailable(
  id: string,
  group: string,
  name: string,
  formula: string,
  citation: string,
  note: string,
): AtlasMetric {
  return metric({
    id,
    group,
    name,
    value: null,
    unit: "",
    formula,
    citation,
    confidence: "unavailable",
    note,
    digits: 0,
  });
}

export function buildAtlas(
  data: Dashboard,
  journal: JournalFlags,
  athlete: Athlete,
): AtlasReport {
  const now = referenceNow(data);
  const nowMs = now.getTime();
  const days = buildDaySeries(data);
  const today = last(days);
  const loads = days.map((d) => d.load);
  const hrv = days.map((d) => d.hrv).filter((v): v is number => v != null);
  const rhr = days.map((d) => d.rhr).filter((v): v is number => v != null);
  const temp = days.map((d) => d.temp).filter((v): v is number => v != null);
  const spo2 = days.map((d) => d.spo2).filter((v): v is number => v != null);
  const resp = days.map((d) => d.resp).filter((v): v is number => v != null);
  const maxHr = resolvedMaxHr(athlete, data.body.max_heart_rate);
  const restHr = last(rhr) ?? 60;
  const weight = data.body.weight_kilogram || 76;
  const heightM = data.body.height_meter || 1.78;
  const heightCm = heightM * 100;
  const female = athlete.sex === "female";
  const latestHrv = last(hrv);
  const lnHrv = hrv.map((v) => Math.log(Math.max(v, 1)));
  const lnToday = latestHrv != null ? Math.log(Math.max(latestHrv, 1)) : null;
  const ln7 = lnHrv.slice(-7);
  const hrv7 = hrv.slice(-7);
  const rhr7 = rhr.slice(-7);
  const rhr30 = rhr.slice(-30);

  const ctl = ewmaTau(loads, 42);
  const atl = ewmaTau(loads, 7);
  const ewmaAcute = ewmaSpan(loads, 7);
  const ewmaChronic = ewmaSpan(loads, 28);
  const lastI = Math.max(0, loads.length - 1);
  const roll7 = mean(rolling(loads, lastI, 7));
  const roll28 = mean(rolling(loads, lastI, 28)) || 1;
  const acwrRoll = roll7 / roll28;
  const acwrEwma =
    (ewmaChronic[lastI] || 1) === 0
      ? null
      : (ewmaAcute[lastI] ?? 0) / (ewmaChronic[lastI] || 1);
  const weekLoads = rolling(loads, lastI, 7);
  const monotony = stdev(weekLoads) === 0 ? null : mean(weekLoads) / stdev(weekLoads);
  const fosterStrain = monotony == null ? null : monotony * weekLoads.reduce((a, b) => a + b, 0);
  const ctlNow = ctl[lastI] ?? 0;
  const atlNow = atl[lastI] ?? 0;
  const tsb = ctlNow - atlNow;
  const ctlWeekAgo = ctl[Math.max(0, lastI - 7)] ?? ctlNow;
  const ramp = (ctlNow - ctlWeekAgo) / 7;
  const ctl45 = ewmaTau(loads, 45);
  const atl15 = ewmaTau(loads, 15);
  const tsbBanisterClassic = (ctl45[lastI] ?? 0) - (atl15[lastI] ?? 0);
  const acuteSum7 = weekLoads.reduce((a, b) => a + b, 0);
  const chronicSum28 = rolling(loads, lastI, 28).reduce((a, b) => a + b, 0);
  const prevWeek = rolling(loads, Math.max(0, lastI - 7), 7);
  const prevWeekSum = prevWeek.reduce((a, b) => a + b, 0);
  const wowLoad =
    prevWeekSum > 0 ? (acuteSum7 - prevWeekSum) / prevWeekSum : null;
  const uncoupledChronic = mean(
    loads.slice(Math.max(0, lastI - 27), Math.max(0, lastI - 6)),
  );
  const acwrUncoupled =
    uncoupledChronic > 0 ? roll7 / uncoupledChronic : null;

  const nights = data.sleeps
    .filter((s) => !s.nap && s.score)
    .slice()
    .sort((a, b) => +new Date(b.end) - +new Date(a.end));
  const lastSleep = nights[0];
  const stages = lastSleep?.score?.stage_summary;
  const tstMs = stages
    ? stages.total_light_sleep_time_milli +
      stages.total_slow_wave_sleep_time_milli +
      stages.total_rem_sleep_time_milli
    : null;
  const tibMs = stages?.total_in_bed_time_milli ?? null;
  const wasoMin = stages ? stages.total_awake_time_milli / 60000 : null;
  const remPct =
    tstMs && stages ? (100 * stages.total_rem_sleep_time_milli) / tstMs : null;
  const swsPct =
    tstMs && stages ? (100 * stages.total_slow_wave_sleep_time_milli) / tstMs : null;
  const lightPct =
    tstMs && stages ? (100 * stages.total_light_sleep_time_milli) / tstMs : null;
  const nremMs =
    stages
      ? stages.total_light_sleep_time_milli + stages.total_slow_wave_sleep_time_milli
      : 0;
  const remNrem =
    stages && nremMs > 0 ? stages.total_rem_sleep_time_milli / nremMs : null;
  const frag =
    stages && tibMs
      ? stages.disturbance_count / (tibMs / 3600000)
      : null;
  const sri = sleepRegularityIndex(data.sleeps, now);
  const sleepGrid = sleepWakeGrid(data.sleeps, now);
  const isStab = sleepGrid ? interdailyStability(sleepGrid) : null;
  const ivVar = sleepGrid ? intradailyVariability(sleepGrid) : null;
  const jetlag = socialJetlagHours(data.sleeps);
  const midpoint =
    lastSleep != null
      ? (() => {
          const mid =
            (new Date(lastSleep.start).getTime() +
              new Date(lastSleep.end).getTime()) /
            2;
          const d = new Date(mid);
          return d.getHours() + d.getMinutes() / 60;
        })()
      : null;
  const sleepDebtH = today?.sleepDebtH ?? null;
  let sleepPressureH: number | null = null;
  if (nights.length >= 2) {
    sleepPressureH =
      (new Date(nights[0].start).getTime() - new Date(nights[1].end).getTime()) /
      3600000;
  }
  const need = lastSleep?.score?.sleep_needed;
  const sleepNeedH = need
    ? (need.baseline_milli +
        need.need_from_sleep_debt_milli +
        need.need_from_recent_strain_milli +
        need.need_from_recent_nap_milli) /
      3600000
    : null;
  const onsetHour = lastSleep ? clockHour(lastSleep.start) : null;
  const offsetHour = lastSleep ? clockHour(lastSleep.end) : null;
  const tst7h = nights.slice(0, 7).map((s) => {
    const st = s.score?.stage_summary;
    if (!st) return 0;
    return (
      (st.total_light_sleep_time_milli +
        st.total_slow_wave_sleep_time_milli +
        st.total_rem_sleep_time_milli) /
      3600000
    );
  });
  const se7 = nights
    .slice(0, 7)
    .map((s) => s.score?.sleep_efficiency_percentage)
    .filter((v): v is number => v != null);
  const midpoints = nights
    .slice(0, 14)
    .map((s) => {
      const mid =
        (new Date(s.start).getTime() + new Date(s.end).getTime()) / 2;
      const d = new Date(mid);
      return d.getHours() + d.getMinutes() / 60;
    });
  const midsleepSd = midpoints.length >= 5 ? stdev(midpoints) : null;
  const weekendDur: number[] = [];
  const weekdayDur: number[] = [];
  const weekendMid: number[] = [];
  for (const s of nights) {
    const dur =
      (new Date(s.end).getTime() - new Date(s.start).getTime()) / 3600000;
    const mid =
      (new Date(s.start).getTime() + new Date(s.end).getTime()) / 2;
    const hour = new Date(mid).getHours() + new Date(mid).getMinutes() / 60;
    const dow = new Date(s.end).getDay();
    if (dow === 0 || dow === 6) {
      weekendDur.push(dur);
      weekendMid.push(hour);
    } else weekdayDur.push(dur);
  }
  const sdf = weekendDur.length ? mean(weekendDur) : null;
  const sdWeek =
    weekendDur.length + weekdayDur.length
      ? mean([...weekendDur, ...weekdayDur])
      : null;
  const msf = weekendMid.length ? mean(weekendMid) : null;
  const msfsc =
    msf != null && sdf != null && sdWeek != null
      ? sdf > sdWeek
        ? msf - 0.5 * (sdf - sdWeek)
        : msf
      : null;
  const restorativeMin =
    stages
      ? (stages.total_slow_wave_sleep_time_milli +
          stages.total_rem_sleep_time_milli) /
        60000
      : null;
  const cycleMin =
    stages && stages.sleep_cycle_count > 0 && tstMs
      ? tstMs / 60000 / stages.sleep_cycle_count
      : null;

  const weekWorkouts = data.workouts.filter(
    (w) => nowMs - new Date(w.start).getTime() < 7 * 86400000,
  );
  let zMins = [0, 0, 0, 0, 0, 0];
  let luciaWeek = 0;
  let edwardsWeek = 0;
  let stagnoWeek = 0;
  let banisterWeek = 0;
  let hrTssWeek = 0;
  const lthr = 0.9 * maxHr;
  for (const w of weekWorkouts) {
    const z = w.score?.zone_durations;
    if (z) {
      zMins[0] += z.zone_zero_milli / 60000;
      zMins[1] += z.zone_one_milli / 60000;
      zMins[2] += z.zone_two_milli / 60000;
      zMins[3] += z.zone_three_milli / 60000;
      zMins[4] += z.zone_four_milli / 60000;
      zMins[5] += z.zone_five_milli / 60000;
    }
    luciaWeek += luciaTrimp(w);
    edwardsWeek += edwardsTrimp(w.score?.zone_durations);
    stagnoWeek += stagnoTrimp(w);
    if (w.score) {
      const dur =
        (new Date(w.end).getTime() - new Date(w.start).getTime()) / 60000;
      banisterWeek += banisterTrimp(
        dur,
        w.score.average_heart_rate,
        restHr,
        maxHr,
        female,
      );
      const hrIf = w.score.average_heart_rate / lthr;
      hrTssWeek += (dur / 60) * hrIf * hrIf * 100;
    }
  }
  const litMin = zMins[0] + zMins[1] + zMins[2];
  const mitMin = zMins[3];
  const hitMin = zMins[4] + zMins[5];
  const easyMin = litMin;
  const totalZ = easyMin + mitMin + hitMin || 1;
  const polarizedPctEasy = (100 * easyMin) / totalZ;
  const polarizationIndex =
    mitMin > 0 && hitMin > 0
      ? Math.log10((litMin / mitMin) * (litMin / hitMin))
      : null;

  const latestWorkout = data.workouts[0];
  let karvonen: number | null = null;
  let banisterSession: number | null = null;
  let pctHrMax: number | null = null;
  let chronotropic: number | null = null;
  let sessionMet: number | null = null;
  let sessionMin: number | null = null;
  if (latestWorkout?.score) {
    const avg = latestWorkout.score.average_heart_rate;
    const peak = latestWorkout.score.max_heart_rate;
    karvonen = (100 * (avg - restHr)) / Math.max(1, maxHr - restHr);
    pctHrMax = (100 * avg) / maxHr;
    chronotropic =
      (peak - restHr) / Math.max(1, tanakaMaxHr(athlete.age) - restHr);
    sessionMin =
      (new Date(latestWorkout.end).getTime() -
        new Date(latestWorkout.start).getTime()) /
      60000;
    banisterSession = banisterTrimp(sessionMin, avg, restHr, maxHr, female);
    const hours = sessionMin / 60;
    sessionMet =
      hours > 0
        ? latestWorkout.score.kilojoule / 4.184 / (weight * hours)
        : null;
  }

  const uthVo2 = (15.3 * maxHr) / restHr;
  const uthVo2b = (15.0 * maxHr) / restHr;

  const runs = data.workouts.filter(
    (w) =>
      w.sport_name.toLowerCase().includes("run") &&
      (w.score?.distance_meter ?? 0) > 1500,
  );
  let bestVdot: number | null = null;
  let bestEf: number | null = null;
  let acsmVo2: number | null = null;
  let bestGapKph: number | null = null;
  let bestRunSec: number | null = null;
  let bestRunDist: number | null = null;
  let weekRunKm = 0;
  let cooperVo2: number | null = null;
  for (const run of runs) {
    const dist = run.score?.distance_meter ?? 0;
    const sec =
      (new Date(run.end).getTime() - new Date(run.start).getTime()) / 1000;
    if (nowMs - new Date(run.start).getTime() < 7 * 86400000) {
      weekRunKm += dist / 1000;
    }
    const vdot = vdotFromDistanceTime(dist, sec);
    if (vdot != null) {
      if (bestVdot == null || vdot > bestVdot) {
        bestVdot = vdot;
        bestRunSec = sec;
        bestRunDist = dist;
      }
    }
    const speedMmin = dist / (sec / 60);
    const gain = run.score?.altitude_gain_meter ?? 0;
    const grade = dist > 0 ? Math.min(0.15, gain / dist) : 0;
    acsmVo2 = Math.max(acsmVo2 ?? 0, acsmRunningVo2(speedMmin, grade));
    const kph = dist / 1000 / (sec / 3600);
    const cost = minettiRunningCost(grade);
    const flat = minettiRunningCost(0);
    const gapKph = kph * (cost / flat);
    bestGapKph = Math.max(bestGapKph ?? 0, gapKph);
    if (run.score?.average_heart_rate) {
      const ef = kph / run.score.average_heart_rate;
      bestEf = Math.max(bestEf ?? 0, ef);
    }
    if (sec >= 11 * 60 && sec <= 13 * 60) {
      cooperVo2 = Math.max(cooperVo2 ?? 0, (dist - 504.9) / 44.73);
    }
  }
  const walks = data.workouts.filter(
    (w) =>
      w.sport_name.toLowerCase().includes("walk") &&
      (w.score?.distance_meter ?? 0) > 800,
  );
  let acsmWalkVo2: number | null = null;
  for (const walk of walks) {
    const dist = walk.score?.distance_meter ?? 0;
    const sec =
      (new Date(walk.end).getTime() - new Date(walk.start).getTime()) / 1000;
    const speedMmin = dist / (sec / 60);
    const gain = walk.score?.altitude_gain_meter ?? 0;
    const grade = dist > 0 ? Math.min(0.2, gain / dist) : 0;
    acsmWalkVo2 = Math.max(acsmWalkVo2 ?? 0, acsmWalkingVo2(speedMmin, grade));
  }
  const vdot5k = bestVdot != null ? vdotRaceMinutes(bestVdot, 5000) : null;
  const vdot10k = bestVdot != null ? vdotRaceMinutes(bestVdot, 10000) : null;
  const vdotHm = bestVdot != null ? vdotRaceMinutes(bestVdot, 21097.5) : null;
  const vdotMarathon =
    bestVdot != null ? vdotRaceMinutes(bestVdot, 42195) : null;
  const riegel5k =
    bestRunSec != null && bestRunDist != null && bestRunDist > 2000
      ? riegelPredict(bestRunSec, bestRunDist, 5000) / 60
      : null;
  const riegel10k =
    bestRunSec != null && bestRunDist != null && bestRunDist > 2000
      ? riegelPredict(bestRunSec, bestRunDist, 10000) / 60
      : null;

  const bmi = weight / (heightM * heightM);
  const bsa = Math.sqrt((heightCm * weight) / 3600);
  const bmr =
    10 * weight +
    6.25 * heightCm -
    5 * athlete.age +
    (female ? -161 : athlete.sex === "male" ? 5 : -78);
  const cycleKj = today ? (data.cycles[0]?.score?.kilojoule ?? today.strain * 700) : 0;
  const activityKcal = cycleKj / 4.184;
  const tdee = bmr + activityKcal;
  const pal = tdee / Math.max(1, bmr);
  const metH = activityKcal / Math.max(1, weight);
  const hbBmr = harrisBenedictBmr(weight, heightCm, athlete.age, female);
  const rozaBmr = rozaShizgalBmr(weight, heightCm, athlete.age, female);
  const henryBmr = henryOxfordBmr(weight, athlete.age, female);
  const ibw = devineIbwKg(heightM, female);
  const ponderal = weight / heightM ** 3;
  const vo2Mets = uthVo2 / 3.5;
  const fitAge = fitnessAgeYears(uthVo2, athlete.sex);
  const lnrmssdRhr =
    lnToday != null ? lnToday / restHr : null;
  const hrvPctBaseline =
    latestHrv != null && hrv7.length >= 5
      ? (100 * latestHrv) / mean(hrv7)
      : null;
  const strain7 = mean(
    days.slice(-7).map((d) => d.strain).filter((v) => v > 0),
  );
  const whoopStrainToday = today?.strain ?? null;

  const z = (value: number | undefined, hist: number[]) => {
    if (value == null || hist.length < 4) return 0;
    const s = stdev(hist.slice(0, -1).length ? hist.slice(0, -1) : hist) || 1;
    const m = mean(hist.slice(0, -1).length ? hist.slice(0, -1) : hist);
    return (value - m) / s;
  };
  const illness =
    50 +
    12 * z(last(temp), temp) +
    10 * z(last(resp), resp) -
    12 * (lnToday != null ? z(lnToday, lnHrv) : 0) -
    8 * z(last(spo2), spo2) +
    (journal.illness ? 20 : 0);

  const luteal = athlete.cycleDay != null && athlete.cycleDay >= 15;
  const expectedRhrShift = luteal ? 3.2 : 0;

  const formBanister = tsb;
  const fitnessK1 = ctlNow;
  const fatigueK2 = atlNow * 1.25;

  const hardDays = weekLoads.filter((v) => v > mean(weekLoads)).length;
  const easyDays = weekLoads.length - hardDays;

  const sRpe =
    journal.soreness > 0 && latestWorkout
      ? journal.soreness * 2.5 *
        ((new Date(latestWorkout.end).getTime() -
          new Date(latestWorkout.start).getTime()) /
          60000)
      : null;

  const metrics: AtlasMetric[] = [
    metric({
      id: "rmssd",
      group: "Autonomic / HRV",
      name: "RMSSD",
      value: latestHrv ?? null,
      unit: "ms",
      formula: "√ mean of squared successive RR differences (WHOOP overnight)",
      citation: "Task Force of ESC/NASPE 1996, Eur Heart J",
      confidence: "measured",
      digits: 1,
    }),
    metric({
      id: "lnrmssd",
      group: "Autonomic / HRV",
      name: "ln RMSSD",
      value: lnToday,
      unit: "ln ms",
      formula: "ln(RMSSD)",
      citation: "Plews et al. 2013, Eur J Sport Sci; HRV4Training",
      confidence: "derived",
      digits: 3,
    }),
    metric({
      id: "lnrmssd7",
      group: "Autonomic / HRV",
      name: "ln RMSSD 7-day mean",
      value: ln7.length ? mean(ln7) : null,
      unit: "ln ms",
      formula: "mean(ln RMSSD, last 7 nights)",
      citation: "Plews et al. 2012, Int J Sports Physiol Perform",
      confidence: "derived",
      digits: 3,
    }),
    metric({
      id: "hrv-cv",
      group: "Autonomic / HRV",
      name: "HRV coefficient of variation",
      value: hrv7.length >= 5 && mean(hrv7) ? (100 * stdev(hrv7)) / mean(hrv7) : null,
      unit: "%",
      formula: "100 × SD(RMSSD_7) / mean(RMSSD_7)",
      citation: "Plews / Flatt; higher CV often = more perturbation",
      confidence: "derived",
      digits: 1,
    }),
    metric({
      id: "hrv-rhr",
      group: "Autonomic / HRV",
      name: "RMSSD : RHR",
      value: latestHrv != null ? latestHrv / restHr : null,
      unit: "ms/bpm",
      formula: "RMSSD / resting HR",
      citation: "Combined autonomic index used in applied sport science",
      confidence: "derived",
      digits: 2,
    }),
    metric({
      id: "lnrmssd-rhr",
      group: "Autonomic / HRV",
      name: "ln RMSSD : RHR",
      value: lnrmssdRhr,
      unit: "ln ms/bpm",
      formula: "ln(RMSSD) / resting HR",
      citation: "Flatt & Esco 2016; applied HRV:RHR composites",
      confidence: lnrmssdRhr != null ? "derived" : "unavailable",
      digits: 3,
    }),
    metric({
      id: "hrv-baseline-pct",
      group: "Autonomic / HRV",
      name: "RMSSD vs 7-day mean",
      value: hrvPctBaseline,
      unit: "%",
      formula: "100 × RMSSD_today / mean(RMSSD_7)",
      citation: "Plews rolling baseline; ~100% is typical, <<90% often a red flag",
      confidence: hrvPctBaseline != null ? "derived" : "unavailable",
      digits: 0,
    }),
    metric({
      id: "hrv-z",
      group: "Autonomic / HRV",
      name: "ln RMSSD z-score (14d)",
      value: lnToday != null && lnHrv.length > 5 ? z(lnToday, lnHrv) : null,
      unit: "σ",
      formula: "(x − mean_14) / SD_14 on ln RMSSD",
      citation: "Buchheit 2014, Front Physiol; HRV4Training z-score",
      confidence: "derived",
      digits: 2,
    }),
    metric({
      id: "rhr",
      group: "Heart rate",
      name: "Resting HR",
      value: restHr,
      unit: "bpm",
      formula: "Overnight nadir / WHOOP resting HR",
      citation: "WHOOP recovery payload; ESC resting HR literature",
      confidence: "measured",
      digits: 0,
    }),
    metric({
      id: "rhr7",
      group: "Heart rate",
      name: "RHR 7-day mean",
      value: rhr7.length ? mean(rhr7) : null,
      unit: "bpm",
      formula: "mean(RHR, 7 nights)",
      citation: "Standard rolling baseline",
      confidence: "derived",
      digits: 1,
    }),
    metric({
      id: "rhr-delta30",
      group: "Heart rate",
      name: "RHR vs 30-day mean",
      value: rhr30.length ? restHr - mean(rhr30) : null,
      unit: "bpm",
      formula: "RHR_today − mean(RHR_30)",
      citation: "Positive drift is a classic overreaching flag",
      confidence: "derived",
      digits: 1,
      note: luteal ? `Luteal-phase expected +~3 bpm (cycle day ${athlete.cycleDay})` : undefined,
    }),
    metric({
      id: "hrmax-whoop",
      group: "Heart rate",
      name: "HRmax (WHOOP body)",
      value: data.body.max_heart_rate || null,
      unit: "bpm",
      formula: "WHOOP body measurement",
      citation: "WHOOP API /v2/user/measurement/body",
      confidence: "measured",
      digits: 0,
    }),
    metric({
      id: "hrmax-tanaka",
      group: "Heart rate",
      name: "HRmax Tanaka",
      value: tanakaMaxHr(athlete.age),
      unit: "bpm",
      formula: "208 − 0.7 × age",
      citation: "Tanaka, Monahan, Seals 2001, JACC",
      confidence: "estimated",
      digits: 0,
    }),
    metric({
      id: "hrmax-fox",
      group: "Heart rate",
      name: "HRmax Fox",
      value: foxMaxHr(athlete.age),
      unit: "bpm",
      formula: "220 − age",
      citation: "Fox & Haskell (widely used, larger error than Tanaka)",
      confidence: "estimated",
      digits: 0,
    }),
    metric({
      id: "hrmax-gellish",
      group: "Heart rate",
      name: "HRmax Gellish",
      value: gellishMaxHr(athlete.age),
      unit: "bpm",
      formula: "207 − 0.7 × age",
      citation: "Gellish et al. 2007, Med Sci Sports Exerc",
      confidence: "estimated",
      digits: 0,
    }),
    metric({
      id: "hrmax-nes",
      group: "Heart rate",
      name: "HRmax Nes",
      value: nesMaxHr(athlete.age),
      unit: "bpm",
      formula: "211 − 0.64 × age",
      citation: "Nes, Janszky, Wisløff, Støylen 2013, Scand J Med Sci Sports",
      confidence: "estimated",
      digits: 0,
    }),
    metric({
      id: "hrmax-gulati",
      group: "Heart rate",
      name: "HRmax Gulati (women)",
      value: gulatiMaxHr(athlete.age),
      unit: "bpm",
      formula: "206 − 0.88 × age",
      citation: "Gulati et al. 2010, Circulation (derived in women)",
      confidence: "estimated",
      digits: 0,
    }),
    metric({
      id: "hrmax-used",
      group: "Heart rate",
      name: "HRmax used in Aether",
      value: maxHr,
      unit: "bpm",
      formula: "override > WHOOP body > Tanaka",
      citation: "Resolved for Karvonen / TRIMP",
      confidence: "derived",
      digits: 0,
    }),
    metric({
      id: "hrr",
      group: "Heart rate",
      name: "Heart rate reserve",
      value: maxHr - restHr,
      unit: "bpm",
      formula: "HRmax − HRrest",
      citation: "Karvonen, Kentala, Mustala 1957",
      confidence: "derived",
      digits: 0,
    }),
    metric({
      id: "karvonen",
      group: "Heart rate",
      name: "%HRR last workout",
      value: karvonen,
      unit: "%",
      formula: "100 × (HRavg − HRrest) / (HRmax − HRrest)",
      citation: "Karvonen method",
      confidence: latestWorkout ? "derived" : "unavailable",
      digits: 0,
    }),
    metric({
      id: "pct-hrmax",
      group: "Heart rate",
      name: "%HRmax last workout",
      value: pctHrMax,
      unit: "%",
      formula: "100 × HRavg / HRmax",
      citation: "ACSM relative intensity (%HRmax)",
      confidence: pctHrMax != null ? "derived" : "unavailable",
      digits: 0,
    }),
    metric({
      id: "chronotropic",
      group: "Heart rate",
      name: "Chronotropic index",
      value: chronotropic,
      unit: "ratio",
      formula: "(HRpeak − HRrest) / (HRmax_Tanaka − HRrest)",
      citation: "Lauer et al. 1996/1999; abnormal often <0.80",
      confidence: chronotropic != null ? "estimated" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "lthr",
      group: "Heart rate",
      name: "LTHR estimate",
      value: lthr,
      unit: "bpm",
      formula: "0.90 × HRmax",
      citation: "Friel-style lactate-threshold HR proxy, not a 30-min TT",
      confidence: "estimated",
      digits: 0,
    }),
    metric({
      id: "edwards-week",
      group: "Training load",
      name: "Edwards TRIMP (7d)",
      value: edwardsWeek,
      unit: "AU",
      formula: "Σ zone_minutes_i × i  (Z0×0.5 … Z5×5)",
      citation: "Edwards S. The Heart Rate Monitor Book, 1993",
      confidence: "derived",
      digits: 0,
    }),
    metric({
      id: "lucia-week",
      group: "Training load",
      name: "Lucia TRIMP (7d)",
      value: luciaWeek,
      unit: "AU",
      formula: "Z1×1 + Z2×2 + Z3×3 (collapsed 5-zone → 3-zone)",
      citation: "Lucía et al. 1999 / 2003, Med Sci Sports Exerc",
      confidence: "derived",
      digits: 0,
    }),
    metric({
      id: "stagno-week",
      group: "Training load",
      name: "Stagno TRIMP (7d)",
      value: stagnoWeek,
      unit: "AU",
      formula: "Σ zone_min × [1.00, 1.25, 1.71, 2.54, 3.61, 5.16] on WHOOP Z0–Z5",
      citation: "Stagno, Thatcher, van Someren 2007, J Sports Sci (zone edges approximated)",
      confidence: "estimated",
      digits: 0,
    }),
    metric({
      id: "banister-week",
      group: "Training load",
      name: "Banister TRIMP (7d)",
      value: banisterWeek,
      unit: "AU",
      formula: "Σ duration × ΔHR × 0.64 × e^{bΔHR}",
      citation: "Banister 1991; Morton, Fitz-Clarke, Banister 1990",
      confidence: "derived",
      digits: 0,
    }),
    metric({
      id: "hrtss-week",
      group: "Training load",
      name: "hrTSS (7d)",
      value: hrTssWeek,
      unit: "AU",
      formula: "Σ hours × (HRavg / LTHR)² × 100, LTHR = 0.90×HRmax",
      citation: "TrainingPeaks hrTSS (Coggan HR analog of TSS)",
      confidence: "estimated",
      digits: 0,
      note: "True hrTSS needs a measured LTHR from a 30-min test, not 90% HRmax.",
    }),
    metric({
      id: "banister-session",
      group: "Training load",
      name: "Banister TRIMP last session",
      value: banisterSession,
      unit: "AU",
      formula: "duration × ΔHR × 0.64 × e^{bΔHR}, b=1.92 (m) / 1.67 (f)",
      citation: "Banister 1991; Morton, Fitz-Clarke, Banister 1990",
      confidence: banisterSession != null ? "derived" : "unavailable",
      digits: 1,
    }),
    metric({
      id: "ctl",
      group: "Training load",
      name: "CTL / fitness (EWMA 42)",
      value: ctlNow,
      unit: "AU",
      formula: "CTL_t = CTL_{t-1} + (load − CTL_{t-1}) / 42",
      citation: "Banister; Coggan/Allen TrainingPeaks CTL",
      confidence: "derived",
      digits: 1,
    }),
    metric({
      id: "atl",
      group: "Training load",
      name: "ATL / fatigue (EWMA 7)",
      value: atlNow,
      unit: "AU",
      formula: "ATL_t = ATL_{t-1} + (load − ATL_{t-1}) / 7",
      citation: "Coggan/Allen TrainingPeaks ATL",
      confidence: "derived",
      digits: 1,
    }),
    metric({
      id: "tsb",
      group: "Training load",
      name: "TSB / form",
      value: tsb,
      unit: "AU",
      formula: "CTL − ATL",
      citation: "Allen & Coggan, Training and Racing with a Power Meter",
      confidence: "derived",
      digits: 1,
    }),
    metric({
      id: "banister-form",
      group: "Training load",
      name: "Banister performance proxy",
      value: fitnessK1 - fatigueK2,
      unit: "AU",
      formula: "k1·fitness − k2·fatigue, k1=1, k2=1.25, τ=42/7",
      citation: "Banister EW 1975/1991 impulse-response",
      confidence: "estimated",
      digits: 1,
      note: "Not a race prediction. Same family as TSB with heavier fatigue weight.",
    }),
    metric({
      id: "acwr-roll",
      group: "Training load",
      name: "ACWR rolling 7:28",
      value: acwrRoll,
      unit: "ratio",
      formula: "mean(load_7) / mean(load_28)",
      citation: "Gabbett 2016, Br J Sports Med — sweet spot ~0.8–1.3",
      confidence: "derived",
      digits: 2,
    }),
    metric({
      id: "acwr-ewma",
      group: "Training load",
      name: "ACWR EWMA 7:28",
      value: acwrEwma,
      unit: "ratio",
      formula: "EWMA7 / EWMA28 with λ=2/(N+1)",
      citation: "Murray et al. 2017, Br J Sports Med (uncoupled EWMA)",
      confidence: "derived",
      digits: 2,
      note: acwrEwma != null ? `Band: ${acwrBand(acwrEwma)}` : undefined,
    }),
    metric({
      id: "acwr-uncoupled",
      group: "Training load",
      name: "ACWR uncoupled 7:21",
      value: acwrUncoupled,
      unit: "ratio",
      formula: "mean(load_7) / mean(load days 8–28)",
      citation: "Lolli / Windt / Gabbett debate; uncoupled chronic window",
      confidence: acwrUncoupled != null ? "derived" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "acute-load",
      group: "Training load",
      name: "Acute load sum (7d)",
      value: acuteSum7,
      unit: "AU",
      formula: "Σ daily load, last 7 days",
      citation: "Gabbett acute workload",
      confidence: "derived",
      digits: 0,
    }),
    metric({
      id: "chronic-load",
      group: "Training load",
      name: "Chronic load sum (28d)",
      value: chronicSum28,
      unit: "AU",
      formula: "Σ daily load, last 28 days",
      citation: "Gabbett chronic workload",
      confidence: "derived",
      digits: 0,
    }),
    metric({
      id: "wow-load",
      group: "Training load",
      name: "Week-over-week load Δ",
      value: wowLoad != null ? 100 * wowLoad : null,
      unit: "%",
      formula: "100 × (sum_this_week − sum_last_week) / sum_last_week",
      citation: "Weekly workload spike; rapid rises raise injury odds",
      confidence: wowLoad != null ? "derived" : "unavailable",
      digits: 0,
    }),
    metric({
      id: "tsb-4515",
      group: "Training load",
      name: "Banister TSB τ=45/15",
      value: tsbBanisterClassic,
      unit: "AU",
      formula: "EWMA42→45 fitness − EWMA15 fatigue",
      citation: "Banister impulse-response with classic endurance time constants",
      confidence: "derived",
      digits: 1,
    }),
    metric({
      id: "ramp",
      group: "Training load",
      name: "CTL ramp rate",
      value: ramp,
      unit: "AU/day",
      formula: "(CTL_today − CTL_7d_ago) / 7",
      citation: "TrainingPeaks ramp rate; rapid rises raise injury odds",
      confidence: "derived",
      digits: 2,
    }),
    metric({
      id: "monotony",
      group: "Training load",
      name: "Foster monotony (7d)",
      value: monotony,
      unit: "AU",
      formula: "mean(daily load) / SD(daily load)",
      citation: "Foster 1998, Med Sci Sports Exerc. Warning if >2.0",
      confidence: weekLoads.length >= 5 ? "derived" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "foster-strain",
      group: "Training load",
      name: "Foster strain (7d)",
      value: fosterStrain,
      unit: "AU",
      formula: "monotony × weekly load sum",
      citation: "Foster 1998",
      confidence: fosterStrain != null ? "derived" : "unavailable",
      digits: 0,
    }),
    metric({
      id: "srpe",
      group: "Training load",
      name: "Session-RPE proxy",
      value: sRpe,
      unit: "AU",
      formula: "soreness(0–3)×2.5 × duration_min  (stand-in for CR-10 × min)",
      citation: "Foster et al. 2001 session-RPE. True CR-10 needs your 0–10 rating.",
      confidence: sRpe != null ? "estimated" : "unavailable",
      digits: 0,
      note: "Set soreness on Today to approximate. Log a real RPE in a future version for textbook sRPE.",
    }),
    metric({
      id: "hard-easy",
      group: "Intensity distribution",
      name: "Hard : easy days (7d)",
      value: easyDays ? hardDays / easyDays : null,
      unit: "ratio",
      formula: "days above mean load / days at or below",
      citation: "Seiler polarized training practice",
      confidence: "derived",
      digits: 2,
    }),
    metric({
      id: "seiler-easy",
      group: "Intensity distribution",
      name: "Seiler easy share",
      value: polarizedPctEasy,
      unit: "%",
      formula: "100 × (Z0+Z1+Z2 minutes) / all zone minutes, 7d",
      citation: "Seiler 2010 IJSPP; ~80% easy in polarized model",
      confidence: "derived",
      digits: 0,
    }),
    metric({
      id: "pi-treff",
      group: "Intensity distribution",
      name: "Polarization index",
      value: polarizationIndex,
      unit: "PI",
      formula: "log10((LIT/MIT)×(LIT/HIT)); LIT=Z0–Z2, MIT=Z3, HIT=Z4–Z5",
      citation: "Treff et al. 2019, IJSPP. Polarized often PI ≥ 2.00",
      confidence: polarizationIndex != null ? "derived" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "lit-min",
      group: "Intensity distribution",
      name: "LIT minutes (7d)",
      value: litMin,
      unit: "min",
      formula: "Z0 + Z1 + Z2 minutes",
      citation: "Seiler 3-zone model, low-intensity training",
      confidence: "derived",
      digits: 0,
    }),
    metric({
      id: "mit-min",
      group: "Intensity distribution",
      name: "MIT minutes (7d)",
      value: mitMin,
      unit: "min",
      formula: "Z3 minutes",
      citation: "Seiler 3-zone model, moderate / threshold",
      confidence: "derived",
      digits: 0,
    }),
    metric({
      id: "hit-min",
      group: "Intensity distribution",
      name: "HIT minutes (7d)",
      value: hitMin,
      unit: "min",
      formula: "Z4 + Z5 minutes",
      citation: "Seiler 3-zone model, high-intensity",
      confidence: "derived",
      digits: 0,
    }),
    metric({
      id: "z0-min",
      group: "Intensity distribution",
      name: "Zone 0 minutes (7d)",
      value: zMins[0],
      unit: "min",
      formula: "Σ zone_zero_milli / 60000",
      citation: "WHOOP 6-zone model",
      confidence: "measured",
      digits: 0,
    }),
    metric({
      id: "z1-min",
      group: "Intensity distribution",
      name: "Zone 1 minutes (7d)",
      value: zMins[1],
      unit: "min",
      formula: "Σ zone_one_milli / 60000",
      citation: "WHOOP 6-zone model",
      confidence: "measured",
      digits: 0,
    }),
    metric({
      id: "z3-min",
      group: "Intensity distribution",
      name: "Zone 3 minutes (7d)",
      value: zMins[3],
      unit: "min",
      formula: "Σ zone_three_milli / 60000",
      citation: "WHOOP 6-zone model",
      confidence: "measured",
      digits: 0,
    }),
    metric({
      id: "z2-min",
      group: "Intensity distribution",
      name: "Zone 2 minutes (7d)",
      value: zMins[2],
      unit: "min",
      formula: "Σ zone_two_milli / 60000",
      citation: "San-Millán / Iñigo San Millán zone 2 practice",
      confidence: "derived",
      digits: 0,
    }),
    metric({
      id: "z4z5",
      group: "Intensity distribution",
      name: "Time ≥ Z4 (7d)",
      value: zMins[4] + zMins[5],
      unit: "min",
      formula: "Z4 + Z5 minutes",
      citation: "High-intensity distribution / threshold+VO2 work",
      confidence: "derived",
      digits: 0,
    }),
    metric({
      id: "uth-vo2",
      group: "Aerobic / VO2",
      name: "VO2max Uth–Sørensen",
      value: uthVo2,
      unit: "ml/kg/min",
      formula: "15.3 × HRmax / HRrest",
      citation: "Uth, Sørensen, Overgaard, Pedersen 2004, Eur J Appl Physiol",
      confidence: "estimated",
      digits: 1,
      note: `Band: ${vo2Percentile(uthVo2, athlete.age, athlete.sex)} vs simplified ACSM adult bands`,
    }),
    metric({
      id: "uth-vo2-15",
      group: "Aerobic / VO2",
      name: "VO2max 15× ratio",
      value: uthVo2b,
      unit: "ml/kg/min",
      formula: "15 × HRmax / HRrest",
      citation: "Common simplification of Uth 2004",
      confidence: "estimated",
      digits: 1,
    }),
    metric({
      id: "vdot",
      group: "Aerobic / VO2",
      name: "Daniels VDOT (best run)",
      value: bestVdot,
      unit: "VDOT",
      formula: "VO2(v)=−4.60+0.182258v+0.000104v²; %VO2 from duration exponentials",
      citation: "Daniels J. Daniels' Running Formula",
      confidence: bestVdot != null ? "estimated" : "unavailable",
      digits: 1,
      note: "Training runs are not races — treats best 42d run as a time trial.",
    }),
    metric({
      id: "acsm-run",
      group: "Aerobic / VO2",
      name: "ACSM running VO2",
      value: acsmVo2,
      unit: "ml/kg/min",
      formula: "3.5 + 0.2v + 0.9v·grade, v in m/min, grade = gain/distance",
      citation: "ACSM Guidelines for Exercise Testing and Prescription",
      confidence: acsmVo2 != null ? "estimated" : "unavailable",
      digits: 1,
    }),
    metric({
      id: "acsm-walk",
      group: "Aerobic / VO2",
      name: "ACSM walking VO2",
      value: acsmWalkVo2,
      unit: "ml/kg/min",
      formula: "3.5 + 0.1v + 1.8v·grade, v in m/min",
      citation: "ACSM walking metabolic equation",
      confidence: acsmWalkVo2 != null ? "estimated" : "unavailable",
      digits: 1,
    }),
    metric({
      id: "cooper-vo2",
      group: "Aerobic / VO2",
      name: "Cooper 12-min VO2max",
      value: cooperVo2,
      unit: "ml/kg/min",
      formula: "(distance_m − 504.9) / 44.73 on an 11–13 min run",
      citation: "Cooper KH 1968, JAMA",
      confidence: cooperVo2 != null ? "estimated" : "unavailable",
      digits: 1,
      note: "Needs a ~12-minute maximal run. Training jogs do not qualify.",
    }),
    metric({
      id: "vo2-mets",
      group: "Aerobic / VO2",
      name: "VO2max in METs",
      value: vo2Mets,
      unit: "METs",
      formula: "Uth VO2max / 3.5",
      citation: "Ainsworth Compendium; 1 MET = 3.5 ml/kg/min",
      confidence: "estimated",
      digits: 1,
    }),
    metric({
      id: "fitness-age",
      group: "Aerobic / VO2",
      name: "Fitness age (VO2 inversion)",
      value: fitAge,
      unit: "y",
      formula: "20 + (peak20 − VO2) / decline, peak≈52/44, decline≈0.39/0.35",
      citation: "Linear inversion of ACSM-style 50th-percentile VO2 vs age — not FRIEND registry",
      confidence: "estimated",
      digits: 0,
    }),
    metric({
      id: "vdot-5k",
      group: "Aerobic / VO2",
      name: "Daniels 5K from VDOT",
      value: vdot5k,
      unit: "min",
      formula: "Invert Daniels oxygen-cost + %VO2 exponentials at 5000 m",
      citation: "Daniels' Running Formula",
      confidence: vdot5k != null ? "estimated" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "vdot-10k",
      group: "Aerobic / VO2",
      name: "Daniels 10K from VDOT",
      value: vdot10k,
      unit: "min",
      formula: "Invert Daniels equations at 10000 m",
      citation: "Daniels' Running Formula",
      confidence: vdot10k != null ? "estimated" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "vdot-hm",
      group: "Aerobic / VO2",
      name: "Daniels half marathon from VDOT",
      value: vdotHm,
      unit: "min",
      formula: "Invert Daniels equations at 21097.5 m",
      citation: "Daniels' Running Formula",
      confidence: vdotHm != null ? "estimated" : "unavailable",
      digits: 1,
    }),
    metric({
      id: "vdot-marathon",
      group: "Aerobic / VO2",
      name: "Daniels marathon from VDOT",
      value: vdotMarathon,
      unit: "min",
      formula: "Invert Daniels equations at 42195 m",
      citation: "Daniels' Running Formula",
      confidence: vdotMarathon != null ? "estimated" : "unavailable",
      digits: 1,
    }),
    metric({
      id: "ef-run",
      group: "Running",
      name: "Efficiency factor (run)",
      value: bestEf,
      unit: "kph/bpm",
      formula: "speed (km/h) / average HR",
      citation: "Allen/Coggan efficiency factor adapted to running",
      confidence: bestEf != null ? "derived" : "unavailable",
      digits: 3,
    }),
    metric({
      id: "gap-run",
      group: "Running",
      name: "Grade-adjusted speed",
      value: bestGapKph,
      unit: "km/h",
      formula: "speed × Cr(grade) / Cr(0), Cr from Minetti quintic",
      citation: "Minetti, Moia, Roi, Susta, Ferretti 2002, J Physiol / J Exp Biol",
      confidence: bestGapKph != null ? "estimated" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "riegel-5k",
      group: "Running",
      name: "Riegel 5K equivalent",
      value: riegel5k,
      unit: "min",
      formula: "T2 = T1 × (D2/D1)^1.06",
      citation: "Riegel P. 1977, Runner's World / IAAF endurance formula",
      confidence: riegel5k != null ? "estimated" : "unavailable",
      digits: 2,
      note: "Endurance exponent 1.06 assumes a race effort, not an easy run.",
    }),
    metric({
      id: "riegel-10k",
      group: "Running",
      name: "Riegel 10K equivalent",
      value: riegel10k,
      unit: "min",
      formula: "T2 = T1 × (D2/D1)^1.06",
      citation: "Riegel P. 1977",
      confidence: riegel10k != null ? "estimated" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "run-km-week",
      group: "Running",
      name: "Running volume (7d)",
      value: weekRunKm || null,
      unit: "km",
      formula: "Σ distance_meter / 1000 for running, last 7 days",
      citation: "Weekly running volume",
      confidence: weekRunKm > 0 ? "measured" : "unavailable",
      digits: 1,
    }),
    metric({
      id: "session-met",
      group: "Running",
      name: "Last session METs",
      value: sessionMet,
      unit: "METs",
      formula: "(kJ / 4.184) / (kg × hours)",
      citation: "Ainsworth Compendium operationalization of WHOOP kilojoule",
      confidence: sessionMet != null ? "estimated" : "unavailable",
      digits: 1,
    }),
    metric({
      id: "tst",
      group: "Sleep architecture",
      name: "Total sleep time",
      value: tstMs != null ? tstMs / 3600000 : null,
      unit: "h",
      formula: "light + SWS + REM (excludes WASO)",
      citation: "AASM scoring; WHOOP stage_summary",
      confidence: tstMs != null ? "measured" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "tib",
      group: "Sleep architecture",
      name: "Time in bed",
      value: tibMs != null ? tibMs / 3600000 : null,
      unit: "h",
      formula: "total_in_bed_time_milli",
      citation: "AASM TIB",
      confidence: tibMs != null ? "measured" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "se",
      group: "Sleep architecture",
      name: "Sleep efficiency",
      value: lastSleep?.score?.sleep_efficiency_percentage ?? null,
      unit: "%",
      formula: "100 × TST / TIB",
      citation: "AASM; WHOOP sleep_efficiency_percentage",
      confidence: "measured",
      digits: 1,
    }),
    metric({
      id: "sleep-perf",
      group: "Sleep architecture",
      name: "Sleep performance",
      value: lastSleep?.score?.sleep_performance_percentage ?? null,
      unit: "%",
      formula: "WHOOP sleep_performance_percentage",
      citation: "WHOOP sleep score (proprietary ratio of TST to need)",
      confidence: "measured",
      digits: 0,
    }),
    metric({
      id: "sleep-consistency",
      group: "Sleep architecture",
      name: "Sleep consistency",
      value: lastSleep?.score?.sleep_consistency_percentage ?? null,
      unit: "%",
      formula: "WHOOP sleep_consistency_percentage",
      citation: "WHOOP sleep score (proprietary schedule regularity)",
      confidence: "measured",
      digits: 0,
    }),
    metric({
      id: "sleep-need",
      group: "Sleep architecture",
      name: "Sleep need",
      value: sleepNeedH,
      unit: "h",
      formula: "(baseline + debt + strain + nap)_milli / 3600000",
      citation: "WHOOP sleep_needed components; Process S analog",
      confidence: sleepNeedH != null ? "measured" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "need-baseline",
      group: "Sleep architecture",
      name: "Need from baseline",
      value: need ? need.baseline_milli / 3600000 : null,
      unit: "h",
      formula: "sleep_needed.baseline_milli",
      citation: "WHOOP sleep_needed.baseline_milli",
      confidence: need ? "measured" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "need-debt",
      group: "Sleep architecture",
      name: "Need from debt",
      value: need ? need.need_from_sleep_debt_milli / 3600000 : null,
      unit: "h",
      formula: "sleep_needed.need_from_sleep_debt_milli",
      citation: "WHOOP sleep_needed",
      confidence: need ? "measured" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "need-strain",
      group: "Sleep architecture",
      name: "Need from strain",
      value: need ? need.need_from_recent_strain_milli / 3600000 : null,
      unit: "h",
      formula: "sleep_needed.need_from_recent_strain_milli",
      citation: "WHOOP sleep_needed",
      confidence: need ? "measured" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "tst7",
      group: "Sleep architecture",
      name: "TST 7-night mean",
      value: tst7h.length ? mean(tst7h) : null,
      unit: "h",
      formula: "mean(light+SWS+REM, 7 nights)",
      citation: "AASM TST rolling baseline",
      confidence: tst7h.length ? "derived" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "se7",
      group: "Sleep architecture",
      name: "Efficiency 7-night mean",
      value: se7.length ? mean(se7) : null,
      unit: "%",
      formula: "mean(sleep_efficiency, 7 nights)",
      citation: "AASM SE rolling baseline",
      confidence: se7.length ? "derived" : "unavailable",
      digits: 1,
    }),
    metric({
      id: "restorative",
      group: "Sleep architecture",
      name: "Restorative sleep",
      value: restorativeMin,
      unit: "min",
      formula: "(SWS + REM) / 60000",
      citation: "SWS+REM as slow-wave + REM restorative block",
      confidence: restorativeMin != null ? "derived" : "unavailable",
      digits: 0,
    }),
    metric({
      id: "cycle-len",
      group: "Sleep architecture",
      name: "Mean cycle length",
      value: cycleMin,
      unit: "min",
      formula: "TST minutes / sleep_cycle_count",
      citation: "Ultradian ~90 min cycles, Aserinsky & Kleitman 1953",
      confidence: cycleMin != null ? "derived" : "unavailable",
      digits: 0,
    }),
    metric({
      id: "onset",
      group: "Sleep architecture",
      name: "Sleep onset",
      value: onsetHour,
      unit: "h local",
      formula: "clock hour of sleep.start",
      citation: "WHOOP sleep start (detected, not lights-out)",
      confidence: onsetHour != null ? "measured" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "offset",
      group: "Sleep architecture",
      name: "Sleep offset",
      value: offsetHour,
      unit: "h local",
      formula: "clock hour of sleep.end",
      citation: "WHOOP sleep end",
      confidence: offsetHour != null ? "measured" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "waso",
      group: "Sleep architecture",
      name: "WASO",
      value: wasoMin,
      unit: "min",
      formula: "total_awake_time_milli / 60000",
      citation: "Wake after sleep onset, AASM",
      confidence: wasoMin != null ? "measured" : "unavailable",
      digits: 0,
    }),
    metric({
      id: "awakenings",
      group: "Sleep architecture",
      name: "Disturbances",
      value: stages?.disturbance_count ?? null,
      unit: "count",
      formula: "WHOOP disturbance_count",
      citation: "WHOOP sleep stage_summary",
      confidence: "measured",
      digits: 0,
    }),
    metric({
      id: "fragmentation",
      group: "Sleep architecture",
      name: "Fragmentation index",
      value: frag,
      unit: "/h",
      formula: "disturbances / TIB hours",
      citation: "Sleep fragmentation indices (AASM-related)",
      confidence: frag != null ? "derived" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "rem-pct",
      group: "Sleep architecture",
      name: "REM fraction",
      value: remPct,
      unit: "% TST",
      formula: "100 × REM / TST",
      citation: "AASM; adult REM typically ~20–25%",
      confidence: remPct != null ? "derived" : "unavailable",
      digits: 1,
    }),
    metric({
      id: "sws-pct",
      group: "Sleep architecture",
      name: "Slow-wave fraction",
      value: swsPct,
      unit: "% TST",
      formula: "100 × SWS / TST",
      citation: "AASM N3; typically ~15–25% in young adults",
      confidence: swsPct != null ? "derived" : "unavailable",
      digits: 1,
    }),
    metric({
      id: "light-pct",
      group: "Sleep architecture",
      name: "Light fraction",
      value: lightPct,
      unit: "% TST",
      formula: "100 × light / TST",
      citation: "AASM N1+N2 collapsed by WHOOP as light",
      confidence: lightPct != null ? "derived" : "unavailable",
      digits: 1,
    }),
    metric({
      id: "rem-nrem",
      group: "Sleep architecture",
      name: "REM : NREM",
      value: remNrem,
      unit: "ratio",
      formula: "REM / (light + SWS)",
      citation: "Sleep architecture ratio",
      confidence: remNrem != null ? "derived" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "cycles",
      group: "Sleep architecture",
      name: "Sleep cycles",
      value: stages?.sleep_cycle_count ?? null,
      unit: "count",
      formula: "WHOOP sleep_cycle_count",
      citation: "Ultradian ~90 min cycles, Aserinsky & Kleitman 1953",
      confidence: "measured",
      digits: 0,
    }),
    metric({
      id: "rr",
      group: "Sleep architecture",
      name: "Overnight respiratory rate",
      value: lastSleep?.score?.respiratory_rate ?? null,
      unit: "/min",
      formula: "WHOOP respiratory_rate",
      citation: "WHOOP sleep score",
      confidence: "measured",
      digits: 2,
    }),
    metric({
      id: "sleep-debt",
      group: "Sleep architecture",
      name: "Sleep debt",
      value: sleepDebtH,
      unit: "h",
      formula: "need − TIB, need from WHOOP sleep_needed components",
      citation: "Process S (Borbély 1982) operationalized via WHOOP need",
      confidence: sleepDebtH != null ? "derived" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "sleep-pressure",
      group: "Sleep architecture",
      name: "Prior wake (sleep pressure)",
      value: sleepPressureH,
      unit: "h",
      formula: "sleep_onset − previous sleep_offset",
      citation: "Borbély two-process model, Process S",
      confidence: sleepPressureH != null ? "derived" : "unavailable",
      digits: 1,
    }),
    metric({
      id: "sri",
      group: "Chronobiology",
      name: "Sleep Regularity Index",
      value: sri,
      unit: "SRI",
      formula: "−100 + 200 × agreement of 30-min sleep/wake bins on consecutive days",
      citation: "Phillips, Clerx et al. 2017, Scientific Reports",
      confidence: sri != null ? "derived" : "unavailable",
      digits: 0,
    }),
    metric({
      id: "sjl",
      group: "Chronobiology",
      name: "Social jetlag",
      value: jetlag,
      unit: "h",
      formula: "|midsleep_weekend − midsleep_weekday|",
      citation: "Wittmann, Dinich, Merrow, Roenneberg 2006, Chronobiol Int",
      confidence: jetlag != null ? "derived" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "msf",
      group: "Chronobiology",
      name: "Midsleep last night",
      value: midpoint,
      unit: "h local",
      formula: "(sleep_onset + sleep_offset) / 2 as clock hour",
      citation: "Roenneberg MCTQ; MSF midpoint of sleep on free days",
      confidence: midpoint != null ? "derived" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "msfsc",
      group: "Chronobiology",
      name: "MSFsc chronotype",
      value: msfsc,
      unit: "h local",
      formula: "MSF − 0.5×(SDf − SDweek) if SDf > SDweek else MSF",
      citation: "Roenneberg et al. MCTQ sleep-corrected midpoint of sleep on free days",
      confidence: msfsc != null ? "estimated" : "unavailable",
      digits: 2,
      note: "Weekend used as free days. Shift workers will be misclassified.",
    }),
    metric({
      id: "midsleep-sd",
      group: "Chronobiology",
      name: "Midsleep SD (14d)",
      value: midsleepSd,
      unit: "h",
      formula: "SD of nightly midsleep clock hour",
      citation: "Sleep timing variability; related to SRI but not identical",
      confidence: midsleepSd != null ? "derived" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "is-stab",
      group: "Chronobiology",
      name: "Interdaily stability",
      value: isStab,
      unit: "IS",
      formula: "n·Σ(mean_h − grand)² / (p·Σ(x − grand)²) on 30-min sleep/wake bins",
      citation: "Witting / Van Someren et al. 1990/1999 rest–activity IS",
      confidence: isStab != null ? "derived" : "unavailable",
      digits: 2,
      note: "Binary sleep/wake from onset/offset, not wrist actigraphy counts.",
    }),
    metric({
      id: "iv-var",
      group: "Chronobiology",
      name: "Intradaily variability",
      value: ivVar,
      unit: "IV",
      formula: "n·Σ(x_i − x_{i+1})² / ((n−1)·Σ(x − grand)²)",
      citation: "Van Someren et al. 1999, Chronobiol Int",
      confidence: ivVar != null ? "derived" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "circadian-align",
      group: "Chronobiology",
      name: "Midsleep vs 3:00 target",
      value: midpoint != null ? Math.abs(midpoint - 3) : null,
      unit: "h off",
      formula: "|midsleep − 3.0|",
      citation: "Population night-sleep midpoint often near 3:00; not a diagnosis",
      confidence: midpoint != null ? "estimated" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "bmi",
      group: "Body & energy",
      name: "BMI",
      value: bmi,
      unit: "kg/m²",
      formula: "kg / m²",
      citation: "Quetelet; WHO BMI classification",
      confidence: "derived",
      digits: 1,
      note: `WHO class: ${bmiClass(bmi)}`,
    }),
    metric({
      id: "ponderal",
      group: "Body & energy",
      name: "Ponderal index",
      value: ponderal,
      unit: "kg/m³",
      formula: "kg / m³",
      citation: "Rohrer index; less height-biased than BMI in some cohorts",
      confidence: "derived",
      digits: 1,
    }),
    metric({
      id: "ibw-devine",
      group: "Body & energy",
      name: "Ideal body weight (Devine)",
      value: ibw,
      unit: "kg",
      formula: "50 (m) or 45.5 (f) + 2.3 kg per inch over 5 ft",
      citation: "Devine BJ 1974, Drug Intell Clin Pharm",
      confidence: "estimated",
      digits: 1,
    }),
    metric({
      id: "bsa",
      group: "Body & energy",
      name: "Body surface area",
      value: bsa,
      unit: "m²",
      formula: "√((cm × kg) / 3600)",
      citation: "Mosteller 1987, N Engl J Med",
      confidence: "estimated",
      digits: 2,
    }),
    metric({
      id: "bmr",
      group: "Body & energy",
      name: "BMR Mifflin–St Jeor",
      value: bmr,
      unit: "kcal/d",
      formula: "10kg + 6.25cm − 5age + s, s=+5 male / −161 female / −78 unspecified",
      citation: "Mifflin et al. 1990, Am J Clin Nutr",
      confidence: "estimated",
      digits: 0,
    }),
    metric({
      id: "bmr-harris",
      group: "Body & energy",
      name: "BMR Harris–Benedict 1918",
      value: hbBmr,
      unit: "kcal/d",
      formula: "men 66.5+13.75kg+5.003cm−6.755age; women 655.1+9.563kg+1.85cm−4.676age",
      citation: "Harris & Benedict 1918",
      confidence: "estimated",
      digits: 0,
    }),
    metric({
      id: "bmr-roza",
      group: "Body & energy",
      name: "BMR Roza–Shizgal 1984",
      value: rozaBmr,
      unit: "kcal/d",
      formula: "Revised Harris–Benedict",
      citation: "Roza & Shizgal 1984, Am J Clin Nutr",
      confidence: "estimated",
      digits: 0,
    }),
    metric({
      id: "bmr-henry",
      group: "Body & energy",
      name: "BMR Henry/Oxford 2005",
      value: henryBmr,
      unit: "kcal/d",
      formula: "Age-banded FAO/WHO/UNU Henry equations (weight only)",
      citation: "Henry CJK 2005, Public Health Nutr",
      confidence: "estimated",
      digits: 0,
    }),
    metric({
      id: "activity-kcal",
      group: "Body & energy",
      name: "Cycle expenditure",
      value: activityKcal,
      unit: "kcal",
      formula: "kilojoule / 4.184",
      citation: "WHOOP cycle score.kilojoule",
      confidence: "measured",
      digits: 0,
    }),
    metric({
      id: "tdee",
      group: "Body & energy",
      name: "TDEE proxy",
      value: tdee,
      unit: "kcal",
      formula: "BMR + cycle kcal",
      citation: "BMR + measured expenditure; not a doubly labeled water TDEE",
      confidence: "estimated",
      digits: 0,
    }),
    metric({
      id: "pal",
      group: "Body & energy",
      name: "Physical activity level",
      value: pal,
      unit: "×BMR",
      formula: "TDEE / BMR",
      citation: "FAO/WHO/UNU PAL: sedentary ~1.4, very active ~2.0+",
      confidence: "estimated",
      digits: 2,
    }),
    metric({
      id: "meth",
      group: "Body & energy",
      name: "MET-hours",
      value: metH,
      unit: "MET·h",
      formula: "kcal / body_mass_kg  (since 1 MET ≈ 1 kcal/kg/h)",
      citation: "Ainsworth Compendium of Physical Activities",
      confidence: "estimated",
      digits: 1,
    }),
    metric({
      id: "spo2",
      group: "Illness proxies",
      name: "SpO2",
      value: last(spo2) ?? null,
      unit: "%",
      formula: "WHOOP overnight SpO2",
      citation: "WHOOP recovery.spo2_percentage — not a medical pulse-ox diagnosis",
      confidence: "measured",
      digits: 1,
    }),
    metric({
      id: "temp",
      group: "Illness proxies",
      name: "Skin temperature",
      value: last(temp) ?? null,
      unit: "°C",
      formula: "WHOOP skin_temp_celsius",
      citation: "Peripheral skin temp, not core (rectal/ingestible) temperature",
      confidence: "measured",
      digits: 1,
      note: expectedRhrShift ? "Luteal phase often +0.3–0.5 °C core; skin is a noisy proxy" : undefined,
    }),
    metric({
      id: "temp-z",
      group: "Illness proxies",
      name: "Skin temp z-score",
      value: last(temp) != null ? z(last(temp), temp) : null,
      unit: "σ",
      formula: "(temp − baseline) / SD",
      citation: "Relative deviation used in wearable illness research (e.g. Oura/WHOOP-style)",
      confidence: "derived",
      digits: 2,
    }),
    metric({
      id: "rr-z",
      group: "Illness proxies",
      name: "Respiratory rate z-score",
      value: last(resp) != null ? z(last(resp), resp) : null,
      unit: "σ",
      formula: "(RR − baseline) / SD",
      citation: "Overnight RR elevation is a common infectious-illness signal",
      confidence: last(resp) != null && resp.length >= 5 ? "derived" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "spo2-z",
      group: "Illness proxies",
      name: "SpO2 z-score",
      value: last(spo2) != null ? z(last(spo2), spo2) : null,
      unit: "σ",
      formula: "(SpO2 − baseline) / SD",
      citation: "Relative overnight SpO2 deviation — not a clinical pulse-ox reading",
      confidence: last(spo2) != null && spo2.length >= 5 ? "derived" : "unavailable",
      digits: 2,
    }),
    metric({
      id: "illness-idx",
      group: "Illness proxies",
      name: "Sickness composite",
      value: Math.max(0, Math.min(100, illness)),
      unit: "AU",
      formula: "50 + 12z_temp + 10z_RR − 12z_lnHRV − 8z_SpO2 + 20 if tagged sick",
      citation: "Composite of known febrile/autonomic signs — not a diagnosis",
      confidence: "estimated",
      digits: 0,
    }),
    metric({
      id: "whoop-rec",
      group: "Recovery & risk",
      name: "WHOOP recovery",
      value: today?.whoopRecovery ?? null,
      unit: "%",
      formula: "WHOOP closed model",
      citation: "WHOOP recovery_score (proprietary)",
      confidence: "measured",
      digits: 0,
    }),
    metric({
      id: "whoop-strain",
      group: "Recovery & risk",
      name: "WHOOP strain (cycle)",
      value: whoopStrainToday,
      unit: "AU",
      formula: "WHOOP cycle strain 0–21",
      citation: "WHOOP cycle score.strain (proprietary)",
      confidence: whoopStrainToday != null ? "measured" : "unavailable",
      digits: 1,
    }),
    metric({
      id: "whoop-strain7",
      group: "Recovery & risk",
      name: "WHOOP strain 7-day mean",
      value: strain7 || null,
      unit: "AU",
      formula: "mean(cycle strain, 7 days)",
      citation: "WHOOP strain rolling mean",
      confidence: strain7 ? "derived" : "unavailable",
      digits: 1,
    }),
    metric({
      id: "acwr-band",
      group: "Recovery & risk",
      name: "Gabbett ACWR band",
      value: acwrRoll,
      unit: acwrBand(acwrRoll),
      formula: "<0.8 underload, 0.8–1.3 sweet, 1.3–1.5 caution, >1.5 spike",
      citation: "Gabbett 2016 BJSM sweet-spot narrative (later debated)",
      confidence: "derived",
      digits: 2,
    }),
    metric({
      id: "session-min",
      group: "Recovery & risk",
      name: "Last session duration",
      value: sessionMin,
      unit: "min",
      formula: "workout.end − workout.start",
      citation: "WHOOP workout timestamps",
      confidence: sessionMin != null ? "measured" : "unavailable",
      digits: 0,
    }),
    metric({
      id: "form",
      group: "Recovery & risk",
      name: "Banister form (TSB)",
      value: formBanister,
      unit: "AU",
      formula: "CTL − ATL",
      citation: "Same as TSB",
      confidence: "derived",
      digits: 1,
    }),
    unavailable(
      "dfa",
      "Unavailable on WHOOP API",
      "DFA a1",
      "Detrended fluctuation analysis of RR during exercise",
      "Gronwald / Rogers / DFA a1 literature",
      "Needs raw beat-to-beat RR during work. WHOOP API does not export IBI/RR intervals.",
    ),
    unavailable(
      "ecg",
      "Unavailable on WHOOP API",
      "ECG / AFib strip",
      "Single-lead ECG",
      "WHOOP MG Heart Screener is in-app only",
      "MG hardware ECG is not in the public developer API.",
    ),
    unavailable(
      "bp",
      "Unavailable on WHOOP API",
      "Blood pressure",
      "Cuff or WHOOP MG estimate",
      "WHOOP Life BP insights (beta)",
      "No cuff, no API field. Do not treat any score here as BP.",
    ),
    unavailable(
      "glucose",
      "Unavailable on WHOOP API",
      "Glucose / CGM",
      "Interstitial glucose",
      "CGM (Dexcom, Libre) not WHOOP",
      "Band does not measure glucose.",
    ),
    unavailable(
      "lactate",
      "Unavailable on WHOOP API",
      "Blood lactate",
      "Capillary lactate (mmol/L)",
      "Lab / portable lactate meters",
      "Not a wearable optical signal we can invent.",
    ),
    unavailable(
      "gps",
      "Unavailable on WHOOP API",
      "GPS track / pace stream",
      "GNSS lat/lon series",
      "Phone GPS or a watch",
      "WHOOP 5.0 has no GNSS. API workouts may include distance, not a track.",
    ),
    unavailable(
      "power",
      "Unavailable on WHOOP API",
      "Cycling power / TSS",
      "NP, IF, TSS from a power meter",
      "Coggan TSS; requires watts",
      "No power channel. We use HR TRIMPs instead.",
    ),
    unavailable(
      "core-temp",
      "Unavailable on WHOOP API",
      "Core temperature",
      "Rectal, ingestible, or validated core estimate",
      "Sports medicine core-temp methods",
      "Skin temp is not core temp.",
    ),
    unavailable(
      "ibi",
      "Unavailable on WHOOP API",
      "Raw IBI / RR tachogram",
      "Inter-beat intervals",
      "Task Force HRV standards",
      "Required for SDNN, pNN50, LF/HF, Poincaré SD1/SD2 from scratch. WHOOP only gives RMSSD.",
    ),
    unavailable(
      "latency",
      "Unavailable on WHOOP API",
      "Sleep onset latency",
      "Lights-out to N1",
      "AASM SOL",
      "WHOOP does not expose latency separately from in-bed and stages.",
    ),
    unavailable(
      "vo2lab",
      "Unavailable on WHOOP API",
      "Laboratory VO2max",
      "Douglas bag / metabolic cart",
      "Gold-standard exercise physiology",
      "Uth and VDOT are estimates. They are not a treadmill test.",
    ),
    unavailable(
      "hrr60",
      "Unavailable on WHOOP API",
      "Heart-rate recovery 60s",
      "HRpeak − HR at 60 s of recovery",
      "Cole et al. 1999, N Engl J Med",
      "Needs a timed post-exercise HR sample. WHOOP workouts do not export a recovery HR curve.",
    ),
    unavailable(
      "sdnn",
      "Unavailable on WHOOP API",
      "SDNN / pNN50 / LF-HF",
      "Time- and frequency-domain HRV from the RR tachogram",
      "Task Force of ESC/NASPE 1996",
      "WHOOP exports overnight RMSSD only, not SDNN, pNN50, or spectral bands.",
    ),
    unavailable(
      "poincare",
      "Unavailable on WHOOP API",
      "Poincaré SD1 / SD2",
      "Ellipse of successive RR pairs",
      "Tulppo et al. 1996, Am J Physiol",
      "Needs the raw IBI series.",
    ),
    unavailable(
      "stress-whoop",
      "Unavailable on WHOOP API",
      "WHOOP Stress monitor",
      "WHOOP 4.0/5.0 daytime stress",
      "WHOOP Stress (membership feature)",
      "Not in the public developer API.",
    ),
    unavailable(
      "healthspan",
      "Unavailable on WHOOP API",
      "WHOOP Healthspan / PAC",
      "WHOOP physiological age",
      "WHOOP 5.0 Healthspan",
      "Proprietary, not exported.",
    ),
    unavailable(
      "cadence",
      "Unavailable on WHOOP API",
      "Running cadence / GCT / VO",
      "Steps/min, ground contact, vertical oscillation",
      "Running dynamics (Garmin/Stryd class)",
      "WHOOP 5.0 has no footpod or IMU running-dynamics export.",
    ),
    unavailable(
      "ea-reds",
      "Unavailable on WHOOP API",
      "Energy availability / REDs",
      "(EI − EEE) / FFM",
      "Loucks; IOC REDs 2023",
      "Needs energy intake and fat-free mass. Band expenditure alone is not EA.",
    ),
    unavailable(
      "bfp",
      "Unavailable on WHOOP API",
      "Body fat / DEXA",
      "DXA, ADP, or validated BIA",
      "Clinical body composition",
      "Height and weight cannot yield an accurate body-fat percentage.",
    ),
    unavailable(
      "smo2",
      "Unavailable on WHOOP API",
      "Muscle oxygen (SmO2)",
      "NIRS muscle oxygenation",
      "Moxy / Humon class sensors",
      "Wrist PPG is not muscle NIRS.",
    ),
    unavailable(
      "critical-power",
      "Unavailable on WHOOP API",
      "Critical power / W′",
      "Two-parameter CP from power-duration",
      "Monod & Scherrer; Jones / Vanhatalo",
      "Needs a power meter and multiple maximal efforts.",
    ),
    unavailable(
      "psg",
      "Unavailable on WHOOP API",
      "Polysomnography staging",
      "EEG + EOG + EMG AASM stages",
      "AASM scoring manual",
      "WHOOP stages are a wearable estimate, not PSG.",
    ),
  ];

  const groups = [...new Set(metrics.map((m) => m.group))];
  return {
    generatedAt: now.toISOString(),
    metrics,
    groups,
  };
}

export { fmt };
