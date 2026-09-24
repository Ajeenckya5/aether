import { fetchExercises } from "@/lib/wger";

export const revalidate = 3600;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const intent = searchParams.get("intent") ?? "build";
  try {
    const exercises = await fetchExercises(intent);
    return Response.json({ source: "wger.de", intent, exercises });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Exercise fetch failed";
    return Response.json({ error: message, exercises: [] }, { status: 502 });
  }
}
