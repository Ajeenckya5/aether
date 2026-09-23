"use client";

import Link from "next/link";
import { solarAlignmentHours } from "@/lib/environment";
import { useEnvironment } from "./useEnvironment";

export function EnvironmentCard({
  midsleepHour,
}: {
  midsleepHour?: number | null;
}) {
  const { place, env, loading, error } = useEnvironment();

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
        Reading Open-Meteo for {place.name}…
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
          <p className="font-display mt-1 text-xl leading-tight">{place.name}</p>
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
    </section>
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
