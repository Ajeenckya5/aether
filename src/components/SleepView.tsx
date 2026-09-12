"use client";

import Link from "next/link";
import { formatDate, formatHours, formatTime } from "@/lib/format";
import { useDashboard } from "./DataProvider";
import { SleepStages } from "./SleepStages";
import { SourceBanner } from "./SourceBanner";

export function SleepView() {
  const { data } = useDashboard();
  const latest = data.sleeps.find((s) => !s.nap) ?? data.sleeps[0];

  return (
    <div className="px-5 pt-6 lg:px-2">
      <SourceBanner />
      <h1 className="font-display mt-2 text-4xl">Sleep</h1>
      {latest?.score ? (
        <div className="mt-6 rounded-[32px] bg-violet/12 p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet">
            Performance
          </p>
          <p className="font-display mt-2 text-6xl leading-none">
            {latest.score.sleep_performance_percentage}%
          </p>
          <p className="mt-2 text-sm text-paper/70">
            {formatHours(latest.score.stage_summary.total_in_bed_time_milli)} in bed ·{" "}
            {formatTime(latest.start)} – {formatTime(latest.end)}
          </p>
          <div className="mt-5">
            <SleepStages stages={latest.score.stage_summary} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted">Efficiency</p>
              <p>{Math.round(latest.score.sleep_efficiency_percentage)}%</p>
            </div>
            <div>
              <p className="text-muted">Consistency</p>
              <p>{latest.score.sleep_consistency_percentage}%</p>
            </div>
            <div>
              <p className="text-muted">Breaths</p>
              <p>{latest.score.respiratory_rate.toFixed(1)}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">No scored sleep yet.</p>
      )}

      <h2 className="font-display mt-8 text-lg">Nights</h2>
      <ul className="mt-3 space-y-2 pb-4">
        {data.sleeps.map((sleep) => (
          <li key={sleep.id}>
            <Link
              href={`/sleep/${sleep.id}`}
              className="flex items-center justify-between rounded-2xl border border-white/8 px-4 py-3"
            >
              <div>
                <p className="text-sm">
                  {formatDate(sleep.end)}
                  {sleep.nap ? " · Nap" : ""}
                </p>
                <p className="text-xs text-muted">
                  {sleep.score
                    ? formatHours(sleep.score.stage_summary.total_in_bed_time_milli)
                    : sleep.score_state}
                </p>
              </div>
              <p className="font-display text-2xl text-violet">
                {sleep.score ? `${sleep.score.sleep_performance_percentage}%` : "—"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
