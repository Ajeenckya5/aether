"use client";

import { formatDate, strainLabel } from "@/lib/format";
import { useDashboard } from "./DataProvider";
import { SourceBanner } from "./SourceBanner";

export function StrainView() {
  const { data } = useDashboard();
  const max = Math.max(21, ...data.cycles.map((c) => c.score?.strain ?? 0));
  const current = data.cycles[0]?.score;

  return (
    <div className="px-5 pt-6">
      <SourceBanner />
      <h1 className="font-display mt-2 text-4xl">Strain</h1>
      <p className="mt-2 text-sm text-muted">
        Day strain from the physiological cycle your band measures.
      </p>

      <div className="mt-6 rounded-[32px] bg-ember/12 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-ember">
          This cycle
        </p>
        <p className="font-display mt-2 text-6xl leading-none">
          {current ? current.strain.toFixed(1) : "—"}
        </p>
        <p className="mt-2 text-sm text-paper/70">
          {current ? strainLabel(current.strain) : "Waiting on a score"}
        </p>
        {current && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted">Avg HR</p>
              <p>{current.average_heart_rate}</p>
            </div>
            <div>
              <p className="text-muted">Max HR</p>
              <p>{current.max_heart_rate}</p>
            </div>
            <div>
              <p className="text-muted">kJ</p>
              <p>{Math.round(current.kilojoule)}</p>
            </div>
          </div>
        )}
      </div>

      <h2 className="font-display mt-8 text-lg">Last 14 days</h2>
      <div className="mt-4 flex h-48 items-end gap-1.5">
        {data.cycles
          .slice()
          .reverse()
          .map((cycle) => {
            const strain = cycle.score?.strain ?? 0;
            const height = `${Math.max(8, (strain / max) * 100)}%`;
            return (
              <div key={cycle.id} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-40 w-full items-end rounded-full bg-white/4">
                  <div
                    className="w-full rounded-full bg-ember"
                    style={{ height }}
                  />
                </div>
                <span className="text-[9px] text-muted" suppressHydrationWarning>
                  {new Date(cycle.start).getUTCDate()}
                </span>
              </div>
            );
          })}
      </div>

      <ul className="mt-6 space-y-2 pb-4">
        {data.cycles.map((cycle) => (
          <li
            key={cycle.id}
            className="flex items-center justify-between rounded-2xl border border-white/8 px-4 py-3"
          >
            <div>
              <p className="text-sm" suppressHydrationWarning>
                {formatDate(cycle.start)}
              </p>
              <p className="text-xs text-muted">
                {cycle.score ? strainLabel(cycle.score.strain) : cycle.score_state}
              </p>
            </div>
            <p className="font-display text-2xl text-ember">
              {cycle.score ? cycle.score.strain.toFixed(1) : "—"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
