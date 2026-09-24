"use client";

import Link from "next/link";
import { formatDate, formatHours, formatTime } from "@/lib/format";
import { isAetherOvernightSleep, scoredSleepMs } from "@/lib/overnight";
import { useLab } from "./useLab";
import { useLiveHeartRate } from "./heart-rate-context";
import { isRestWakeStages, SleepStages } from "./SleepStages";
import { SourceBanner } from "./SourceBanner";

export function SleepView() {
  const { data } = useLab();
  const hr = useLiveHeartRate();
  const latest = data.sleeps.find((s) => !s.nap) ?? data.sleeps[0];
  const restWake = latest?.score ? isRestWakeStages(latest.score.stage_summary) : false;
  const fromBand = isAetherOvernightSleep(latest?.id);
  const epochs = fromBand ? (hr.overnight?.epochs ?? []) : [];

  return (
    <div className="px-5 pt-6 lg:px-2">
      <SourceBanner />
      <h1 className="font-display mt-2 text-4xl">Sleep</h1>
      {latest?.score ? (
        <div className="mt-6 rounded-[32px] bg-violet/12 p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet">
            {fromBand ? (restWake ? "Aether overnight" : "Aether sleep") : "Performance"}
          </p>
          <p className="font-display mt-2 text-6xl leading-none">
            {latest.score.sleep_performance_percentage}%
          </p>
          <p className="mt-2 text-sm text-paper/70">
            {formatHours(
              scoredSleepMs(latest.score.stage_summary, fromBand && !restWake),
            )}{" "}
            {fromBand ? (restWake ? "quiet HR window" : "asleep") : "in bed"} · {formatTime(latest.start)} –{" "}
            {formatTime(latest.end)}
          </p>
          {fromBand ? (
            <p className="mt-2 text-xs text-muted">
              {restWake
                ? "Rest vs wake from public heart rate. Leave Aether connected longer for Aether sleep."
                : "Aether sleep from public heart rate and HRV. Not a clinical sleep study."}
            </p>
          ) : null}
          <div className="mt-5">
            <SleepStages
              stages={latest.score.stage_summary}
              source={fromBand ? "aether" : "whoop"}
              epochs={epochs}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted">Efficiency</p>
              <p>{Math.round(latest.score.sleep_efficiency_percentage)}%</p>
            </div>
            {latest.score.sleep_consistency_percentage > 0 ? (
              <div>
                <p className="text-muted">Consistency</p>
                <p>{latest.score.sleep_consistency_percentage}%</p>
              </div>
            ) : (
              <div>
                <p className="text-muted">Source</p>
                <p>{fromBand ? "Public HR" : "Sample"}</p>
              </div>
            )}
            {latest.score.respiratory_rate > 0 ? (
              <div>
                <p className="text-muted">Breaths</p>
                <p>{latest.score.respiratory_rate.toFixed(1)}</p>
              </div>
            ) : (
              <div>
                <p className="text-muted">Stages</p>
                <p>{fromBand ? (restWake ? "Rest / wake" : "Aether") : "Full"}</p>
              </div>
            )}
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
              href={`/sleep/view?id=${encodeURIComponent(sleep.id)}`}
              className="flex items-center justify-between rounded-2xl border border-white/8 px-4 py-3"
            >
              <div>
                <p className="text-sm">
                  {formatDate(sleep.end)}
                  {sleep.nap ? " · Nap" : ""}
                  {isAetherOvernightSleep(sleep.id) ? " · Aether" : ""}
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
