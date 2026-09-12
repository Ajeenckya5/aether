export type PublicExercise = {
  id: number;
  name: string;
  category: string | null;
  image: string | null;
  description: string | null;
};

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

export async function fetchExercises(intent: string): Promise<PublicExercise[]> {
  const categories = CATEGORIES[intent] ?? CATEGORIES.build;
  const per = categories.length > 1 ? 4 : 8;
  const pages = await Promise.all(
    categories.map(async (category) => {
      const url = `https://wger.de/api/v2/exerciseinfo/?language=2&limit=${per}&category=${category}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`wger failed ${res.status}`);
      return (await res.json()) as WgerInfoList;
    }),
  );
  return pages.flatMap((page) =>
    (page.results ?? []).map((row) => {
      const copy = englishName(row);
      return {
        id: row.id,
        name: copy.name,
        category: row.category?.name ?? null,
        image: row.images?.[0]?.image || null,
        description: copy.description,
      };
    }),
  );
}
