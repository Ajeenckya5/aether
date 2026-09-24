"use client";

import { useEffect, useRef, useState } from "react";
import { appPath } from "@/lib/site";
import { ZONE_COLORS, announceDue, prefersReducedMotion, smoothToward, zoneIndex } from "@/lib/hr-motion";
import { countEvent, currentFlags, loadRemoteFlags } from "@/lib/remote-config";

const RADIUS = 42;
const CIRC = 2 * Math.PI * RADIUS;
const TAU_MS = 280;

export function LiveHrDial({ bpm, maxHr }: { bpm: number | null; maxHr: number }) {
  const ringRef = useRef<SVGCircleElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const shown = useRef(0);
  const lastAnnounced = useRef(0);
  const lastZone = useRef<number | null>(null);
  const bpmRef = useRef(bpm);
  const [enabled, setEnabled] = useState(true);
  bpmRef.current = bpm;

  useEffect(() => {
    void loadRemoteFlags(appPath("/remote-config.json")).then((flags) => setEnabled(flags.liveHr));
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const paint = (now: number, dt: number) => {
      const target = bpmRef.current;
      if (target == null) {
        if (numberRef.current) numberRef.current.textContent = "—";
        return;
      }
      const reduced = prefersReducedMotion();
      shown.current = reduced ? target : smoothToward(shown.current || target, target, dt, TAU_MS);
      const pct = Math.max(0, Math.min(1, shown.current / Math.max(maxHr, 1)));
      if (ringRef.current) ringRef.current.style.strokeDashoffset = String(CIRC * (1 - pct));
      if (markerRef.current) markerRef.current.style.left = `${pct * 100}%`;
      if (numberRef.current) numberRef.current.textContent = String(Math.round(shown.current));
      const zone = zoneIndex(target, maxHr);
      if (lastZone.current != null && zone !== lastZone.current) {
        const coarse = window.matchMedia("(pointer: coarse)").matches;
        if (!reduced && currentFlags().haptics && coarse && navigator.vibrate) navigator.vibrate(12);
        countEvent("zone");
      }
      lastZone.current = zone;
      if (liveRef.current && (lastAnnounced.current === 0 || announceDue(now, lastAnnounced.current))) {
        lastAnnounced.current = now;
        liveRef.current.textContent = `${Math.round(target)} beats per minute, zone ${zone}`;
      }
    };

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const loop = (now: number) => {
      paint(now, now - last);
      last = now;
      if (!motion.matches) frame = window.requestAnimationFrame(loop);
    };
    if (motion.matches) paint(performance.now(), 0);
    else frame = window.requestAnimationFrame(loop);
    const tick = window.setInterval(() => {
      if (motion.matches) paint(performance.now(), 0);
    }, 250);
    const onChange = () => {
      window.cancelAnimationFrame(frame);
      last = performance.now();
      if (motion.matches) paint(performance.now(), 0);
      else frame = window.requestAnimationFrame(loop);
    };
    motion.addEventListener("change", onChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(tick);
      motion.removeEventListener("change", onChange);
    };
  }, [maxHr]);

  if (!enabled) return null;

  return (
    <div className="aether-hr">
      <svg viewBox="0 0 100 100" className="mx-auto h-36 w-36" aria-hidden="true">
        <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          ref={ringRef}
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke="var(--lime)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <p className="-mt-24 mb-16 text-center" aria-hidden="true">
        <span ref={numberRef} className="font-display text-4xl text-paper">
          —
        </span>
        <span className="ml-1 text-sm text-muted">bpm</span>
      </p>
      <div className="relative h-2.5 rounded-full bg-white/5" aria-hidden="true">
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          {ZONE_COLORS.map((color) => (
            <span key={color} className="h-full flex-1" style={{ background: color }} />
          ))}
        </div>
        <div
          ref={markerRef}
          className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper"
          style={{ left: "0%" }}
        />
      </div>
      <p ref={liveRef} className="sr-only" aria-live="polite" />
    </div>
  );
}
