import weights from "./model-weights.json";

export const MODEL_FEATURES = weights.features as string[];

export type FeatureName = (typeof MODEL_FEATURES)[number];

export type FeatureVector = Record<string, number>;

export type Attribution = {
  feature: string;
  label: string;
  value: number;
  contribution: number;
};

const LABELS: Record<string, string> = {
  hrv_ln_z: "HRV vs your 14-day baseline",
  rhr_z: "Resting HR vs baseline",
  sleep_performance: "Sleep performance",
  sleep_efficiency: "Sleep efficiency",
  sleep_debt_h: "Sleep debt",
  deep_frac: "Deep sleep share",
  rem_frac: "REM share",
  yday_load: "Yesterday's load",
  atl_norm: "Acute load (7d)",
  tsb_norm: "Freshness (TSB)",
  acwr: "Acute:chronic ratio",
  temp_z: "Skin temperature",
  resp_z: "Respiratory rate",
  spo2_z: "SpO2",
  alcohol: "Alcohol",
  illness: "Illness",
  travel: "Travel / jet lag",
  consecutive_low_hrv: "Streak of low HRV",
  sleep_regularity: "Sleep timing regularity",
  soreness: "Soreness",
};

export function featureLabel(name: string): string {
  return LABELS[name] ?? name;
}

function sigmoid(z: number): number {
  const x = Math.max(-20, Math.min(20, z));
  return 1 / (1 + Math.exp(-x));
}

export function scoreReadiness(raw: FeatureVector): {
  readiness: number;
  risk: number;
  attributions: Attribution[];
} {
  const z = MODEL_FEATURES.map((name, i) => {
    const value = raw[name] ?? 0;
    const mean = weights.mean[i] ?? 0;
    const std = weights.std[i] || 1;
    return (value - mean) / std;
  });

  let readiness = weights.readiness.bias;
  let riskLogit = weights.risk.bias;
  const attributions: Attribution[] = MODEL_FEATURES.map((feature, i) => {
    const contribution = (weights.readiness.weights[i] ?? 0) * z[i];
    readiness += contribution;
    riskLogit += (weights.risk.weights[i] ?? 0) * z[i];
    return {
      feature,
      label: featureLabel(feature),
      value: raw[feature] ?? 0,
      contribution,
    };
  });

  attributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return {
    readiness: Math.max(5, Math.min(98, readiness)),
    risk: sigmoid(riskLogit),
    attributions,
  };
}

export const MODEL_CARD = {
  version: weights.version,
  name: weights.name,
  samples: weights.samples,
  rmse: weights.rmse,
  mae: weights.mae,
  r2: weights.r2,
  riskAccuracy: weights.risk_accuracy,
  notes: weights.notes,
};
