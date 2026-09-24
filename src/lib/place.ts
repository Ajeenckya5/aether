import { LOCAL_SYNC_EVENT } from "./sessions";

export type PlaceSource = "gps" | "search" | "ip";

export type Place = {
  lat: number;
  lon: number;
  name: string;
  timezone: string | null;
  source: PlaceSource;
};

const KEY = "aether-place-v1";

export const GEO_PERMISSION_DENIED = 1;
export const GEO_POSITION_UNAVAILABLE = 2;
export const GEO_TIMEOUT = 3;

export function cityLabel(name: string): string {
  const city = name.split(",")[0]?.trim();
  return city || name;
}

const COORD_PART = /^-?\d{1,3}\.\d{2}$/;

/** City and region, or a rounded pin when the name is missing. */
export function placeDisplayName(place: { name: string; lat: number; lon: number }): string {
  const parts = place.name.split(",").map((part) => part.trim()).filter(Boolean);
  const city = parts[0] ?? "";
  const region = parts[1] ?? "";
  if (city && !city.startsWith("Near ") && !COORD_PART.test(city)) {
    if (region && !COORD_PART.test(region)) return `${city}, ${region}`;
    return city;
  }
  return `Near ${place.lat.toFixed(2)}, ${place.lon.toFixed(2)}`;
}

export function placeSourceLabel(source: PlaceSource): string {
  if (source === "gps") return "GPS · rounded ~1 km";
  if (source === "search") return "City search";
  return "Saved pin";
}

export function explainGeoError(
  code: number | undefined,
  savedName?: string | null,
): string {
  const keep = savedName
    ? ` ${savedName} is still used for weather.`
    : " Search a city instead — Aether never looks up your IP.";
  if (code === GEO_PERMISSION_DENIED) {
    return `This browser blocked GPS.${keep}`;
  }
  if (code === GEO_POSITION_UNAVAILABLE) {
    return `No GPS fix (indoor, or no radio).${keep}`;
  }
  if (code === GEO_TIMEOUT) {
    return `GPS timed out.${keep}`;
  }
  return `GPS is not available here.${keep}`;
}

export function loadPlace(): Place | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Place;
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lon)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePlace(place: Place | null) {
  if (place == null) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, JSON.stringify(place));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LOCAL_SYNC_EVENT));
  }
}

export function validCoords(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}
