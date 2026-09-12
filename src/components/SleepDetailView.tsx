"use client";

import { formatDate, formatHours, formatTime } from "@/lib/format";
import { useDashboard } from "./DataProvider";
import { SleepStages } from "./SleepStages";

export function SleepDetailView({ id }: { id: string }) {
  const { data, loading } = useDashboard();
  const sleep = data.sleeps.find((item) => item.id === id);
  const recovery = data.recoveries.find((item) => item.sleep_id === id);

  if (loading && !sleep) {
    return <p className="px-5 pt-16 text-sm text-muted">Loading night…</p>;
  }
  if (!sleep) {
    return <p className="px-5 pt-16 text-sm text-muted">Sleep not found.</p>;
  }

  const score = sleep.score;

  return (
    <div className="px-5 pb-8 pt-16">
      <p className="text-[11px] uppercase tracking-[0.18em] text-violet">
        {sleep.nap ? "Nap" : "Night"}
      </p>
      <h1 className="font-display mt-2 text-4xl">{formatDate(sleep.end)}</h1>
      <p className="mt-2 text-sm text-muted">
        {formatTime(sleep.start)} – {formatTime(sleep.end)}
      </p>

      {score ? (
        <>
          <div className="mt-6 rounded-[32px] bg-violet/12 p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-violet">
              Performance
            </p>
            <p className="font-display mt-2 text-6xl leading-none">
              {score.sleep_performance_percentage}%
            </p>
            <p className="mt-2 text-sm text-paper/70">
              {formatHours(score.stage_summary.total_in_bed_time_milli)} in bed
            </p>
          </div>
          <div className="mt-4">
            <SleepStages stages={score.stage_summary} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Mini label="Efficiency" value={`${Math.round(score.sleep_efficiency_percentage)}%`} />
            <Mini label="Consistency" value={`${score.sleep_consistency_percentage}%`} />
            <Mini label="Cycles" value={String(score.stage_summary.sleep_cycle_count)} />
            <Mini label="Disturbances" value={String(score.stage_summary.disturbance_count)} />
            <Mini label="Respiratory" value={`${score.respiratory_rate.toFixed(1)}`} />
            <Mini
              label="Recovery"
              value={
                recovery?.score ? `${recovery.score.recovery_score}%` : "—"
              }
            />
          </div>
        </>
      ) : (
        <p className="mt-6 text-sm text-muted">{sleep.score_state}</p>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 px-3 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 text-lg">{value}</p>
    </div>
  );
}
