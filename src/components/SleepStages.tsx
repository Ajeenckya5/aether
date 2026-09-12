"use client";

import type { SleepStageSummary } from "@/lib/types";
import { formatMillis } from "@/lib/format";

const STAGES = [
  { key: "total_awake_time_milli", label: "Awake", color: "#c9c2b6" },
  { key: "total_rem_sleep_time_milli", label: "REM", color: "#9d8cff" },
  { key: "total_light_sleep_time_milli", label: "Light", color: "#7ad7ff" },
  { key: "total_slow_wave_sleep_time_milli", label: "Deep", color: "#d6ff4b" },
] as const;

export function SleepStages({ stages }: { stages: SleepStageSummary }) {
  const total =
    stages.total_awake_time_milli +
    stages.total_rem_sleep_time_milli +
    stages.total_light_sleep_time_milli +
    stages.total_slow_wave_sleep_time_milli || 1;

  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
        {STAGES.map((stage) => (
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
        {STAGES.map((stage) => (
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
