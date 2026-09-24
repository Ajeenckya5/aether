import { fetchEnvironment } from "@/lib/open-meteo";
import { validCoords } from "@/lib/place";

export const revalidate = 900;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!validCoords(lat, lon)) {
    return Response.json({ error: "Valid lat and lon are required." }, { status: 400 });
  }
  try {
    return Response.json(await fetchEnvironment(lat, lon));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Environment fetch failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
