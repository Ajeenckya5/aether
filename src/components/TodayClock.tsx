"use client";

import { useEffect, useState } from "react";
import { timeOfDayGreeting } from "@ajeenckya/engine";
import { greetingName, loadAthlete } from "@/lib/athlete";
import { formatDate, isSameDay, recoveryTone } from "@/lib/format";
import { useNow } from "./useNow";

export function TodayHeading() {
  const clock = useNow();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const next = greetingName(loadAthlete(), null, false);
    setName(next === "there" ? null : next);
  }, []);

  return (
    <>
      <h1 className="font-display mt-2 text-[34px] leading-none tracking-tight">
        {clock ? timeOfDayGreeting(clock.getHours()) : "Today"}
        {name ? (
          <>
            <br />
            {name}.
          </>
        ) : null}
      </h1>
      <p className="mt-2 text-sm text-muted">{clock ? formatDate(clock.toISOString()) : ""}</p>
    </>
  );
}

function recoveryTextClass(score: number | null) {
  if (score == null) return "text-muted";
  const tone = recoveryTone(score);
  if (tone === "high") return "text-lime";
  if (tone === "ok") return "text-gold";
  return "text-ember";
}

export function WeekStripLive({
  recoveries,
}: {
  recoveries: { createdAt: string; score: number | null }[];
}) {
  const now = useNow();
  if (!now) {
    return (
      <div className="flex gap-2" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-16 flex-1 rounded-2xl bg-white/4" />
        ))}
      </div>
    );
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - i));
    const rec = recoveries.find((item) => isSameDay(item.createdAt, date));
    return {
      date,
      score: rec?.score ?? null,
      label: date.toLocaleDateString("en-US", { weekday: "narrow" }),
    };
  });

  return (
    <div className="flex gap-2">
      {days.map((day) => (
        <div
          key={day.date.toISOString()}
          className="flex flex-1 flex-col items-center gap-2 rounded-2xl bg-white/4 py-2"
        >
          <span className="text-[10px] uppercase text-muted">{day.label}</span>
          <span className={`font-display text-sm ${recoveryTextClass(day.score)}`}>
            {day.score ?? "–"}
          </span>
        </div>
      ))}
    </div>
  );
}
