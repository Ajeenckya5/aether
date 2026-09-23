import type { AetherSleepEpoch } from "@/lib/aether-sleep";
import {
  AETHER_SLEEP_PHASES,
  aetherSleepPhaseColor,
  aetherSleepPhaseLabel,
} from "@/lib/aether-sleep";
import type { SleepStageSummary } from "@/lib/types";
import { formatMillis } from "@/lib/format";

const WHOOP_ARCHITECTURE = [
  { key: "total_awake_time_milli", label: "Awake", color: "#c9c2b6" },
  { key: "total_rem_sleep_time_milli", label: "REM", color: "#9d8cff" },
  { key: "total_light_sleep_time_milli", label: "Light", color: "#7ad7ff" },
  { key: "total_slow_wave_sleep_time_milli", label: "Deep", color: "#d6ff4b" },
] as const;

const AETHER_ARCHITECTURE = [
  { key: "total_awake_time_milli", label: "Wake", color: "#c9c2b6" },
  { key: "total_rem_sleep_time_milli", label: "Active rest", color: "#9d8cff" },
  { key: "total_light_sleep_time_milli", label: "Quiet", color: "#7ad7ff" },
  { key: "total_slow_wave_sleep_time_milli", label: "Deep rest", color: "#d6ff4b" },
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

export function SleepStages({
  stages,
  source = "whoop",
  epochs,
}: {
  stages: SleepStageSummary;
  source?: "whoop" | "aether";
  epochs?: AetherSleepEpoch[];
}) {
  const aether = source === "aether";
  const restWake = isRestWakeStages(stages);
  const rows = aether
    ? restWake
      ? REST_WAKE
      : AETHER_ARCHITECTURE
    : restWake
      ? REST_WAKE
      : WHOOP_ARCHITECTURE;
  const total = rows.reduce((sum, stage) => sum + stages[stage.key], 0) || 1;
  const visible = rows.filter((stage) => stages[stage.key] > 0 || restWake);

  return (
    <div className="space-y-3">
      {aether && epochs && epochs.length > 1 ? (
        <AetherHypnogram epochs={epochs} />
      ) : null}
      <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
        {visible.map((stage) => (
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
        {visible.map((stage) => (
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

export function AetherHypnogram({ epochs }: { epochs: AetherSleepEpoch[] }) {
  const span = epochs.reduce((sum, row) => sum + row.durMs, 0) || 1;
  const rows = [...AETHER_SLEEP_PHASES];
  let offset = 0;
  const blocks = epochs.map((epoch) => {
    const left = offset / span;
    offset += epoch.durMs;
    return { ...epoch, left, width: epoch.durMs / span };
  });

  return (
    <div
      className="rounded-2xl bg-white/4 px-3 py-3"
      role="img"
      aria-label="Aether sleep from public heart rate, over time"
    >
      <p className="text-[10px] uppercase tracking-widest text-muted">
        Aether sleep · public HR
      </p>
      <div className="mt-2 space-y-1">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[10px] uppercase tracking-widest text-muted">
              {aetherSleepPhaseLabel(row.id).split(" ")[0]}
            </span>
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-black/25">
              {blocks
                .filter((block) => block.phase === row.id)
                .map((block, index) => (
                  <span
                    key={`${row.id}-${index}`}
                    className="absolute inset-y-0 rounded-full"
                    style={{
                      left: `${block.left * 100}%`,
                      width: `${Math.max(block.width * 100, 0.6)}%`,
                      background: aetherSleepPhaseColor(block.phase),
                    }}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
