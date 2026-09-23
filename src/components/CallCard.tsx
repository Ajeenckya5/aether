"use client";

import Link from "next/link";
import type { LabReport } from "@/lib/intelligence";

const COPY: Record<
  LabReport["call"],
  { title: string; kicker: string; color: string; bg: string }
> = {
  push: {
    title: "Push",
    kicker: "Quality intensity is on the table",
    color: "#ff5c2a",
    bg: "bg-ember/15",
  },
  build: {
    title: "Build",
    kicker: "Aerobic or skill work — not a breakthrough",
    color: "#d6ff4b",
    bg: "bg-lime/12",
  },
  recover: {
    title: "Recover",
    kicker: "Protect the next 36 hours",
    color: "#9d8cff",
    bg: "bg-violet/15",
  },
};

export function CallCard({
  report,
  extraNotes,
  sample = false,
}: {
  report: LabReport;
  extraNotes?: string[];
  sample?: boolean;
}) {
  const tone = COPY[report.call];
  const notes = [...report.callWhy, ...(extraNotes ?? [])];
  return (
    <section className={`rounded-[32px] p-5 ${tone.bg}`}>
      <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: tone.color }}>
        {"Today's call"}
      </p>
      <h2 className="font-display mt-2 text-5xl leading-none">{tone.title}</h2>
      <p className="mt-2 text-sm text-paper/75">{tone.kicker}</p>
      <ul className="mt-4 space-y-2 text-sm text-paper/80">
        {notes.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted">Aether</p>
          <p className="font-display text-2xl">{Math.round(report.aether)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted">
            {sample ? "Sample" : "WHOOP"}
          </p>
          <p className="font-display text-2xl">
            {report.whoop == null ? "—" : Math.round(report.whoop)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted">Delta</p>
          <p className="font-display text-2xl">
            {report.delta == null
              ? "—"
              : `${report.delta > 0 ? "+" : ""}${Math.round(report.delta)}`}
          </p>
        </div>
      </div>
      <Link
        href={`/coach/${report.coachSlug}`}
        className="mt-5 block rounded-full bg-paper px-4 py-3 text-center text-sm font-medium text-ink"
      >
        Do this: {report.coachLabel}
      </Link>
    </section>
  );
}
