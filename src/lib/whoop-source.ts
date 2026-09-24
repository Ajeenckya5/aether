export function whoopCompareLabel(connected: boolean): string {
  return connected ? "Strap" : "Sample";
}

export function sampleDataNote(connected: boolean): string | null {
  if (connected) return null;
  return "Workouts below are a sample. Pair a heart-rate strap for live bpm, HRV, and resting heart rate. Leave Aether connected overnight to score sleep from that public heart-rate stream.";
}
