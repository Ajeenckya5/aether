import {
  altitudeVo2PenaltyPct,
  bomWbgtC,
  clockHourFromIso,
  heatIndexC,
  humidexC,
  outdoorCall,
  stullWetBulbC,
  usAqiBand,
  uvBand,
  wmoText,
  type OutdoorLevel,
} from "./climate";

export type HourPoint = {
  iso: string;
  tempC: number | null;
  humidity: number | null;
  apparentC: number | null;
  uv: number | null;
  precipChance: number | null;
};

export type EnvironmentSnapshot = {
  fetchedAt: string;
  lat: number;
  lon: number;
  timezone: string;
  elevationM: number | null;
  weather: {
    tempC: number | null;
    apparentC: number | null;
    humidity: number | null;
    windKph: number | null;
    gustKph: number | null;
    precipMm: number | null;
    cloudPct: number | null;
    pressureHpa: number | null;
    weatherCode: number | null;
    weatherText: string;
    isDay: boolean;
  };
  derived: {
    heatIndexC: number | null;
    humidexC: number | null;
    wetBulbC: number | null;
    wbgtC: number | null;
    altitudePenaltyPct: number;
  };
  air: {
    usAqi: number | null;
    usAqiLabel: string;
    europeanAqi: number | null;
    pm25: number | null;
    pm10: number | null;
    ozone: number | null;
    no2: number | null;
    pollenMax: number | null;
    pollenLabel: string | null;
  };
  sun: {
    sunrise: string | null;
    sunset: string | null;
    solarNoonHour: number | null;
    uvMax: number | null;
    uvLabel: string;
    dayTempMax: number | null;
    dayTempMin: number | null;
  };
  overnight: {
    minC: number | null;
    meanC: number | null;
  };
  outdoor: {
    level: OutdoorLevel;
    title: string;
    notes: string[];
  };
  bestWindow: {
    iso: string;
    hourLabel: string;
    tempC: number | null;
    uv: number | null;
    why: string;
  } | null;
  hours: HourPoint[];
  sources: string[];
};

type ForecastPayload = {
  timezone?: string;
  current?: Record<string, number | string | null>;
  hourly?: {
    time: string[];
    temperature_2m?: (number | null)[];
    relative_humidity_2m?: (number | null)[];
    apparent_temperature?: (number | null)[];
    precipitation_probability?: (number | null)[];
    uv_index?: (number | null)[];
  };
  daily?: {
    time: string[];
    sunrise?: string[];
    sunset?: string[];
    uv_index_max?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
  };
};

