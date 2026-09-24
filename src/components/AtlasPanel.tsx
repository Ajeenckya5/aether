"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AtlasMetric, AtlasReport } from "@/lib/atlas";

const TONE: Record<AtlasMetric["confidence"], string> = {
  measured: "text-lime",
  derived: "text-aqua",
  estimated: "text-gold",
  unavailable: "text-muted",
};

export function AtlasPanel({ atlas }: { atlas: AtlasReport }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const [open, setOpen] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return atlas.metrics.filter((m) => {
      if (group !== "All" && m.group !== group) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.formula.toLowerCase().includes(q) ||
        m.citation.toLowerCase().includes(q) ||
        m.id.includes(q)
      );
    });
  }, [atlas.metrics, group, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, AtlasMetric[]>();
    for (const m of filtered) {
      const list = map.get(m.group) ?? [];
      list.push(m);
      map.set(m.group, list);
    }
    return map;
  }, [filtered]);

  const tracked = atlas.metrics.filter((m) => m.confidence !== "unavailable").length;
  const missing = atlas.metrics.length - tracked;

  if (!ready) {
    return (
      <p className="text-sm text-muted">
        Computing published algorithms from this band…
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted">
        {tracked} computed from this band · {missing} known methods with no
        input this phone can see. Search by name, formula, or paper.{" "}
        <Link href="/settings" className="text-lime">
          Set height, weight, and age
        </Link>{" "}
        — Tanaka, Karvonen, BMR, VO2, and Klemera–Doubal biological age use them.
      </p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search KDM, TRIMP, SRI, VDOT, ACWR…"
        className="mt-3 w-full rounded-2xl border border-white/10 bg-white/4 px-4 py-3 text-sm outline-none placeholder:text-muted"
      />
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
        {["All", ...atlas.groups].map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] ${
              group === g ? "bg-lime text-ink" : "bg-white/6 text-paper"
            }`}
          >
            {g}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-5">
        {[...grouped.entries()].map(([title, rows]) => (
          <section key={title}>
            <h3 className="font-display text-lg">{title}</h3>
            <ul className="mt-2 space-y-2">
              {rows.map((m) => {
                const expanded = open === m.id;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : m.id)}
                      className="w-full rounded-2xl border border-white/8 px-3 py-3 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-paper">{m.name}</p>
                          <p className={`text-[10px] uppercase tracking-widest ${TONE[m.confidence]}`}>
                            {m.confidence}
                          </p>
                        </div>
                        <p className="font-display text-lg text-right">{m.display}</p>
                      </div>
                      {expanded && (
                        <div className="mt-3 space-y-2 text-xs text-muted">
                          <p>
                            <span className="text-paper">Formula. </span>
                            {m.formula}
                          </p>
                          <p>
                            <span className="text-paper">Source. </span>
                            {m.citation}
                          </p>
                          {m.note && <p>{m.note}</p>}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
