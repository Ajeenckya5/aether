export function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return "In progress";
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return formatMillis(ms);
}

export function formatMillis(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatHours(ms: number): string {
  const hours = ms / 3600000;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function kcalFromKj(kj: number): number {
  return Math.round(kj / 4.184);
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...opts,
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function isSameDay(iso: string, date = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function recoveryTone(score: number): "low" | "ok" | "high" {
  if (score >= 67) return "high";
  if (score >= 34) return "ok";
  return "low";
}

export function strainLabel(strain: number): string {
  if (strain >= 18) return "All-out";
  if (strain >= 14) return "High";
  if (strain >= 10) return "Moderate";
  if (strain >= 6) return "Light";
  return "Rest";
}
