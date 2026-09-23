export type TrainingCall = "push" | "build" | "recover";

export type CallInput = {
  /** Readiness score, typically 0–100. */
  readiness: number;
  /** Acute:chronic workload ratio (Gabbett). Unitless. */
  acwr: number;
  /** HRV z-score versus the recent baseline. */
  hrvZ: number;
  /** Training stress balance: chronic minus acute load. */
  tsb: number;
  /** Injury-risk probability 0–1. */
  risk: number;
  overreaching: boolean;
  /** Sick flag. Always caps the call at Recover. */
  illness: boolean;
};

/**
 * Today's call from readiness, load, and context.
 * Illness always returns Recover, never Push or Build.
 */
export function decideCall(input: CallInput): { call: TrainingCall; why: string[] } {
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

/**
 * Edwards-style strain from minutes in zones 0–5.
 * Weights: 0.5, 1, 2, 3, 4, 5. Negative or non-finite minutes are ignored.
 */
export function strainFromZoneMinutes(zoneMinutes: readonly number[]): number {
  const weights = [0.5, 1, 2, 3, 4, 5];
  let sum = 0;
  for (let i = 0; i < weights.length; i += 1) {
    const minutes = zoneMinutes[i] ?? 0;
    if (!Number.isFinite(minutes) || minutes < 0) continue;
    sum += minutes * weights[i];
  }
  return sum;
}
