"use client";

import Link from "next/link";
import { ChevronRight, Download, Settings } from "lucide-react";
import { timeOfDayGreeting } from "@ajeenckya/engine";
import { formatDate, formatHours, isSameDay, kcalFromKj, recoveryTone } from "@/lib/format";
import type { Recovery } from "@/lib/types";
import { AgeCard } from "./AgeCard";
import { ArcMeter } from "./ArcMeter";
import { CallCard } from "./CallCard";
import { EnvironmentCard } from "./EnvironmentCard";
import { JournalChips } from "./JournalChips";
import { SleepStages } from "./SleepStages";
import { SourceBanner } from "./SourceBanner";
import { InstallBanner, useDevice } from "./DeviceChrome";
import { BluetoothPanel, useLiveHeartRate } from "./LiveHeartRate";
import { WorkoutCard } from "./WorkoutCard";
import { useEnvironment } from "./useEnvironment";
import { useLab } from "./useLab";
import { useNow } from "./useNow";
import { greetingName, hasPersonalBody } from "@/lib/athlete";
import { appPath } from "@/lib/site";
import { preferPhoneShell } from "@/lib/device";
import { isAetherOvernightSleep, scoredSleepMs } from "@/lib/overnight";
import { isRestWakeStages } from "./SleepStages";

function recoveryColor(score: number) {
  const tone = recoveryTone(score);
  if (tone === "high") return "var(--lime)";
  if (tone === "ok") return "var(--gold)";
  return "var(--ember)";
}

function recoveryTextClass(score: number | null) {
  if (score == null) return "text-muted";
  const tone = recoveryTone(score);
  if (tone === "high") return "text-lime";
  if (tone === "ok") return "text-gold";
  return "text-ember";
}

