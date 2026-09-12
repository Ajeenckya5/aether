import { validCoords } from "@/lib/place";

export const revalidate = 3600;

const UA = "AetherBandCompanion/0.1";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  try {
    if (q.length >= 2) {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`;
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        next: { revalidate: 3600 },
      });
      if (!res.ok) throw new Error(`Geocode failed ${res.status}`);
      const data = (await res.json()) as { results?: GeoHit[] };
      const results = (data.results ?? []).map((hit) => ({
        name: label(hit),
        lat: hit.latitude,
        lon: hit.longitude,
        timezone: hit.timezone ?? null,
      }));
      return Response.json({ results });
    }

    if (validCoords(lat, lon)) {
      const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`;
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        const data = (await res.json()) as { results?: GeoHit[] };
        const hit = data.results?.[0];
        if (hit) {
          return Response.json({
            results: [
              {
                name: label(hit),
                lat: hit.latitude,
                lon: hit.longitude,
                timezone: hit.timezone ?? null,
              },
            ],
          });
        }
      }
      return Response.json({
        results: [
          {
            name: `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
            lat,
            lon,
            timezone: null,
          },
        ],
      });
    }

    return Response.json({ error: "Provide q or lat/lon." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Geocode failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
