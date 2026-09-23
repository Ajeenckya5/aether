import { LOCAL_SYNC_EVENT } from "./sessions";

/** ~1.1 km — enough for weather, not a street address. */
export const PUBLIC_COORD_DECIMALS = 2;

export function roundCoord(value: number, decimals = PUBLIC_COORD_DECIMALS): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function roundCoords(
  lat: number,
  lon: number,
  decimals = PUBLIC_COORD_DECIMALS,
): { lat: number; lon: number } {
  return { lat: roundCoord(lat, decimals), lon: roundCoord(lon, decimals) };
}

export function privateStorageKeysFrom(allKeys: string[]): string[] {
  return allKeys.filter((key) => key.startsWith("aether-"));
}

export function exportPrivateData(): string {
  if (typeof window === "undefined") return "";
  const data: Record<string, string> = {};
  for (const key of privateStorageKeysFrom(Object.keys(localStorage))) {
    const value = localStorage.getItem(key);
    if (value != null) data[key] = value;
  }
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data });
}

export function importPrivateData(raw: string): void {
  if (typeof window === "undefined") return;
  const parsed = JSON.parse(raw) as { version?: number; data?: Record<string, unknown> };
  if (parsed.version !== 1 || !parsed.data || typeof parsed.data !== "object") {
    throw new Error("That file is not an Aether export.");
  }
  for (const [key, value] of Object.entries(parsed.data)) {
    if (!key.startsWith("aether-") || typeof value !== "string") continue;
    localStorage.setItem(key, value);
  }
  window.dispatchEvent(new Event(LOCAL_SYNC_EVENT));
}

export function eraseLocalPrivateData() {
  if (typeof window === "undefined") return;
  const keys = privateStorageKeysFrom(Object.keys(localStorage));
  for (const key of keys) localStorage.removeItem(key);
  window.dispatchEvent(new Event(LOCAL_SYNC_EVENT));
}

export function isSameOriginRequest(request: Request): boolean {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) return origin === url.origin;
  const referer = request.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === url.origin;
  } catch {
    return false;
  }
}

export const NO_STORE = "private, no-store, max-age=0, must-revalidate";
