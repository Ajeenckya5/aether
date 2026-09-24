"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { outdoorRank, type OutdoorLevel } from "@/lib/climate";
import { placeDisplayName } from "@/lib/place";
import { solarAlignmentHours } from "@/lib/environment";
import { countEvent } from "@/lib/remote-config";
import { useEnvironment } from "./useEnvironment";

export function EnvironmentCard({
  midsleepHour,
}: {
  midsleepHour?: number | null;
}) {
  const { place, env, stale, loading, error } = useEnvironment();

  if (!place) {
    return (
      <section className="rounded-[28px] border border-dashed border-white/12 px-4 py-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-aqua">Field</p>
        <p className="mt-1 text-sm text-paper">Weather, AQI, UV, and heat for your session.</p>
        <p className="mt-1 text-xs text-muted">
          Open-Meteo is free and needs no key. Set a location to turn it on.
        </p>
        <Link
          href="/settings"
          className="mt-3 inline-block rounded-full bg-white/8 px-4 py-2 text-sm text-lime"
        >
          Set location
        </Link>
      </section>
    );
  }

  if (loading && !env) {
    return (
      <section className="rounded-[28px] border border-white/8 px-4 py-4 text-sm text-muted">
        Reading weather for {placeDisplayName(place)}…
      </section>
    );
  }

  if (error || !env) {
    return (
      <section className="rounded-[28px] border border-white/8 px-4 py-4 text-sm text-muted">
        Could not reach weather/air quality. {error}
      </section>
    );
  }

  const tone =
    env.outdoor.level === "indoor"
      ? "bg-ember/15 text-ember"
      : env.outdoor.level === "caution"
        ? "bg-gold/12 text-gold"
        : "bg-lime/12 text-lime";
  const align = solarAlignmentHours(midsleepHour ?? null, env.sun.solarNoonHour);

  return (
    <section className="rounded-[28px] border border-white/8 bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-aqua">Field</p>
          <p className="font-display mt-1 text-xl leading-tight">{placeDisplayName(place)}</p>
          {stale ? <p className="text-xs text-muted">Saved weather from this phone.</p> : null}
          <p className="text-xs text-muted">
            {env.weather.weatherText}
            {env.elevationM != null ? ` · ${Math.round(env.elevationM)} m` : ""}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs ${tone}`}>{env.outdoor.title}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat
          label="Air"
          value={env.weather.tempC != null ? `${Math.round(env.weather.tempC)}°` : "—"}
          note={
            env.weather.apparentC != null
              ? `feels ${Math.round(env.weather.apparentC)}°`
              : env.weather.humidity != null
                ? `${Math.round(env.weather.humidity)}% rh`
                : ""
          }
        />
        <Stat
          label="AQI"
          value={env.air.usAqi != null ? `${Math.round(env.air.usAqi)}` : "—"}
          note={env.air.usAqiLabel}
        />
        <Stat
          label="UV max"
          value={env.sun.uvMax != null ? env.sun.uvMax.toFixed(0) : "—"}
          note={env.sun.uvLabel}
        />
      </div>

      <ul className="mt-3 space-y-1 text-xs text-muted">
        {env.outdoor.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
        {env.bestWindow && (
          <li>
            Best window around {env.bestWindow.hourLabel}
            {env.bestWindow.tempC != null ? ` · ${Math.round(env.bestWindow.tempC)}°C` : ""}.
            <WindowCountdown iso={env.bestWindow.iso} />
          </li>
        )}
        {env.derived.wbgtC != null && (
          <li>
            WBGT {env.derived.wbgtC.toFixed(1)} °C (BoM sun approx) · heat index{" "}
            {env.derived.heatIndexC != null ? `${env.derived.heatIndexC.toFixed(0)}°C` : "—"}.
          </li>
        )}
        {env.air.pollenLabel && <li>Pollen: {env.air.pollenLabel} (CAMS, Europe-heavy).</li>}
        {env.derived.altitudePenaltyPct > 0 && (
          <li>
            Altitude VO2 penalty ~{env.derived.altitudePenaltyPct.toFixed(0)}% vs sea level.
          </li>
        )}
        {align != null && (
          <li>
            Last-night midsleep is {align.toFixed(1)} h from solar midnight
            {env.sun.sunrise
              ? ` · sunrise ${new Date(env.sun.sunrise).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
              : ""}
            .
          </li>
        )}
      </ul>
      <HeatBanner level={env.outdoor.level} title={env.outdoor.title} />
    </section>
  );
}

function WindowCountdown({ iso }: { iso: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const tick = () => {
      const ms = new Date(iso).getTime() - Date.now();
      if (!Number.isFinite(ms)) return;
      if (ms <= 0) {
        setLabel("Open now.");
        return;
      }
      const total = Math.floor(ms / 1000);
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const seconds = total % 60;
      const clock =
        hours > 0
          ? `${hours}h ${String(minutes).padStart(2, "0")}m`
          : `${minutes}m ${String(seconds).padStart(2, "0")}s`;
      setLabel(`Starts in ${clock}.`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [iso]);
  if (!label) return null;
  return <span className="mt-1 block text-paper/80">{label}</span>;
}

function HeatBanner({ level, title }: { level: OutdoorLevel; title: string }) {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const rank = outdoorRank(level);
    let previous: string | null = null;
    try {
      previous = sessionStorage.getItem("aether-outdoor");
    } catch {
      previous = null;
    }
    try {
      sessionStorage.setItem("aether-outdoor", level);
    } catch {
      /* private mode */
    }
    if (previous !== "go" && previous !== "caution" && previous !== "indoor") return;
    if (rank <= outdoorRank(previous)) return;
    setMessage(`Heat risk is up — ${title}`);
    countEvent("banner");
  }, [level, title]);
  if (!message) return null;
  return (
    <p className="aether-banner mt-3 rounded-2xl bg-ember/10 px-3 py-2 text-sm text-paper" role="status">
      {message}
    </p>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-white/8 px-2 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className="font-display mt-1 text-2xl">{value}</p>
      <p className="text-[10px] text-muted">{note}</p>
    </div>
  );
}
