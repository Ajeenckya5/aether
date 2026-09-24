import type {
  BodyMeasurement,
  Cycle,
  Dashboard,
  Profile,
  Recovery,
  Sleep,
  Workout,
  ZoneDurations,
} from "./types";

/** Fixed so the static export and every browser render the same sample days. */
const SAMPLE_EPOCH = Date.UTC(2026, 8, 23, 12, 0, 0);

function atDay(daysAgo: number, hour: number, minute = 0, second = 0): string {
  const d = new Date(SAMPLE_EPOCH);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, minute, second, 0);
  return d.toISOString();
}

function addMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function zones(totalMs: number, profile: number[]): ZoneDurations {
  const sum = profile.reduce((a, b) => a + b, 0) || 1;
  const parts = profile.map((p) => Math.round((p / sum) * totalMs));
  return {
    zone_zero_milli: parts[0] ?? 0,
    zone_one_milli: parts[1] ?? 0,
    zone_two_milli: parts[2] ?? 0,
    zone_three_milli: parts[3] ?? 0,
    zone_four_milli: parts[4] ?? 0,
    zone_five_milli: parts[5] ?? 0,
  };
}

const WORKOUT_TEMPLATES: {
  sport_name: string;
  sport_id: number;
  hour: number;
  durationMin: number;
  strain: [number, number];
  hr: [number, number];
  maxHr: [number, number];
  kj: [number, number];
  distance?: [number, number];
  zone: number[];
}[] = [
  {
    sport_name: "running",
    sport_id: 1,
    hour: 6,
    durationMin: 42,
    strain: [8.2, 12.4],
    hr: [142, 156],
    maxHr: [168, 181],
    kj: [1800, 2600],
    distance: [6200, 9800],
    zone: [2, 8, 35, 32, 18, 5],
  },
  {
    sport_name: "weightlifting",
    sport_id: 18,
    hour: 17,
    durationMin: 54,
    strain: [6.1, 10.8],
    hr: [118, 132],
    maxHr: [154, 168],
    kj: [1400, 2100],
    zone: [10, 22, 38, 22, 6, 2],
  },
  {
    sport_name: "yoga",
    sport_id: 48,
    hour: 7,
    durationMin: 38,
    strain: [3.2, 5.4],
    hr: [88, 102],
    maxHr: [118, 132],
    kj: [480, 820],
    zone: [40, 38, 18, 4, 0, 0],
  },
  {
    sport_name: "cycling",
    sport_id: 16,
    hour: 12,
    durationMin: 68,
    strain: [9.4, 14.1],
    hr: [138, 151],
    maxHr: [172, 184],
    kj: [2200, 3400],
    distance: [18000, 28000],
    zone: [4, 10, 28, 34, 18, 6],
  },
  {
    sport_name: "hiit",
    sport_id: 52,
    hour: 18,
    durationMin: 28,
    strain: [10.2, 14.8],
    hr: [148, 162],
    maxHr: [176, 188],
    kj: [1100, 1700],
    zone: [2, 6, 18, 28, 30, 16],
  },
  {
    sport_name: "walking",
    sport_id: 23,
    hour: 12,
    durationMin: 34,
    strain: [2.4, 4.8],
    hr: [92, 108],
    maxHr: [118, 128],
    kj: [420, 780],
    distance: [2400, 3800],
    zone: [55, 32, 13, 0, 0, 0],
  },
  {
    sport_name: "swimming",
    sport_id: 43,
    hour: 6,
    durationMin: 36,
    strain: [7.4, 11.2],
    hr: [128, 144],
    maxHr: [158, 172],
    kj: [1300, 1900],
    distance: [1200, 2200],
    zone: [6, 14, 32, 30, 14, 4],
  },
  {
    sport_name: "hiking",
    sport_id: 59,
    hour: 9,
    durationMin: 96,
    strain: [8.8, 13.6],
    hr: [122, 138],
    maxHr: [158, 171],
    kj: [2400, 3800],
    distance: [7000, 12000],
    zone: [8, 18, 40, 24, 8, 2],
  },
];