export function TodayView() {
  const { data, report, journal, updateJournal, athlete, bioAge } = useLab();
  const hr = useLiveHeartRate();
  const fromBand = hr.fromBand;
  const { env } = useEnvironment();
  const device = useDevice();
  const phoneApp = preferPhoneShell(device);
  const recovery = data.recoveries[0];
  const cycle = data.cycles[0];
  const sleep = data.sleeps[0];
  const overnightSleep = isAetherOvernightSleep(sleep?.id);
  const restWake = sleep?.score ? isRestWakeStages(sleep.score.stage_summary) : false;
  const todayWorkouts = data.workouts.filter((w) => isSameDay(w.start));
  const score = report?.aether ?? recovery?.score?.recovery_score ?? 0;
  const sleepPct = sleep?.score?.sleep_performance_percentage ?? 0;
  const name = greetingName(athlete, data.profile.first_name, data.connected);
  const personal = name === "there" ? null : name;
  const clock = useNow();
  const mid = sleep
    ? new Date(
        (new Date(sleep.start).getTime() + new Date(sleep.end).getTime()) / 2,
      )
    : null;
  const midsleepHour = mid
    ? mid.getHours() + mid.getMinutes() / 60
    : null;
  const outdoorNotes =
    env && env.outdoor.level !== "go" ? env.outdoor.notes : undefined;

  return (
    <div className="px-5 pt-6 lg:px-2">
      {!hasPersonalBody(athlete) && (
        <Link
          href="/settings"
          className="mb-4 block rounded-[24px] border border-lime/25 bg-lime/8 px-4 py-3"
        >
          <p className="font-display text-lg text-paper">Add your details</p>
          <p className="mt-1 text-xs text-muted">
            Height, weight, age, and name stay on this phone. Lab then uses your
            body, not a stand-in — including biological age.
          </p>
        </Link>
      )}
      <header className="mb-6 flex items-start justify-between">
        <div>
          <SourceBanner />
          <h1 className="font-display mt-2 text-[34px] leading-none tracking-tight">
            {clock ? timeOfDayGreeting(clock.getHours()) : "Today"}
            {personal ? (
              <>
                <br />
                {personal}.
              </>
            ) : null}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {clock ? formatDate(clock.toISOString()) : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/download"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5"
            aria-label="Download Aether"
          >
            <Download size={16} />
          </Link>
          <Link
            href="/settings"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5"
            aria-label="Settings"
          >
            <Settings size={16} />
          </Link>
        </div>
      </header>

      <div className="mb-4">
        <BluetoothPanel compact />
      </div>

      <WeekStrip
        now={clock}
        recoveries={data.recoveries}
        todayScore={hr.overnight?.recovery ?? null}
      />

      <div
        className={
          phoneApp ? undefined : "lg:mt-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8"
        }
      >
      <div>

      {report && (
        <div className="mt-6">
          <CallCard
            report={report}
            extraNotes={outdoorNotes}
            sample={!data.connected}
          />
        </div>
      )}

      <div className="mt-4 space-y-3">
        <InstallBanner />
        {!device.ios && !device.coarse && (
          <div className="flex items-center gap-3 rounded-[24px] border border-white/8 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={appPath("/qr.svg")} alt="QR code to open Aether on a phone" width={88} height={88} />
            <p className="text-sm text-muted">Open Aether on the phone that wears the strap.</p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <JournalChips journal={journal} onChange={updateJournal} />
      </div>

      <AgeCard report={bioAge} variant="compact" sample={!data.connected && !fromBand} />

      <section className="mt-6 rounded-[32px] border border-white/8 bg-panel px-2 pb-6 pt-4">
        <ArcMeter
          value={Math.round(score)}
          max={100}
          color={recoveryColor(score)}
          label="Aether readiness"
          sub={
            hr.overnight
              ? hr.overnight.staged
                ? `Aether sleep · ${formatHours(hr.overnight.restMs)} · Aether ${hr.overnight.recovery}`
                : `Overnight from the strap · rest ${formatHours(hr.overnight.restMs)} · Aether ${hr.overnight.recovery}`
              : fromBand
              ? `Strap · HRV ${hr.rmssd ?? "…"} · RHR ${hr.restHr ?? "…"}`
              : report
                ? `${data.connected ? "Account" : "Sample"} ${report.whoop ?? "—"} · HRV z ${report.hrvZ >= 0 ? "+" : ""}${report.hrvZ.toFixed(1)}`
                : recovery?.score
                  ? `HRV ${Math.round(recovery.score.hrv_rmssd_milli)} · RHR ${recovery.score.resting_heart_rate}`
                  : "Calibrating"
          }
        />
      </section>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link href="/lab" className="rounded-[28px] bg-ember/15 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ember">Lab</p>
          <p className="font-display mt-2 text-4xl leading-none">
            {report ? report.acwr.toFixed(2) : "—"}
          </p>
          <p className="mt-2 text-xs text-paper/70">Acute:chronic load</p>
        </Link>
        <Link href="/sleep" className="rounded-[28px] bg-violet/15 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-violet">Sleep</p>
          <p className="font-display mt-2 text-4xl leading-none">{sleepPct}%</p>
          <p className="mt-2 text-xs text-paper/70">
            {sleep?.score
              ? formatHours(
                  scoredSleepMs(sleep.score.stage_summary, overnightSleep && !restWake),
                )
              : "—"}{" "}
            {overnightSleep ? (restWake ? "quiet HR window" : "asleep") : "in bed"}
          </p>
        </Link>
      </div>

      {recovery?.score && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Mini
            label="HRV"
            value={
              hr.status === "live" && hr.rmssd == null
                ? "Listening…"
                : `${Math.round(recovery.score.hrv_rmssd_milli)} ms`
            }
            note={fromBand ? "from your WHOOP" : "sample"}
          />
          <Mini
            label="Resting HR"
            value={
              hr.status === "live" && hr.restHr == null
                ? "Sit still…"
                : `${recovery.score.resting_heart_rate} bpm`
            }
            note={fromBand ? "from your WHOOP" : "sample"}
          />
          <Mini
            label="SpO2"
            value={
              recovery.score.spo2_percentage != null && (data.connected || hr.spo2 != null)
                ? `${recovery.score.spo2_percentage.toFixed(1)}%`
                : "—"
            }
            note={
              hr.spo2 != null
                ? "standard pulse-ox GATT"
                : data.connected
                  ? "WHOOP overnight"
                  : "WHOOP private radio — not on public Bluetooth"
            }
          />
          <Mini
            label="Skin temp"
            value={
              recovery.score.skin_temp_celsius != null &&
              (data.connected || hr.skinTempC != null)
                ? `${recovery.score.skin_temp_celsius.toFixed(1)}°C`
                : "—"
            }
            note={
              hr.skinTempC != null
                ? "standard thermometer GATT"
                : data.connected
                  ? "WHOOP overnight"
                  : "WHOOP private radio — not on public Bluetooth"
            }
          />
        </div>
      )}

      </div>
      <div>

      <div className="mt-4 lg:mt-6">
        <EnvironmentCard midsleepHour={midsleepHour} />
      </div>

      {sleep?.score && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg">Last night</h2>
            <Link href={`/sleep/view?id=${encodeURIComponent(sleep.id)}`} className="text-xs text-lime">
              Open
            </Link>
          </div>
          {overnightSleep ? (
            <p className="mb-3 text-xs text-muted">
              {restWake
                ? "Rest vs wake from your WHOOP’s public heart rate. Leave Aether connected overnight for Aether sleep."
                : "Aether sleep from public heart rate and HRV. Not WHOOP REM / light / deep."}
            </p>
          ) : null}
          <SleepStages
            stages={sleep.score.stage_summary}
            source={overnightSleep ? "aether" : "whoop"}
            epochs={overnightSleep ? (hr.overnight?.epochs ?? []) : undefined}
          />
        </section>
      )}

      <section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg">Today&apos;s films</h2>
          <Link href="/workouts" className="flex items-center text-xs text-lime">
            All workouts <ChevronRight size={14} />
          </Link>
        </div>
        {todayWorkouts.length === 0 ? (
          <p className="rounded-[24px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted">
            No sessions yet today.{" "}
            <Link href="/coach/live" className="text-lime">
              Track live
            </Link>{" "}
            or{" "}
            <Link href="/coach/build" className="text-lime">
              build a workout
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3">
            {todayWorkouts.map((workout) => (
              <WorkoutCard key={workout.id} workout={workout} />
            ))}
          </div>
        )}
      </section>

      </div>
      </div>

      {cycle?.score && (
        <p className="mt-6 pb-4 text-center text-xs text-muted">
          {kcalFromKj(cycle.score.kilojoule)} kcal · avg {cycle.score.average_heart_rate} bpm
          {sleep?.score
            ? ` · ${formatHours(
                scoredSleepMs(sleep.score.stage_summary, overnightSleep && !restWake),
              )} ${overnightSleep && !restWake ? "asleep" : "asleep window"}`
            : ""}
        </p>
      )}
    </div>
  );
}

function Mini({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 px-3 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 text-lg">{value}</p>
      {note ? <p className="mt-1 text-[11px] text-muted">{note}</p> : null}
    </div>
  );
}

function WeekStrip({
  now,
  recoveries,
  todayScore,
}: {
  now: Date | null;
  recoveries: Recovery[];
  todayScore?: number | null;
}) {
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
    const rec = recoveries.find((r) => isSameDay(r.created_at, date));
    const isToday = i === 6;
    return {
      date,
      score: isToday && todayScore != null ? todayScore : rec?.score?.recovery_score ?? null,
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