type AirPayload = {
  current?: Record<string, number | null>;
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function pollenPeak(current: Record<string, number | null> | undefined): {
  value: number | null;
  label: string | null;
} {
  if (!current) return { value: null, label: null };
  const keys = [
    ["alder_pollen", "Alder"],
    ["birch_pollen", "Birch"],
    ["grass_pollen", "Grass"],
    ["mugwort_pollen", "Mugwort"],
    ["olive_pollen", "Olive"],
    ["ragweed_pollen", "Ragweed"],
  ] as const;
  let best: { value: number; label: string } | null = null;
  for (const [key, label] of keys) {
    const v = current[key];
    if (typeof v === "number" && v > 0 && (!best || v > best.value)) {
      best = { value: v, label };
    }
  }
  return best
    ? { value: best.value, label: `${best.label} ${best.value.toFixed(0)}` }
    : { value: null, label: null };
}

function overnightTemps(
  times: string[],
  temps: (number | null)[] | undefined,
  now: Date,
): { minC: number | null; meanC: number | null } {
  if (!temps?.length) return { minC: null, meanC: null };
  const start = new Date(now);
  start.setHours(start.getHours() - 10);
  const vals: number[] = [];
  for (let i = 0; i < times.length; i += 1) {
    const t = new Date(times[i]).getTime();
    if (t >= start.getTime() && t <= now.getTime()) {
      const v = temps[i];
      if (typeof v === "number") vals.push(v);
    }
  }
  if (!vals.length) return { minC: null, meanC: null };
  return {
    minC: Math.min(...vals),
    meanC: vals.reduce((a, b) => a + b, 0) / vals.length,
  };
}

function pickBestWindow(hours: HourPoint[], now: Date): EnvironmentSnapshot["bestWindow"] {
  const candidates = hours.filter((h) => {
    const d = new Date(h.iso);
    const hour = d.getHours();
    if (hour < 6 || hour > 20) return false;
    return d.getTime() >= now.getTime() - 30 * 60000;
  });
  const pool = candidates.length
    ? candidates.filter((h) => new Date(h.iso).getTime() <= now.getTime() + 36 * 3600000)
    : hours.filter((h) => {
        const d = new Date(h.iso);
        return d.getHours() >= 6 && d.getHours() <= 20;
      });
  if (!pool.length) return null;
  let best = pool[0];
  let bestScore = Infinity;
  for (const h of pool) {
    const heat = h.tempC ?? 20;
    const uv = h.uv ?? 0;
    const rain = h.precipChance ?? 0;
    const score = Math.abs(heat - 16) + uv * 0.35 + rain * 0.08;
    if (score < bestScore) {
      bestScore = score;
      best = h;
    }
  }
  const when = new Date(best.iso);
  return {
    iso: best.iso,
    hourLabel: when.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
    tempC: best.tempC,
    uv: best.uv,
    why: "Coolest daylight hour with lower UV and rain chance (next ~36 h).",
  };
}

export function buildEnvironmentSnapshot(input: {
  lat: number;
  lon: number;
  elevationM: number | null;
  forecast: ForecastPayload;
  air: AirPayload;
}): EnvironmentSnapshot {
  const now = new Date();
  const current = input.forecast.current ?? {};
  const air = input.air.current ?? {};
  const temp = num(current.temperature_2m);
  const rh = num(current.relative_humidity_2m);
  const hi = temp != null && rh != null ? heatIndexC(temp, rh) : null;
  const humidex = temp != null && rh != null ? humidexC(temp, rh) : null;
  const tw = temp != null && rh != null ? stullWetBulbC(temp, rh) : null;
  const wbgt = temp != null && rh != null ? bomWbgtC(temp, rh) : null;
  const usAqi = num(air.us_aqi);
  const aqi = usAqi != null ? usAqiBand(usAqi) : null;
  const pollen = pollenPeak(air);
  const outdoor = outdoorCall({ wbgt, usAqi, heatIndex: hi });

  const hourlyTimes = input.forecast.hourly?.time ?? [];
  const hours: HourPoint[] = hourlyTimes.map((iso, i) => ({
    iso,
    tempC: input.forecast.hourly?.temperature_2m?.[i] ?? null,
    humidity: input.forecast.hourly?.relative_humidity_2m?.[i] ?? null,
    apparentC: input.forecast.hourly?.apparent_temperature?.[i] ?? null,
    uv: input.forecast.hourly?.uv_index?.[i] ?? null,
    precipChance: input.forecast.hourly?.precipitation_probability?.[i] ?? null,
  }));

  const sunrise = input.forecast.daily?.sunrise?.[1] ?? input.forecast.daily?.sunrise?.[0] ?? null;
  const sunset = input.forecast.daily?.sunset?.[1] ?? input.forecast.daily?.sunset?.[0] ?? null;
  let solarNoonHour: number | null = null;
  if (sunrise && sunset) {
    solarNoonHour = (clockHourFromIso(sunrise) + clockHourFromIso(sunset)) / 2;
  }
  const uvMax =
    input.forecast.daily?.uv_index_max?.[1] ??
    input.forecast.daily?.uv_index_max?.[0] ??
    null;
  const uv = uvBand(uvMax ?? 0);

  const overnight = overnightTemps(
    hourlyTimes,
    input.forecast.hourly?.temperature_2m,
    now,
  );

  return {
    fetchedAt: now.toISOString(),
    lat: input.lat,
    lon: input.lon,
    timezone: input.forecast.timezone ?? "auto",
    elevationM: input.elevationM,
    weather: {
      tempC: temp,
      apparentC: num(current.apparent_temperature),
      humidity: rh,
      windKph: num(current.wind_speed_10m),
      gustKph: num(current.wind_gusts_10m),
      precipMm: num(current.precipitation),
      cloudPct: num(current.cloud_cover),
      pressureHpa: num(current.surface_pressure),
      weatherCode: num(current.weather_code),
      weatherText: wmoText(num(current.weather_code)),
      isDay: Number(current.is_day) === 1,
    },
    derived: {
      heatIndexC: hi,
      humidexC: humidex,
      wetBulbC: tw,
      wbgtC: wbgt,
      altitudePenaltyPct: input.elevationM != null ? altitudeVo2PenaltyPct(input.elevationM) : 0,
    },
    air: {
      usAqi,
      usAqiLabel: aqi?.label ?? "—",
      europeanAqi: num(air.european_aqi),
      pm25: num(air.pm2_5),
      pm10: num(air.pm10),
      ozone: num(air.ozone),
      no2: num(air.nitrogen_dioxide),
      pollenMax: pollen.value,
      pollenLabel: pollen.label,
    },
    sun: {
      sunrise,
      sunset,
      solarNoonHour,
      uvMax,
      uvLabel: uv.label,
      dayTempMax:
        input.forecast.daily?.temperature_2m_max?.[1] ??
        input.forecast.daily?.temperature_2m_max?.[0] ??
        null,
      dayTempMin:
        input.forecast.daily?.temperature_2m_min?.[1] ??
        input.forecast.daily?.temperature_2m_min?.[0] ??
        null,
    },
    overnight,
    outdoor,
    bestWindow: pickBestWindow(hours, now),
    hours: hours.slice(0, 36),
    sources: [
      "Open-Meteo forecast + CAMS air quality (no API key)",
      "Heat index: NWS Rothfusz",
      "Wet-bulb: Stull 2011 JAMC",
      "WBGT: Australian Bureau of Meteorology outdoor approximation",
      "AQI bands: US EPA",
      "UV bands: WHO",
    ],
  };
}

export function solarAlignmentHours(
  midsleepHour: number | null,
  solarNoonHour: number | null,
): number | null {
  if (midsleepHour == null || solarNoonHour == null) return null;
  const solarMidnight = (solarNoonHour + 12) % 24;
  let delta = Math.abs(midsleepHour - solarMidnight);
  if (delta > 12) delta = 24 - delta;
  return delta;
}
