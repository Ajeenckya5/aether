/**
 * Time-of-day greeting.
 * Input: local hour 0–23 in the user's time zone.
 * Output: a short greeting. Hours outside 0–23 are clamped.
 */
export function timeOfDayGreeting(hour: number): string {
  const h = Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.floor(hour))) : 12;
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