export function buildDemoDashboard(): Dashboard {
  const profile: Profile = {
    user_id: 10129,
    email: "you@aether.local",
    first_name: "Alex",
    last_name: "Reyes",
  };
  const body: BodyMeasurement = {
    height_meter: 1.78,
    weight_kilogram: 76.4,
    max_heart_rate: 188,
  };

  const recoveries: Recovery[] = [];
  const cycles: Cycle[] = [];
  const sleeps: Sleep[] = [];
  const workouts: Workout[] = [];

  for (let day = 0; day < 42; day += 1) {
    const seed = 40 + day * 7;
    const hardBlock = day >= 6 && day <= 14;
    const deload = day >= 15 && day <= 20;
    const recoveryScore = Math.round(
      lerp(
        hardBlock ? 28 : deload ? 62 : 38,
        hardBlock ? 62 : deload ? 96 : 94,
        0.35 + 0.55 * hash(seed) + 0.1 * Math.sin(day),
      ),
    );
    const hrv = Math.round(lerp(28, 78, recoveryScore / 100) * 10) / 10;
    const rhr = Math.round(lerp(68, 48, recoveryScore / 100));
    const cycleId = 94000 - day;
    const sleepStart = atDay(day + 1, 22, 18 + Math.round(hash(seed + 1) * 40));
    const inBed = Math.round(lerp(6.4, 8.6, hash(seed + 2)) * 3600000);
    const sleepEnd = addMs(sleepStart, inBed);
    const light = Math.round(inBed * 0.48);
    const sws = Math.round(inBed * 0.22);
    const rem = Math.round(inBed * 0.19);
    const awake = inBed - light - sws - rem;
    const performance = Math.round(lerp(62, 98, hash(seed + 3)));
    const strain = Math.round(
      lerp(
        hardBlock ? 11.5 : deload ? 3.2 : 4.2,
        hardBlock ? 18.4 : deload ? 8.8 : 16.8,
        hash(seed + 4),
      ) * 10,
    ) / 10;
    const cycleStart = sleepEnd;
    const cycleEnd = day === 0 ? null : atDay(day - 1, 7, 12);

    const sleepId = `demo-sleep-${day}`;
    sleeps.push({
      id: sleepId,
      cycle_id: cycleId,
      v1_id: 2000 + day,
      user_id: profile.user_id,
      created_at: sleepEnd,
      updated_at: sleepEnd,
      start: sleepStart,
      end: sleepEnd,
      timezone_offset: "-05:00",
      nap: false,
      score_state: "SCORED",
      score: {
        stage_summary: {
          total_in_bed_time_milli: inBed,
          total_awake_time_milli: awake,
          total_no_data_time_milli: 0,
          total_light_sleep_time_milli: light,
          total_slow_wave_sleep_time_milli: sws,
          total_rem_sleep_time_milli: rem,
          sleep_cycle_count: 3 + (day % 3),
          disturbance_count: 4 + (day % 8),
        },
        sleep_needed: {
          baseline_milli: 7.5 * 3600000,
          need_from_sleep_debt_milli: Math.round((1 - performance / 100) * 40 * 60000),
          need_from_recent_strain_milli: Math.round(strain * 2.4 * 60000),
          need_from_recent_nap_milli: 0,
        },
        respiratory_rate: Math.round(lerp(13.8, 16.9, hash(seed + 5)) * 100) / 100,
        sleep_performance_percentage: performance,
        sleep_consistency_percentage: Math.round(lerp(68, 96, hash(seed + 6))),
        sleep_efficiency_percentage: Math.round(lerp(84, 96, hash(seed + 7)) * 10) / 10,
      },
    });

    recoveries.push({
      cycle_id: cycleId,
      sleep_id: sleepId,
      user_id: profile.user_id,
      created_at: sleepEnd,
      updated_at: sleepEnd,
      score_state: "SCORED",
      score: {
        user_calibrating: false,
        recovery_score: recoveryScore,
        resting_heart_rate: rhr,
        hrv_rmssd_milli: hrv,
        spo2_percentage: Math.round(lerp(94.8, 98.2, hash(seed + 8)) * 10) / 10,
        skin_temp_celsius: Math.round(lerp(32.6, 34.4, hash(seed + 9)) * 10) / 10,
      },
    });

    cycles.push({
      id: cycleId,
      user_id: profile.user_id,
      created_at: cycleStart,
      updated_at: cycleStart,
      start: cycleStart,
      end: cycleEnd,
      timezone_offset: "-05:00",
      score_state: day === 0 ? "PENDING_SCORE" : "SCORED",
      score: {
        strain,
        kilojoule: Math.round(lerp(6200, 12400, strain / 18)),
        average_heart_rate: Math.round(lerp(62, 84, strain / 18)),
        max_heart_rate: Math.round(lerp(142, 184, strain / 18)),
      },
    });

    const sessionsToday = hardBlock
      ? hash(seed + 10) > 0.12 ? (hash(seed + 11) > 0.55 ? 2 : 1) : 1
      : deload
        ? hash(seed + 10) > 0.55 ? 1 : 0
        : hash(seed + 10) > 0.28 ? (hash(seed + 11) > 0.72 ? 2 : 1) : 0;
    for (let s = 0; s < sessionsToday; s += 1) {
      const tmpl =
        WORKOUT_TEMPLATES[(day * 3 + s) % WORKOUT_TEMPLATES.length];
      const t = hash(seed + 20 + s);
      const durationMin = Math.round(
        lerp(tmpl.durationMin * 0.85, tmpl.durationMin * 1.15, t),
      );
      const start = atDay(
        day,
        tmpl.hour,
        Math.round(lerp(0, 40, hash(seed + 21 + s))),
      );
      const durationMs = durationMin * 60000;
      const end = addMs(start, durationMs);
      const wStrain = Math.round(lerp(tmpl.strain[0], tmpl.strain[1], t) * 10) / 10;
      const avg = Math.round(lerp(tmpl.hr[0], tmpl.hr[1], t));
      const max = Math.round(lerp(tmpl.maxHr[0], tmpl.maxHr[1], t));
      const kj = lerp(tmpl.kj[0], tmpl.kj[1], t);
      workouts.push({
        id: `demo-workout-${day}-${s}`,
        v1_id: 3000 + day * 10 + s,
        user_id: profile.user_id,
        created_at: end,
        updated_at: end,
        start,
        end,
        timezone_offset: "-05:00",
        sport_name: tmpl.sport_name,
        score_state: "SCORED",
        sport_id: tmpl.sport_id,
        score: {
          strain: wStrain,
          average_heart_rate: avg,
          max_heart_rate: max,
          kilojoule: kj,
          percent_recorded: 100,
          distance_meter: tmpl.distance
            ? Math.round(lerp(tmpl.distance[0], tmpl.distance[1], t))
            : null,
          altitude_gain_meter: tmpl.sport_name === "hiking" ? 220 : tmpl.sport_name === "running" ? 38 : null,
          altitude_change_meter: tmpl.sport_name === "hiking" ? 12 : 0,
          zone_durations: zones(durationMs, tmpl.zone),
        },
      });
    }
  }

  workouts.sort((a, b) => +new Date(b.start) - +new Date(a.start));

  return {
    source: "demo",
    connected: false,
    configured: false,
    profile,
    body,
    recoveries,
    cycles,
    sleeps,
    workouts,
  };
}
