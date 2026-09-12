import { reversePlace, searchPlaces } from "@/lib/open-meteo";
import { validCoords } from "@/lib/place";

export const revalidate = 3600;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  try {
    if (q.length >= 2) {
      return Response.json({ results: await searchPlaces(q) });
    }
    if (validCoords(lat, lon)) {
      const hit = await reversePlace(lat, lon);
      return Response.json({ results: [hit] });
    }
    return Response.json({ error: "Provide q or lat/lon." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Geocode failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
