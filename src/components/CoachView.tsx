"use client";

import { useCallback } from "react";
import Link from "next/link";
import { COACH_SESSIONS } from "@/lib/coach";
import {
  deleteCustomWorkout,
  loadCustomWorkouts,
  workoutDurationSec,
} from "@/lib/sessions";
import { ExerciseLibrary } from "./ExerciseLibrary";
import { LiveHeartRateButton } from "./LiveHeartRate";
import { useLab } from "./useLab";
import { useLocalReload } from "./useLocalReload";

export function CoachView() {
  const featured = COACH_SESSIONS[1];
  const { report } = useLab();
  const intent = report?.call ?? "build";
  const mine = useLocalReload(loadCustomWorkouts, []);
  const remove = useCallback((id: string) => {
    deleteCustomWorkout(id);
  }, []);

  return (
    <div className="px-5 pt-6 lg:px-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-lime">
            Original library
          </p>
          <h1 className="font-display mt-2 text-4xl">Coach</h1>
        </div>
        <LiveHeartRateButton />
      </div>
      <p className="mt-2 text-sm text-muted">
        Guided sessions, live tracking, and workouts you build. Play them here;
        the WHOOP band still records in the official app.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          href="/coach/live"
          className="rounded-[24px] bg-ember/20 px-4 py-4"
        >
          <p className="text-[11px] uppercase tracking-widest text-ember">Live</p>
          <p className="font-display mt-1 text-xl">Track now</p>
          <p className="text-xs text-muted">Strap, practice pulse, GPS</p>
        </Link>
        <Link
          href="/coach/build"
          className="rounded-[24px] bg-lime/15 px-4 py-4"
        >
          <p className="text-[11px] uppercase tracking-widest text-lime">Builder</p>
          <p className="font-display mt-1 text-xl">Create</p>
          <p className="text-xs text-muted">Blocks, zones, intervals</p>
        </Link>
      </div>

      <Link
        href={`/coach/${featured.slug}`}
        className="relative mt-6 block overflow-hidden rounded-[32px]"
      >
        <video
          className="h-56 w-full object-cover"
          poster={featured.poster}
          muted
          playsInline
          loop
          autoPlay
        >
          <source src={featured.video} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-black/20 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-[11px] uppercase tracking-widest text-lime">
            Featured · {featured.durationMin} min
          </p>
          <p className="font-display text-3xl">{featured.title}</p>
          <p className="text-sm text-paper/70">{featured.summary}</p>
        </div>
      </Link>

      {mine.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-lg">Your workouts</h2>
          <ul className="mt-3 space-y-2">
            {mine.map((workout) => (
              <li
                key={workout.id}
                className="rounded-[24px] border border-white/8 bg-panel px-4 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted">
                      {workout.level} · {Math.max(1, Math.round(workoutDurationSec(workout) / 60))} min
                    </p>
                    <p className="font-display text-lg">{workout.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(workout.id)}
                    className="text-[11px] text-muted"
                  >
                    Delete
                  </button>
                </div>
                <div className="mt-2 flex gap-2 text-xs">
                  <Link href={`/coach/custom/${workout.id}`} className="rounded-full bg-white/8 px-3 py-1.5">
                    Play
                  </Link>
                  <Link
                    href={`/coach/live?kind=custom&id=${workout.id}`}
                    className="rounded-full bg-ember/80 px-3 py-1.5"
                  >
                    Live
                  </Link>
                  <Link href={`/coach/build?id=${workout.id}`} className="rounded-full bg-white/8 px-3 py-1.5">
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="font-display mt-6 text-lg">Library</h2>
      <div className="mt-3 space-y-3 pb-4">
        {COACH_SESSIONS.map((session) => (
          <Link
            key={session.slug}
            href={`/coach/${session.slug}`}
            className="flex gap-3 overflow-hidden rounded-[24px] border border-white/8 bg-panel"
          >
            <div className="relative h-24 w-24 shrink-0" style={{ background: "#1a1914" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={session.poster}
                alt=""
                className="h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.opacity = "0";
                }}
              />
            </div>
            <div className="flex flex-1 flex-col justify-center py-3 pr-3">
              <p className="text-[10px] uppercase tracking-widest text-muted">
                {session.kicker} · {session.level}
              </p>
              <p className="font-display text-lg leading-tight">{session.title}</p>
              <p className="text-xs text-muted">{session.durationMin} min</p>
            </div>
          </Link>
        ))}
      </div>

      <ExerciseLibrary intent={intent} />
    </div>
  );
}
