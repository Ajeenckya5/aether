import { buildEnvironmentSnapshot } from "@/lib/environment";
import { validCoords } from "@/lib/place";

export const revalidate = 900;

const UA = "AetherBandCompanion/0.1 (https://open-meteo.com)";

async function getJson(url: string) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    next: { revalidate: 900 },
  });
  if (!res.ok) {
    throw new Error(`${url} failed ${res.status}`);
  }
  return res.json();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!validCoords(lat, lon)) {
    return Response.json({ error: "Valid lat and lon are required." }, { status: 400 });
  }

  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,cloud_cover,surface_pressure,is_day` +
    `&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,uv_index` +
    `&daily=sunrise,sunset,uv_index_max,temperature_2m_max,temperature_2m_min` +
    `&past_days=1&forecast_days=3&timezone=auto`;

  const airUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=us_aqi,european_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide,uv_index,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen` +
    `&timezone=auto`;

  const elevUrl = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;

  try {
    const [forecast, air, elevation] = await Promise.all([
      getJson(forecastUrl),
      getJson(airUrl),
      getJson(elevUrl),
    ]);
    const elevationM =
      Array.isArray(elevation?.elevation) && typeof elevation.elevation[0] === "number"
        ? elevation.elevation[0]
        : null;
    const snapshot = buildEnvironmentSnapshot({
      lat,
      lon,
      elevationM,
      forecast,
      air,
    });
    return Response.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Environment fetch failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
