"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatClock, zoneDurationsFromMs } from "@/lib/live-math";
import { deleteLiveLog, getLiveLog, type LiveLog } from "@/lib/sessions";
import { sportLabel } from "@/lib/sports";
import { ZoneBar } from "./ZoneBar";

export function LiveLogReview() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [log, setLog] = useState<LiveLog | null | undefined>(undefined);

  useEffect(() => {
    setLog(getLiveLog(params.id) ?? null);
  }, [params.id]);

  if (log === undefined) {
    return <p className="px-5 pt-16 text-sm text-muted">Loading…</p>;
  }
  if (!log) {
    return (
      <div className="px-5 pt-16 text-sm text-muted">
        Session not on this device.{" "}
        <Link href="/coach/live" className="text-lime">
          Track live
        </Link>
      </div>
    );
  }

  const spark = log.samples.filter((s) => s.bpm != null);

  return (
    <div className="px-5 pt-14 pb-10">
      <p className="text-[11px] uppercase tracking-[0.18em] text-aqua">Local recording</p>
      <h1 className="font-display mt-2 text-4xl">{log.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {sportLabel(log.sport)} · {formatClock(log.durationMs)} ·{" "}
        {log.source === "strap"
          ? "Bluetooth HR strap"
          : log.source === "practice"
            ? "Practice pulse"
            : "Timer only"}
        {log.distanceM != null ? ` · ${(log.distanceM / 1000).toFixed(2)} km` : ""}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-2 text-center">
        <Mini label="Avg" value={log.avgHr ? `${Math.round(log.avgHr)}` : "—"} />
        <Mini label="Max" value={log.maxHr ? `${Math.round(log.maxHr)}` : "—"} />
        <Mini label="TRIMP" value={`${Math.round(log.edwardsTrimp)}`} />
      </div>
      <div className="mt-4">
        <ZoneBar zones={zoneDurationsFromMs(log.zoneMs)} />
      </div>
      {spark.length > 1 && (
        <svg viewBox="0 0 100 36" className="mt-5 h-24 w-full text-lime">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            points={spark
              .map((s, i) => {
                const x = (i / (spark.length - 1)) * 100;
                const y = 34 - ((s.bpm! - 70) / 130) * 32;
                return `${x},${Math.max(2, Math.min(34, y))}`;
              })
              .join(" ")}
          />
        </svg>
      )}
      <p className="mt-3 text-xs text-muted">
        Edwards TRIMP from %HRmax zones. WHOOP still records the band separately in their app.
      </p>
      <div className="mt-6 grid gap-2">
        <Link href="/coach/live" className="rounded-full bg-ember py-3 text-center text-sm">
          Track another
        </Link>
        <button
          type="button"
          onClick={() => {
            deleteLiveLog(log.id);
            router.push("/workouts");
          }}
          className="rounded-full border border-white/15 py-3 text-sm text-muted"
        >
          Delete this recording
        </button>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 px-2 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className="font-display mt-1 text-2xl">{value}</p>
    </div>
  );
}
