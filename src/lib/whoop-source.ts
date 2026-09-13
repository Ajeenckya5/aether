export function whoopCompareLabel(connected: boolean): string {
  return connected ? "WHOOP" : "Sample";
}

export function sampleDataNote(connected: boolean): string | null {
  if (connected) return null;
  return "Workouts below are a sample. Pair your WHOOP over Bluetooth for live bpm, HRV, and resting HR. Leave Aether connected overnight to score Aether sleep from that public heart-rate stream. WHOOP’s own recovery score, official REM/deep, SpO2, and skin temp need their private radio or official API.";
}
