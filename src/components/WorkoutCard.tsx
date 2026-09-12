"use client";

import Link from "next/link";
import { formatDuration, formatTime } from "@/lib/format";
import { mediaForSport } from "@/lib/media";
import { sportLabel } from "@/lib/sports";
import type { Workout } from "@/lib/types";
import { ZoneBar } from "./ZoneBar";
import { SportArt } from "./SportArt";

export function WorkoutCard({ workout }: { workout: Workout }) {
  const media = mediaForSport(workout.sport_name);
  const strain = workout.score?.strain ?? 0;

  return (
    <Link
      href={`/workouts/${workout.id}`}
      className="block overflow-hidden rounded-[28px] border border-white/8 bg-panel"
    >
      <div className="relative h-36 overflow-hidden" style={{ background: media.tint }}>
        <SportArt sport={workout.sport_name} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.poster}
          alt=""
          className="relative h-full w-full object-cover opacity-50"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" />
        <div className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 text-[11px] uppercase tracking-widest text-paper backdrop-blur">
          Replay
        </div>
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div>
            <p className="font-display text-xl leading-none">
              {sportLabel(workout.sport_name, workout.sport_id)}
            </p>
            <p className="mt-1 text-xs text-paper/70">
              {formatTime(workout.start)} · {formatDuration(workout.start, workout.end)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl leading-none text-ember">
              {strain.toFixed(1)}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-muted">
              Strain
            </p>
          </div>
        </div>
      </div>
      <div className="px-4 py-3">
        <ZoneBar zones={workout.score?.zone_durations} compact />
      </div>
    </Link>
  );
}
