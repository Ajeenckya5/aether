"use client";

import Link from "next/link";
import { formatClock, zoneDurationsFromMs } from "@/lib/live-math";
import { sportLabel } from "@/lib/sports";
import type { LiveLog } from "@/lib/sessions";
import { ZoneBar } from "./ZoneBar";

export function LiveLogCard({ log }: { log: LiveLog }) {
  return (
    <Link
      href={`/workouts/local?id=${encodeURIComponent(log.id)}`}
      className="block overflow-hidden rounded-[28px] border border-white/8 bg-panel p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-aqua">Recorded here</p>
          <p className="font-display mt-1 text-xl">{log.title}</p>
          <p className="text-xs text-muted">
            {sportLabel(log.sport)} · {formatClock(log.durationMs)} ·{" "}
            {log.source === "strap" ? "strap" : log.source === "practice" ? "practice pulse" : "timer"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl text-ember">{log.strainProxy.toFixed(1)}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted">Strain</p>
        </div>
      </div>
      <div className="mt-3">
        <ZoneBar zones={zoneDurationsFromMs(log.zoneMs)} compact />
      </div>
    </Link>
  );
}
