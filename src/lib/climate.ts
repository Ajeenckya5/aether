export { bestTrainingWindow, heatIndexC, bomWbgtC } from "@ajeenckya/engine";

/** Canadian humidex. Environment Canada. */
export function humidexC(tempC: number, rh: number): number {
  const e =
    (6.112 * 10 ** ((7.5 * tempC) / (237.7 + tempC)) * Math.max(0, rh)) / 100;
  return tempC + 0.5555 * (e - 10);
}

/** Stull 2011 wet-bulb, Journal of Applied Meteorology and Climatology. */
export function stullWetBulbC(tempC: number, rh: number): number {
  const t = tempC;
  const h = Math.max(0, Math.min(100, rh));
  return (
    t * Math.atan(0.151977 * (h + 8.313659) ** 0.5) +
    Math.atan(t + h) -
    Math.atan(h - 1.676331) +
    0.00391838 * h ** 1.5 * Math.atan(0.023101 * h) -
    4.686035
  );
}

export type AqiBand = "good" | "moderate" | "sensitive" | "unhealthy" | "very" | "hazard";

export function usAqiBand(aqi: number): { band: AqiBand; label: string } {
  if (aqi <= 50) return { band: "good", label: "Good" };
  if (aqi <= 100) return { band: "moderate", label: "Moderate" };
  if (aqi <= 150) return { band: "sensitive", label: "Unhealthy for sensitive" };
  if (aqi <= 200) return { band: "unhealthy", label: "Unhealthy" };
  if (aqi <= 300) return { band: "very", label: "Very unhealthy" };
  return { band: "hazard", label: "Hazardous" };
}

export function uvBand(uv: number): { label: string; who: string } {
  if (uv < 3) return { label: "Low", who: "WHO UV 0–2" };
  if (uv < 6) return { label: "Moderate", who: "WHO UV 3–5" };
  if (uv < 8) return { label: "High", who: "WHO UV 6–7" };
  if (uv < 11) return { label: "Very high", who: "WHO UV 8–10" };
  return { label: "Extreme", who: "WHO UV 11+" };
}

export type OutdoorLevel = "go" | "caution" | "indoor";

/** Higher means more heat or air risk. Used only to notice when the level steps up. */
export function outdoorRank(level: OutdoorLevel): number {
  if (level === "indoor") return 2;
  if (level === "caution") return 1;
  return 0;
}

export function outdoorCall(input: {
  wbgt: number | null;
  usAqi: number | null;
  heatIndex: number | null;
}): { level: OutdoorLevel; title: string; notes: string[] } {
  const notes: string[] = [];
  const aqi = input.usAqi;
  const wbgt = input.wbgt;
  const hi = input.heatIndex;

  if (aqi != null && aqi >= 151) {
    notes.push(
      `US AQI ${Math.round(aqi)} — EPA outdoor-activity guidance is to move vigorous work indoors.`,
    );
    return { level: "indoor", title: "Train indoors", notes };
  }
  if (wbgt != null && wbgt >= 31) {
    notes.push(
      `WBGT ${wbgt.toFixed(1)} °C — ACSM/NATA heat categories treat this as cancel / indoor only.`,
    );
    return { level: "indoor", title: "Heat stop", notes };
  }
  if (aqi != null && aqi >= 101) {
    notes.push(
      `US AQI ${Math.round(aqi)} — sensitive groups should shorten or slow outdoor work (EPA).`,
    );
  }
  if (wbgt != null && wbgt >= 28) {
    notes.push(
      `WBGT ${wbgt.toFixed(1)} °C — work:rest and hydration matter; skip a breakthrough outdoor session.`,
    );
  }
  if (hi != null && hi >= 39) {
    notes.push(`Heat index ${hi.toFixed(0)} °C (NWS) — perceived heat is in the danger band.`);
  }
  if (notes.length) {
    return { level: "caution", title: "Outdoor caution", notes };
  }
  notes.push("Air and heat are in a normal training window for this hour.");
  return { level: "go", title: "Outdoor ok", notes };
}

export function wmoText(code: number | null): string {
  if (code == null) return "Unknown";
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return `WMO ${code}`;
}

export function clockHourFromIso(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

/** ~6% VO2max drop per 1000 m above 1500 m — rough altitude rule of thumb. */
export function altitudeVo2PenaltyPct(elevationM: number): number {
  if (elevationM < 1500) return 0;
  return 6 * ((elevationM - 1500) / 1000);
}
