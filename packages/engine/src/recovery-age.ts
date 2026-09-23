/** Klemera–Doubal needs a real history. Sample nights never publish a confidence label. */
export const RECOVERY_AGE_NIGHTS = 14;
export const RECOVERY_AGE_MARKERS = 6;

export type RecoveryAgeGate = {
  publish: boolean;
  nightsCollected: number;
  nightsRequired: number;
  markersRequired: number;
  markersCollected: number;
};

/**
 * Gate a recovery-age estimate.
 * Inputs: whether the history is sample data, count of real nights, count of real markers.
 * Publish only at 14 real nights and 6 real markers. Sample data never publishes.
 */
export function gateRecoveryAge(input: {
  sample: boolean;
  realNights: number;
  markerCount: number;
}): RecoveryAgeGate {
  const nightsCollected = input.sample
    ? 0
    : Math.max(0, Math.floor(input.realNights));
  const markersCollected = Math.max(0, Math.floor(input.markerCount));
  const publish =
    !input.sample &&
    nightsCollected >= RECOVERY_AGE_NIGHTS &&
    markersCollected >= RECOVERY_AGE_MARKERS;
  return {
    publish,
    nightsCollected,
    nightsRequired: RECOVERY_AGE_NIGHTS,
    markersRequired: RECOVERY_AGE_MARKERS,
    markersCollected,
  };
}
