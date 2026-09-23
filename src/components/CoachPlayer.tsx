"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipForward } from "lucide-react";
import { mediaForSport } from "@/lib/media";
import type { CoachSession } from "@/lib/coach";
import { currentBlockIndex, formatClock, wallElapsedMs } from "@/lib/live-math";
import { idleClock, pauseClock, resumeClock, skipClockTo, startClock } from "@/lib/session-clock";
import { LiveHeartRateButton } from "./LiveHeartRate";
import Link from "next/link";

export function CoachPlayer({
  session,
  liveHref,
}: {
  session: CoachSession;
  liveHref?: string;
}) {
  const blocks = session.blocks;
  const clockRef = useRef(idleClock());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const total = useMemo(
    () => blocks.reduce((sum, b) => sum + b.seconds, 0),
    [blocks],
  );
  const blockSeconds = useMemo(() => blocks.map((b) => b.seconds), [blocks]);
  const elapsedSec = elapsedMs / 1000;
  const index = currentBlockIndex(elapsedSec, blockSeconds);
  const elapsed = Math.min(elapsedSec, total);
  const blockEnd = blockSeconds.slice(0, index + 1).reduce((sum, s) => sum + s, 0);
  const remaining = Math.max(0, Math.ceil(blockEnd - elapsedSec));
  const done = elapsedSec >= total && total > 0;
  const block = blocks[index];

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const loop = () => {
      const clock = clockRef.current;
      const next = wallElapsedMs(Date.now(), clock.origin, clock.pauseAcc, clock.pauseAt);
      setElapsedMs(next);
      if (total > 0 && next / 1000 >= total) {
        clockRef.current = pauseClock(clock, Date.now());
        setPlaying(false);
        setElapsedMs(total * 1000);
        return;
      }
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const clock = clockRef.current;
      setElapsedMs(wallElapsedMs(Date.now(), clock.origin, clock.pauseAcc, clock.pauseAt));
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [playing, total]);

  function toggle() {
    if (done) {
      clockRef.current = startClock(Date.now());
      setElapsedMs(0);
      setPlaying(true);
      return;
    }
    if (!playing) {
      clockRef.current =
        clockRef.current.origin == null
          ? startClock(Date.now())
          : resumeClock(clockRef.current, Date.now());
      setPlaying(true);
      return;
    }
    clockRef.current = pauseClock(clockRef.current, Date.now());
    setPlaying(false);
  }

  function skip() {
    if (index >= blocks.length - 1) return;
    const jumpMs = blockSeconds.slice(0, index + 1).reduce((sum, s) => sum + s, 0) * 1000;
    clockRef.current = skipClockTo(clockRef.current.origin == null ? startClock(Date.now()) : clockRef.current, Date.now(), jumpMs);
    setElapsedMs(jumpMs);
  }

  const art = mediaForSport(session.sport);
  const mmss = formatClock(remaining * 1000);

  return (
    <div className="relative min-h-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={art.poster}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-black/35" />
      <div className="relative flex min-h-[720px] flex-col justify-end px-5 pb-10 pt-6">
        <div className="mb-auto flex items-center justify-between pl-12">
          <p className="text-[11px] uppercase tracking-[0.2em] text-lime">
            {session.kicker}
          </p>
          <LiveHeartRateButton />
        </div>
        {liveHref && (
          <Link
            href={liveHref}
            className="mb-4 inline-flex self-start rounded-full bg-ember/90 px-3 py-1.5 text-xs"
          >
            Track live instead
          </Link>
        )}
        <h1 className="font-display text-4xl">{session.title}</h1>
        <p className="mt-2 text-sm text-paper/75">{done ? "Session complete" : block?.title}</p>
        <p className="font-display mt-4 text-7xl leading-none tracking-tight">
          {mmss.replace(":", " : ")}
        </p>
        <p className="mt-3 max-w-[20rem] text-sm text-paper/80">
          {done ? "Play again, or track it live with a strap." : block?.cue}
        </p>
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full bg-lime"
            style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }}
          />
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause session" : "Play session"}
            className="grid h-14 w-14 place-items-center rounded-full bg-lime text-ink"
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            type="button"
            onClick={skip}
            aria-label="Skip to the next block"
            className="grid h-14 w-14 place-items-center rounded-full bg-white/10"
          >
            <SkipForward size={18} />
          </button>
          <p className="text-xs text-muted">
            Block {index + 1} of {blocks.length}
          </p>
        </div>
      </div>
    </div>
  );
}
