"use client";

import { useMemo, useState } from "react";
import { sportLabel } from "@/lib/sports";
import { loadLiveLogs } from "@/lib/sessions";
import { useDashboard } from "./DataProvider";
import { LiveLogCard } from "./LiveLogCard";
import { SourceBanner } from "./SourceBanner";
import { WorkoutCard } from "./WorkoutCard";
import { useLocalReload } from "./useLocalReload";

export function WorkoutsView() {
  const { data } = useDashboard();
  const local = useLocalReload(loadLiveLogs, []);
  const sports = useMemo(() => {
    const unique = Array.from(new Set(data.workouts.map((w) => w.sport_name)));
    return unique;
  }, [data.workouts]);
  const [filter, setFilter] = useState("all");
  const list =
    filter === "all"
      ? data.workouts
      : data.workouts.filter((w) => w.sport_name === filter);

  return (
    <div className="px-5 pt-6 lg:px-2">
      <SourceBanner />
      <h1 className="font-display mt-2 text-4xl">Workouts</h1>
      <p className="mt-2 text-sm text-muted">
        Band-scored sessions when a WHOOP account is connected, plus anything
        you tracked live in Aether. On this public app the list starts as a sample.
      </p>

      {local.length > 0 && (
        <div className="mt-5 space-y-3">
          {local.slice(0, 8).map((log) => (
            <LiveLogCard key={log.id} log={log} />
          ))}
        </div>
      )}

      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </Chip>
        {sports.map((sport) => (
          <Chip
            key={sport}
            active={filter === sport}
            onClick={() => setFilter(sport)}
          >
            {sportLabel(sport)}
          </Chip>
        ))}
      </div>

      <div className="mt-4 space-y-3 pb-4">
        {list.map((workout) => (
          <WorkoutCard key={workout.id} workout={workout} />
        ))}
      </div>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${
        active ? "bg-lime text-ink" : "bg-white/6 text-paper"
      }`}
    >
      {children}
    </button>
  );
}
