export type PlaceSource = "gps" | "search" | "ip";

export type Place = {
  lat: number;
  lon: number;
  name: string;
  timezone: string | null;
  source: PlaceSource;
};

const KEY = "aether-place-v1";

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
