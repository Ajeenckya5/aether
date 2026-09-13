"use client";

import { useEffect, useState } from "react";
import { formatDate, formatHours, formatTime } from "@/lib/format";
import { isAetherOvernightSleep, scoredSleepMs } from "@/lib/overnight";
import { useLab } from "./useLab";
import { useLiveHeartRate } from "./LiveHeartRate";
import { isRestWakeStages, SleepStages } from "./SleepStages";

export function SleepDetailView({ id }: { id: string }) {
  const { data, loading } = useLab();
  const hr = useLiveHeartRate();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  const sleep = data.sleeps.find((item) => item.id === id);
  const recovery = data.recoveries.find((item) => item.sleep_id === id);
  const fromBand = isAetherOvernightSleep(sleep?.id);
  const restWake = sleep?.score ? isRestWakeStages(sleep.score.stage_summary) : false;
  const epochs = fromBand ? (hr.overnight?.epochs ?? []) : [];

  if ((loading || !hydrated) && !sleep) {
    return <p className="px-5 pt-16 text-sm text-muted">Loading night…</p>;
  }
  if (!sleep) {
    return <p className="px-5 pt-16 text-sm text-muted">Sleep not found.</p>;
  }

  const score = sleep.score;

  return (
    <div className="px-5 pb-8 pt-16">
      <p className="text-[11px] uppercase tracking-[0.18em] text-violet">
        {sleep.nap ? "Nap" : fromBand ? (restWake ? "Aether overnight" : "Aether sleep") : "Night"}
      </p>
      <h1 className="font-display mt-2 text-4xl">{formatDate(sleep.end)}</h1>
      <p className="mt-2 text-sm text-muted">
        {formatTime(sleep.start)} – {formatTime(sleep.end)}
      </p>

      {score ? (
        <>
          <div className="mt-6 rounded-[32px] bg-violet/12 p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-violet">
              {fromBand ? (restWake ? "Quiet HR rest" : "Aether sleep") : "Performance"}
            </p>
            <p className="font-display mt-2 text-6xl leading-none">
              {score.sleep_performance_percentage}%
            </p>
            <p className="mt-2 text-sm text-paper/70">
              {formatHours(
                scoredSleepMs(score.stage_summary, fromBand && !restWake),
              )}{" "}
              {fromBand ? (restWake ? "quiet HR window" : "asleep") : "in bed"}
            </p>
            {fromBand ? (
              <p className="mt-2 text-xs text-muted">
                {restWake
                  ? "Rest vs wake from public heart rate. Not WHOOP REM / light / deep."
                  : "Aether sleep from public heart rate and HRV. Not WHOOP stages, not a clinical sleep study."}
              </p>
            ) : null}
          </div>
          <div className="mt-4">
            <SleepStages
              stages={score.stage_summary}
              source={fromBand ? "aether" : "whoop"}
              epochs={epochs}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Mini label="Efficiency" value={`${Math.round(score.sleep_efficiency_percentage)}%`} />
            {score.sleep_consistency_percentage > 0 ? (
              <Mini label="Consistency" value={`${score.sleep_consistency_percentage}%`} />
            ) : (
              <Mini label="Source" value="Public HR" />
            )}
            {score.stage_summary.sleep_cycle_count > 0 ? (
              <Mini label="Cycles" value={String(score.stage_summary.sleep_cycle_count)} />
            ) : null}
            {score.stage_summary.disturbance_count > 0 ? (
              <Mini label="Disturbances" value={String(score.stage_summary.disturbance_count)} />
            ) : null}
            {score.respiratory_rate > 0 ? (
              <Mini label="Respiratory" value={`${score.respiratory_rate.toFixed(1)}`} />
            ) : null}
            <Mini
              label={fromBand ? "HRV" : "Recovery"}
              value={
                fromBand
                  ? recovery?.score
                    ? `${Math.round(recovery.score.hrv_rmssd_milli)} ms`
                    : "—"
                  : recovery?.score
                    ? `${recovery.score.recovery_score}%`
                    : "—"
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
