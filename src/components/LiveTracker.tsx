"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Pause, Play, Square } from "lucide-react";
import { resolvedMaxHr } from "@/lib/athlete";
import { COACH_SESSIONS } from "@/lib/coach";
import {
  ZONE_COLORS,
  appendSample,
  currentBlockIndex,
  formatClock,
  scoreLiveLog,
  sealSamples,
  wallElapsedMs,
  zoneDurationsFromMs,
  zoneFromHr,
} from "@/lib/live-math";
import { idleClock, pauseClock, resumeClock, startClock, type SessionClock } from "@/lib/session-clock";
import {
  asCoachSession,
  clearLiveDraft,
  getCustomWorkout,
  loadLiveDraft,
  saveLiveDraft,
  saveLiveLog,
  uid,
  type CustomWorkout,
  type LiveLog,
  type LiveSample,
} from "@/lib/sessions";
import { DeviceStrip, useDevice } from "./DeviceChrome";
import { useLab } from "./useLab";
import { useLiveHeartRate } from "./LiveHeartRate";
import { ZoneBar } from "./ZoneBar";
import { preferPhoneShell } from "@/lib/device";

type Plan = {
  id: string;
  title: string;
  sport: string;
  blocks: { title: string; seconds: number; cue: string; targetZone: number | null }[];
};

function fromCoach(slug: string): Plan | null {
  const session = COACH_SESSIONS.find((s) => s.slug === slug);
  if (!session) return null;
  return {
    id: session.slug,
    title: session.title,
    sport: session.sport,
    blocks: session.blocks.map((b) => ({
      title: b.title,
      seconds: b.seconds,
      cue: b.cue,
      targetZone: null,
    })),
  };
}

function resolvePlan(kind: string | null, id: string | null, token: string | null): Plan | null {
  if (kind === "custom" && id) {
    const workout = getCustomWorkout(id);
    return workout ? fromCustom(workout) : null;
  }
  if (kind === "coach" && id) return fromCoach(id);
  if (!token) return null;
  if (token.startsWith("custom:")) {
    const workout = getCustomWorkout(token.slice(7));
    return workout ? fromCustom(workout) : null;
  }
  if (token.startsWith("coach:")) return fromCoach(token.slice(6));
  return fromCoach(token);
}

function fromCustom(workout: CustomWorkout): Plan {
  const session = asCoachSession(workout);
  return {
    id: workout.id,
    title: workout.title,
    sport: workout.sport,
    blocks: workout.blocks.map((b, i) => ({
      title: b.title,
      seconds: b.seconds,
      cue: session.blocks[i]?.cue ?? b.cue,
      targetZone: b.targetZone,
    })),
  };
}

type WakeLockSentinel = { release: () => Promise<void> };

