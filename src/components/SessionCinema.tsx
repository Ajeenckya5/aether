"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { buildHrCurve, workoutDurationMs } from "@/lib/hr-curve";
import { formatMillis, kcalFromKj } from "@/lib/format";
import { mediaForSport } from "@/lib/media";
import { sportLabel } from "@/lib/sports";
import type { Workout } from "@/lib/types";
import { ZoneBar } from "./ZoneBar";
import { SportArt } from "./SportArt";

export function SessionCinema({ workout }: { workout: Workout }) {
  const media = mediaForSport(workout.sport_name);
  const curve = useMemo(() => buildHrCurve(workout), [workout]);
  const duration = workoutDurationMs(workout);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let prev = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = now - prev;
      prev = now;
      if (playing) {
        setProgress((p) => (p + dt / duration) % 1);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration]);

  const minBpm = Math.min(...curve.map((p) => p.bpm)) - 8;
  const maxBpm = Math.max(...curve.map((p) => p.bpm)) + 8;
  const sample =
    curve[Math.min(curve.length - 1, Math.floor(progress * (curve.length - 1)))];
  const path = curve
    .map((p, i) => {
      const x = (i / (curve.length - 1)) * 100;
      const y = 100 - ((p.bpm - minBpm) / (maxBpm - minBpm)) * 100;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const cy = sample
    ? 100 - ((sample.bpm - minBpm) / (maxBpm - minBpm)) * 100
    : 50;
  const score = workout.score;

  return (
    <div className="space-y-4">
      <div className="relative h-[420px] overflow-hidden rounded-[28px] bg-fog">
        <div className="absolute inset-0">
          <SportArt sport={workout.sport_name} />
        </div>
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover opacity-55"
          poster={media.poster}
          muted
          playsInline
          loop
          autoPlay
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        >
          <source src={media.video} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-black/25 to-black/20" />
        <div className="absolute left-4 top-4 right-4 flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-lime">
              Session film
            </p>
            <h1 className="font-display mt-1 text-3xl">
              {sportLabel(workout.sport_name, workout.sport_id)}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              const video = videoRef.current;
              setPlaying((p) => {
                const next = !p;
                if (video) {
                  if (next) void video.play();
                  else video.pause();
                }
                return next;
              });
            }}
            className="grid h-11 w-11 place-items-center rounded-full bg-paper text-ink"
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted">
                Heart rate
              </p>
              <p className="font-display text-5xl leading-none">
                {sample?.bpm ?? "--"}
              </p>
            </div>
            <p className="text-sm text-paper/80">
              {formatMillis(progress * duration)} / {formatMillis(duration)}
            </p>
          </div>
          <svg viewBox="0 0 100 100" className="mb-3 h-16 w-full" preserveAspectRatio="none">
            <path
              d={path}
              fill="none"
              stroke="#d6ff4b"
              strokeWidth="1.8"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={progress * 100} cy={cy} r="2.4" fill="#ff5c2a" />
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-lime"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Strain" value={score ? score.strain.toFixed(1) : "—"} />
        <Stat label="Avg HR" value={score ? String(score.average_heart_rate) : "—"} />
        <Stat label="Max HR" value={score ? String(score.max_heart_rate) : "—"} />
        <Stat label="Calories" value={score ? String(kcalFromKj(score.kilojoule)) : "—"} />
        <Stat
          label="Distance"
          value={
            score?.distance_meter
              ? `${(score.distance_meter / 1000).toFixed(2)} km`
              : "—"
          }
        />
        <Stat label="Recorded" value={score ? `${score.percent_recorded}%` : "—"} />
      </div>
      <div className="rounded-[24px] border border-white/8 bg-panel p-4">
        <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted">
          Heart rate zones
        </p>
        <ZoneBar zones={score?.zone_durations} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-panel px-3 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 font-display text-xl">{value}</p>
    </div>
  );
}
