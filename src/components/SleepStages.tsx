"use client";

import type { SleepStageSummary } from "@/lib/types";
import { formatMillis } from "@/lib/format";

const ARCHITECTURE = [
  { key: "total_awake_time_milli", label: "Awake", color: "#c9c2b6" },
  { key: "total_rem_sleep_time_milli", label: "REM", color: "#9d8cff" },
  { key: "total_light_sleep_time_milli", label: "Light", color: "#7ad7ff" },
  { key: "total_slow_wave_sleep_time_milli", label: "Deep", color: "#d6ff4b" },
] as const;

const REST_WAKE = [
  { key: "total_awake_time_milli", label: "Awake", color: "#c9c2b6" },
  { key: "total_light_sleep_time_milli", label: "Rest", color: "#7ad7ff" },
] as const;

export function isRestWakeStages(stages: SleepStageSummary): boolean {
  return (
    stages.total_rem_sleep_time_milli === 0 &&
    stages.total_slow_wave_sleep_time_milli === 0
  );
}

export function SleepStages({ stages }: { stages: SleepStageSummary }) {
  const rows = isRestWakeStages(stages) ? REST_WAKE : ARCHITECTURE;
  const total =
    rows.reduce((sum, stage) => sum + stages[stage.key], 0) || 1;

  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
        {rows.map((stage) => (
          <div
            key={stage.key}
            style={{
              width: `${(stages[stage.key] / total) * 100}%`,
              background: stage.color,
            }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {rows.map((stage) => (
          <div
            key={stage.key}
            className="flex items-center justify-between rounded-2xl bg-white/4 px-3 py-2"
          >
            <span className="flex items-center gap-2 text-sm text-muted">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: stage.color }}
              />
              {stage.label}
            </span>
            <span className="text-sm text-paper">
              {formatMillis(stages[stage.key])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