export function LiveTracker() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, athlete } = useLab();
  const hr = useLiveHeartRate();
  const phoneApp = preferPhoneShell(useDevice());
  const kind = params.get("kind");
  const planId = params.get("id");
  const token = params.get("plan");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [sport, setSport] = useState("running");
  const [title, setTitle] = useState("Live session");
  const [gpsOn, setGpsOn] = useState(false);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [samples, setSamples] = useState<LiveSample[]>([]);
  const [fix, setFix] = useState<{ lat: number; lon: number } | null>(null);
  const [log, setLog] = useState<LiveLog | null>(null);
  const clockRef = useRef<SessionClock>(idleClock());
  const geoRef = useRef<number | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const bpmRef = useRef<number | null>(null);
  const fixRef = useRef<{ lat: number; lon: number } | null>(null);
  const samplesRef = useRef<LiveSample[]>([]);
  const runningRef = useRef(false);
  const restoredRef = useRef(false);
  const sourceRef = useRef<"strap" | "practice" | "none">("none");
  if (hr.status === "live") sourceRef.current = "strap";
  if (hr.status === "practice") sourceRef.current = "practice";

  bpmRef.current = hr.bpm;
  fixRef.current = fix;
  samplesRef.current = samples;
  runningRef.current = running;

  const maxHr = resolvedMaxHr(athlete, data.body.max_heart_rate);
  const restHr = data.recoveries[0]?.score?.resting_heart_rate ?? 60;

  const capture = useCallback((forceSample = false) => {
    const clock = clockRef.current;
    if (clock.origin == null) return 0;
    const elapsed = wallElapsedMs(Date.now(), clock.origin, clock.pauseAcc, clock.pauseAt);
    setElapsedMs(elapsed);
    if (runningRef.current) {
      setSamples((prev) => {
        const next = appendSample(
          prev,
          elapsed,
          bpmRef.current,
          fixRef.current?.lat ?? null,
          fixRef.current?.lon ?? null,
          forceSample ? 0 : undefined,
        );
        samplesRef.current = next;
        return next;
      });
    }
    return elapsed;
  }, []);

  useEffect(() => {
    setPlan(resolvePlan(kind, planId, token));
  }, [kind, planId, token]);

  useEffect(() => {
    if (!plan) return;
    setTitle(plan.title);
    setSport(plan.sport);
  }, [plan]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const draft = loadLiveDraft();
    if (!draft) return;
    const samePlan =
      (draft.kind ?? null) === (kind ?? null) &&
      (draft.planId ?? null) === (planId ?? null) &&
      (draft.token ?? null) === (token ?? null);
    if (!samePlan) return;
    clockRef.current = {
      origin: draft.origin,
      pauseAcc: draft.pauseAcc,
      pauseAt: draft.running ? null : (draft.pauseAt ?? Date.now()),
    };
    setTitle(draft.title);
    setSport(draft.sport);
    setGpsOn(draft.gpsOn);
    setSamples(draft.samples);
    samplesRef.current = draft.samples;
    setRunning(draft.running);
    runningRef.current = draft.running;
    setElapsedMs(
      wallElapsedMs(Date.now(), draft.origin, draft.pauseAcc, draft.running ? null : draft.pauseAt),
    );
    if (draft.source) sourceRef.current = draft.source;
  }, [kind, planId, token]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const loop = () => {
      capture();
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    const onVis = () => {
      if (document.visibilityState === "visible") capture(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [capture, running]);

  useEffect(() => {
    if (clockRef.current.origin == null) {
      clearLiveDraft();
      return;
    }
    saveLiveDraft({
      origin: clockRef.current.origin,
      pauseAcc: clockRef.current.pauseAcc,
      pauseAt: clockRef.current.pauseAt,
      running,
      title,
      sport,
      kind,
      planId,
      token,
      samples,
      gpsOn,
      source: sourceRef.current,
      savedAt: Date.now(),
    });
  }, [gpsOn, kind, planId, running, samples, sport, title, token]);

  useEffect(() => {
    if (!running) {
      void wakeRef.current?.release();
      wakeRef.current = null;
      return;
    }
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    };
    const grab = async () => {
      try {
        wakeRef.current = (await nav.wakeLock?.request("screen")) ?? null;
      } catch {
        wakeRef.current = null;
      }
    };
    void grab();
    const onVis = () => {
      if (document.visibilityState === "visible") void grab();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void wakeRef.current?.release();
      wakeRef.current = null;
    };
  }, [running]);

  useEffect(() => {
    if (!gpsOn) {
      if (geoRef.current != null) navigator.geolocation.clearWatch(geoRef.current);
      geoRef.current = null;
      return;
    }
    if (!navigator.geolocation) {
      setGpsNote("This browser has no geolocation.");
      return;
    }
    setGpsNote(null);
    geoRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setFix({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGpsNote(null);
      },
      (err) => setGpsNote(err.message || "GPS unavailable"),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => {
      if (geoRef.current != null) navigator.geolocation.clearWatch(geoRef.current);
    };
  }, [gpsOn]);

  const start = useCallback(() => {
    clockRef.current = startClock(Date.now());
    const first: LiveSample = {
      t: 0,
      bpm: bpmRef.current,
      lat: fixRef.current?.lat ?? null,
      lon: fixRef.current?.lon ?? null,
    };
    setSamples([first]);
    samplesRef.current = [first];
    setElapsedMs(0);
    setLog(null);
    setRunning(true);
    runningRef.current = true;
  }, []);

  const pause = useCallback(() => {
    clockRef.current = pauseClock(clockRef.current, Date.now());
    capture();
    setRunning(false);
    runningRef.current = false;
  }, [capture]);

  const resume = useCallback(() => {
    clockRef.current = resumeClock(clockRef.current, Date.now());
    setRunning(true);
    runningRef.current = true;
  }, []);

  const finish = useCallback(() => {
    const clock = clockRef.current;
    const duration = wallElapsedMs(
      Date.now(),
      clock.origin,
      clock.pauseAcc,
      runningRef.current ? null : clock.pauseAt,
    );
    setRunning(false);
    runningRef.current = false;
    const sealed = sealSamples(
      samplesRef.current,
      duration,
      bpmRef.current,
      fixRef.current?.lat ?? null,
      fixRef.current?.lon ?? null,
    );
    const scored = scoreLiveLog(sealed, duration, maxHr, gpsOn);
    const source =
      sourceRef.current !== "none"
        ? sourceRef.current
        : sealed.some((s) => s.bpm != null)
          ? "practice"
          : "none";
    const next: LiveLog = {
      id: uid("lv"),
      title,
      sport,
      planId: plan?.id ?? null,
      source,
      start: new Date(Date.now() - duration).toISOString(),
      end: new Date().toISOString(),
      durationMs: duration,
      samples: sealed,
      gps: gpsOn,
      ...scored,
    };
    saveLiveLog(next);
    clearLiveDraft();
    clockRef.current = idleClock();
    setLog(next);
  }, [gpsOn, maxHr, plan?.id, sport, title]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        if (elapsedMs === 0 && !running && clockRef.current.origin == null) start();
        else if (running) pause();
        else resume();
      }
      if (event.key === "Escape" && elapsedMs >= 1000) finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [elapsedMs, finish, pause, resume, running, start]);

  const elapsedSec = elapsedMs / 1000;
  const blockSeconds = plan?.blocks.map((b) => b.seconds) ?? [];
  const planTotalSec = blockSeconds.reduce((sum, s) => sum + s, 0);
  const planDone = Boolean(plan && elapsedSec >= planTotalSec && planTotalSec > 0);
  const blockIndex = plan ? currentBlockIndex(elapsedSec, blockSeconds) : 0;
  const block = plan?.blocks[blockIndex];
  const zone = hr.bpm != null ? zoneFromHr(hr.bpm, maxHr) : null;
  const spark = samples.filter((s) => s.bpm != null).slice(-80);
  const scoredPreview = useMemo(
    () => scoreLiveLog(samples, elapsedMs, maxHr, gpsOn),
    [samples, elapsedMs, maxHr, gpsOn],
  );

  if (log) {
    return (
      <div className="px-5 pt-14 pb-10">
        <p className="text-[11px] uppercase tracking-[0.18em] text-lime">Saved locally</p>
        <h1 className="font-display mt-2 text-4xl">{log.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {formatClock(log.durationMs)} · {log.source === "strap" ? "HR strap" : log.source === "practice" ? "Practice pulse" : "No HR"}
          {log.distanceM != null ? ` · ${(log.distanceM / 1000).toFixed(2)} km` : ""}
        </p>
        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          <Stat label="Avg HR" value={log.avgHr ? `${Math.round(log.avgHr)}` : "—"} />
          <Stat label="Max HR" value={log.maxHr ? `${Math.round(log.maxHr)}` : "—"} />
          <Stat label="TRIMP" value={`${Math.round(log.edwardsTrimp)}`} />
        </div>
        <div className="mt-4">
          <ZoneBar zones={zoneDurationsFromMs(log.zoneMs)} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Strain proxy {log.strainProxy.toFixed(1)} (Edwards 1993 TRIMP / 10). Zones from %HRmax.
          WHOOP still scores the band in their app.
        </p>
        <div className="mt-6 grid gap-2">
          <Link href="/workouts" className="rounded-full bg-lime py-3 text-center text-sm text-ink">
            See in Workouts
          </Link>
          <button
            type="button"
            onClick={() => router.push("/coach/live")}
            className="rounded-full border border-white/15 py-3 text-sm"
          >
            Track another
          </button>
        </div>
      </div>
    );
  }

  const idle = elapsedMs === 0 && !running && clockRef.current.origin == null;

  return (
    <div className="px-5 pt-14 pb-10 lg:px-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-ember">Live</p>
      <h1 className="font-display mt-2 text-4xl">{title}</h1>
      <p className="mt-1 text-sm text-muted">
        {plan ? `${plan.blocks.length} blocks · follow the clock` : "Free ride — no prescribed blocks"}
      </p>

      <div
        className={
          phoneApp
            ? undefined
            : "lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10"
        }
      >
        <div>
      <div className="mt-4 space-y-3">
        {idle && !plan && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/4 px-3 py-2 text-base outline-none"
          />
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void hr.connect()}
            className="min-h-12 rounded-full bg-white/8 px-3 py-2 text-sm"
          >
            {hr.status === "live"
              ? `${hr.bpm ?? "--"} bpm live`
              : hr.status === "connecting"
                ? "Pairing…"
                : "Pair live HR"}
          </button>
          <button
            type="button"
            onClick={() => hr.startPractice()}
            className="min-h-12 rounded-full bg-white/8 px-3 py-2 text-sm"
          >
            {hr.status === "practice" ? `${hr.bpm ?? "--"} practice` : "Practice pulse"}
          </button>
        </div>
        <label htmlFor="gps-toggle" className="flex min-h-11 items-center gap-2 text-sm text-muted">
          <input
            id="gps-toggle"
            type="checkbox"
            checked={gpsOn}
            onChange={(e) => setGpsOn(e.target.checked)}
          />
          GPS distance
        </label>
        <DeviceStrip gps />
        {hr.message && <p className="text-xs text-muted">{hr.message}</p>}
        {gpsNote && <p className="text-xs text-ember">{gpsNote}</p>}
      </div>

      <p className="font-display mt-8 text-center text-6xl leading-none tracking-tight sm:text-7xl lg:text-8xl">
        {formatClock(elapsedMs)}
      </p>
      <p className="mt-3 text-center">
        <span className="font-display text-5xl" style={{ color: zone != null ? ZONE_COLORS[zone] : "#f4efe6" }}>
          {hr.bpm ?? "—"}
        </span>
        <span className="ml-2 text-sm text-muted">bpm</span>
      </p>
      <p className="mt-1 text-center text-xs uppercase tracking-widest text-muted">
        {zone != null ? `Zone ${zone}` : "No HR yet"} · HRmax {Math.round(maxHr)} · rest {restHr}
        {block?.targetZone != null ? ` · target Z${block.targetZone}` : ""}
      </p>

      {spark.length > 1 && (
        <svg viewBox="0 0 100 28" className="mt-4 h-16 w-full text-lime">
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            points={spark
              .map((s, i) => {
                const x = (i / (spark.length - 1)) * 100;
                const y = 26 - ((s.bpm! - 80) / 120) * 24;
                return `${x},${Math.max(2, Math.min(26, y))}`;
              })
              .join(" ")}
          />
        </svg>
      )}
        </div>

        <div className="lg:sticky lg:top-6">
      {block && (
        <div className="mt-4 rounded-3xl border border-white/8 bg-panel p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted">
            {planDone
              ? "Plan complete"
              : `Block ${blockIndex + 1} / ${plan?.blocks.length}`}
          </p>
          <p className="font-display mt-1 text-2xl">
            {planDone ? "Cool down or save" : block.title}
          </p>
          <p className="text-sm text-muted">
            {planDone ? "Square to keep this recording on this device." : block.cue}
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-muted">
        <div>
          <p className="font-display text-lg text-paper">{Math.round(scoredPreview.edwardsTrimp)}</p>
          TRIMP
        </div>
        <div>
          <p className="font-display text-lg text-paper">
            {scoredPreview.distanceM != null ? `${(scoredPreview.distanceM / 1000).toFixed(2)}` : gpsOn ? "0.00" : "—"}
          </p>
          km
        </div>
        <div>
          <p className="font-display text-lg text-paper">{samples.length}</p>
          samples
        </div>
      </div>

      <div className="mt-8 flex items-center justify-center gap-3">
        {idle ? (
          <button
            type="button"
            onClick={start}
            className="grid h-16 w-16 place-items-center rounded-full bg-ember text-paper"
          >
            <Play size={22} />
          </button>
        ) : running ? (
          <button
            type="button"
            onClick={pause}
            className="grid h-16 w-16 place-items-center rounded-full bg-lime text-ink"
          >
            <Pause size={22} />
          </button>
        ) : (
          <button
            type="button"
            onClick={resume}
            className="grid h-16 w-16 place-items-center rounded-full bg-lime text-ink"
          >
            <Play size={22} />
          </button>
        )}
        <button
          type="button"
          onClick={finish}
          disabled={elapsedMs < 1000}
          className="grid h-16 w-16 place-items-center rounded-full bg-white/10 disabled:opacity-30"
        >
          <Square size={18} />
        </button>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">
        Clock follows wall time on phone and laptop. Square to save.
        <span className="hidden lg:inline"> Space plays or pauses · Esc saves.</span>
      </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 px-2 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className="font-display mt-1 text-2xl">{value}</p>
    </div>
  );
}
