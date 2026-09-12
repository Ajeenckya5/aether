export const revalidate = 3600;

const UA = "AetherBandCompanion/0.1";

type WgerInfoList = {
  results?: {
    id: number;
    images?: { image?: string }[];
    translations?: { language: number | { id: number }; name?: string; description?: string }[];
    category?: { name?: string };
  }[];
};

const CATEGORIES: Record<string, number[]> = {
  recover: [15, 10],
  build: [15, 12],
  push: [9, 11],
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function englishName(row: NonNullable<WgerInfoList["results"]>[number]) {
  const tr =
    row.translations?.find((t) =>
      typeof t.language === "number" ? t.language === 2 : t.language.id === 2,
    ) ?? row.translations?.[0];
  return {
    name: tr?.name || `Exercise ${row.id}`,
    description: tr?.description ? stripHtml(tr.description).slice(0, 180) : null,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const intent = searchParams.get("intent") ?? "build";
  const categories = CATEGORIES[intent] ?? CATEGORIES.build;
  const per = categories.length > 1 ? 4 : 8;

  try {
    const pages = await Promise.all(
      categories.map(async (category) => {
        const url = `https://wger.de/api/v2/exerciseinfo/?language=2&limit=${per}&category=${category}`;
        const res = await fetch(url, {
          headers: { Accept: "application/json", "User-Agent": UA },
          next: { revalidate: 3600 },
        });
        if (!res.ok) throw new Error(`wger failed ${res.status}`);
        return (await res.json()) as WgerInfoList;
      }),
    );
    const exercises = pages.flatMap((page) =>
      (page.results ?? []).map((row) => {
        const copy = englishName(row);
        const image = row.images?.[0]?.image || null;
        return {
          id: row.id,
          name: copy.name,
          category: row.category?.name ?? null,
          image,
          description: copy.description,
        };
      }),
    );
    return Response.json({ source: "wger.de", intent, exercises });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Exercise fetch failed";
    return Response.json({ error: message, exercises: [] }, { status: 502 });
  }
}
