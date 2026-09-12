export type DataSource = "whoop" | "demo";

export type Profile = {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
};

export type BodyMeasurement = {
  height_meter: number;
  weight_kilogram: number;
  max_heart_rate: number;
};

export type RecoveryScore = {
  user_calibrating: boolean;
  recovery_score: number;
  resting_heart_rate: number;
  hrv_rmssd_milli: number;
  spo2_percentage: number | null;
  skin_temp_celsius: number | null;
};

export type Recovery = {
  cycle_id: number;
  sleep_id: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: string;
  score: RecoveryScore | null;
};

export type CycleScore = {
  strain: number;
  kilojoule: number;
  average_heart_rate: number;
  max_heart_rate: number;
};

export type Cycle = {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string | null;
  timezone_offset: string;
  score_state: string;
  score: CycleScore | null;
};

export type SleepStageSummary = {
  total_in_bed_time_milli: number;
  total_awake_time_milli: number;
  total_no_data_time_milli: number;
  total_light_sleep_time_milli: number;
  total_slow_wave_sleep_time_milli: number;
  total_rem_sleep_time_milli: number;
  sleep_cycle_count: number;
  disturbance_count: number;
};

export type SleepNeeded = {
  baseline_milli: number;
  need_from_sleep_debt_milli: number;
  need_from_recent_strain_milli: number;
  need_from_recent_nap_milli: number;
};

export type SleepScore = {
  stage_summary: SleepStageSummary;
  sleep_needed: SleepNeeded;
  respiratory_rate: number;
  sleep_performance_percentage: number;
  sleep_consistency_percentage: number;
  sleep_efficiency_percentage: number;
};

export type Sleep = {
  id: string;
  cycle_id: number;
  v1_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: string;
  score: SleepScore | null;
};

export type ZoneDurations = {
  zone_zero_milli: number;
  zone_one_milli: number;
  zone_two_milli: number;
  zone_three_milli: number;
  zone_four_milli: number;
  zone_five_milli: number;
};

export type WorkoutScore = {
  strain: number;
  average_heart_rate: number;
  max_heart_rate: number;
  kilojoule: number;
  percent_recorded: number;
  distance_meter: number | null;
  altitude_gain_meter: number | null;
  altitude_change_meter: number | null;
  zone_durations: ZoneDurations;
};

export type Workout = {
  id: string;
  v1_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  sport_name: string;
  score_state: string;
  score: WorkoutScore | null;
  sport_id: number;
};

export type Dashboard = {
  source: DataSource;
  connected: boolean;
  configured: boolean;
  profile: Profile;
  body: BodyMeasurement;
  recoveries: Recovery[];
  cycles: Cycle[];
  sleeps: Sleep[];
  workouts: Workout[];
};

export type Collection<T> = {
  records: T[];
  next_token?: string | null;
};

export const EMPTY_DASHBOARD: Dashboard = {
  source: "demo",
  connected: false,
  configured: false,
  profile: {
    user_id: 0,
    email: "",
    first_name: "",
    last_name: "",
  },
  body: {
    height_meter: 0,
    weight_kilogram: 0,
    max_heart_rate: 0,
  },
  recoveries: [],
  cycles: [],
  sleeps: [],
  workouts: [],
};

