export function whoopCompareLabel(connected: boolean): string {
  return connected ? "WHOOP" : "Sample";
}

export function sampleDataNote(connected: boolean): string | null {
  if (connected) return null;
  return "Overnight recovery, sleep, and workouts below are a sample. Pair your WHOOP over Bluetooth for live bpm. Full overnight history needs WHOOP’s official API on a copy you run yourself.";
}
