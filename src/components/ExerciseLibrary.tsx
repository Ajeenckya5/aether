"use client";

import { useEffect, useState } from "react";
import type { TrainingCall } from "@/lib/intelligence";

type Exercise = {
  id: string | number;
  name: string;
  category: string | null;
  image: string | null;
  description: string | null;
};

function imageUrl(src: string | null): string | null {
  if (!src) return null;
  if (src.startsWith("http")) return src;
  return `https://wger.de${src.startsWith("/") ? src : `/${src}`}`;
}

export function ExerciseLibrary({ intent }: { intent: TrainingCall | "build" }) {
  const [rows, setRows] = useState<Exercise[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/exercises?intent=${intent}`)
      .then(async (res) => {
        const body = await res.json();
        if (!cancelled) setRows((body.exercises ?? []) as Exercise[]);
      })
      .catch(() => {
        if (!cancelled) setError("wger.de is unreachable.");
      });
    return () => {
      cancelled = true;
    };
  }, [intent]);

  if (error) {
    return <p className="mt-8 text-sm text-muted">{error}</p>;
  }
  if (!rows.length) return null;

  return (
    <section className="mt-8 pb-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-aqua">Open library</p>
      <h2 className="font-display mt-1 text-lg">wger movements</h2>
      <p className="text-xs text-muted">
        Free wger.de library by body region — cardio/core on recover days, lift
        patterns on push. Not WHOOP classes.
      </p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => {
          const src = imageUrl(row.image);
          return (
            <li
              key={row.id}
              className="flex gap-3 overflow-hidden rounded-2xl border border-white/8 bg-panel"
            >
              <div className="h-16 w-16 shrink-0 bg-white/4">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center py-2 pr-3">
                <p className="truncate text-sm text-paper">{row.name}</p>
                <p className="text-[11px] text-muted">{row.category || "Movement"}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
