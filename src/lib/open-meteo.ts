import { buildEnvironmentSnapshot, type EnvironmentSnapshot } from "./environment";
import { validCoords } from "./place";
import { roundCoords } from "./privacy";

export type PlaceHit = {
  name: string;
  lat: number;
  lon: number;
  timezone: string | null;
};

type GeoHit = {
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
  admin1?: string;
};

function label(hit: GeoHit): string {
  return [hit.name, hit.admin1, hit.country].filter(Boolean).join(", ");
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Open-Meteo failed ${res.status}`);
  return res.json();
}

export async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`;
  const data = (await getJson(url)) as { results?: GeoHit[] };
  return (data.results ?? []).map((hit) => {
    const coarse = roundCoords(hit.latitude, hit.longitude);
    return {
      name: label(hit),
      lat: coarse.lat,
      lon: coarse.lon,
      timezone: hit.timezone ?? null,
    };
  });
}

export async function reversePlace(lat: number, lon: number): Promise<PlaceHit> {
  const coarse = roundCoords(lat, lon);
  if (!validCoords(coarse.lat, coarse.lon)) {
    throw new Error("Invalid coordinates");
  }
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${coarse.lat}&longitude=${coarse.lon}&language=en&format=json`;
    const data = (await getJson(url)) as { results?: GeoHit[] };
    const hit = data.results?.[0];
    if (hit) {
      const named = roundCoords(hit.latitude, hit.longitude);
      return {
        name: label(hit),
        lat: named.lat,
        lon: named.lon,
        timezone: hit.timezone ?? null,
      };
    }
  } catch {
    /* fall through to coarse pin */
  }
  return {
    name: `${coarse.lat.toFixed(2)}, ${coarse.lon.toFixed(2)}`,
    lat: coarse.lat,
    lon: coarse.lon,
    timezone: null,
  };
}

export async function fetchEnvironment(
  lat: number,
  lon: number,
): Promise<EnvironmentSnapshot> {
  const coarse = roundCoords(lat, lon);
  if (!validCoords(coarse.lat, coarse.lon)) {
    throw new Error("Valid lat and lon are required.");
  }

  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${coarse.lat}&longitude=${coarse.lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,cloud_cover,surface_pressure,is_day` +
    `&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,uv_index` +
    `&daily=sunrise,sunset,uv_index_max,temperature_2m_max,temperature_2m_min` +
    `&past_days=1&forecast_days=3&timezone=auto`;

  const airUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${coarse.lat}&longitude=${coarse.lon}` +
    `&current=us_aqi,european_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide,uv_index,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen` +
    `&timezone=auto`;

  const elevUrl = `https://api.open-meteo.com/v1/elevation?latitude=${coarse.lat}&longitude=${coarse.lon}`;

  const [forecast, air, elevation] = (await Promise.all([
    getJson(forecastUrl),
    getJson(airUrl),
    getJson(elevUrl),
  ])) as [
    Parameters<typeof buildEnvironmentSnapshot>[0]["forecast"],
    Parameters<typeof buildEnvironmentSnapshot>[0]["air"],
    { elevation?: number[] },
  ];

  const elevationM =
    Array.isArray(elevation?.elevation) && typeof elevation.elevation[0] === "number"
      ? elevation.elevation[0]
      : null;

  return buildEnvironmentSnapshot({
    lat: coarse.lat,
    lon: coarse.lon,
    elevationM,
    forecast,
    air,
  });
}
