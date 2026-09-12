"use client";

import { formatDate, formatTime } from "@/lib/format";
import { useDashboard } from "./DataProvider";
import { SessionCinema } from "./SessionCinema";

export function WorkoutDetailView({ id }: { id: string }) {
  const { data, loading } = useDashboard();
  const workout = data.workouts.find((item) => item.id === id);

  if (loading && !workout) {
    return <p className="px-5 pt-16 text-sm text-muted">Loading session…</p>;
  }
  if (!workout) {
    return <p className="px-5 pt-16 text-sm text-muted">Session not found.</p>;
  }

  return (
    <div className="px-5 pb-8 pt-16">
      <p className="mb-4 text-sm text-muted">
        {formatDate(workout.start)} · {formatTime(workout.start)} – {formatTime(workout.end)}
      </p>
      <SessionCinema workout={workout} />
    </div>
  );
}
