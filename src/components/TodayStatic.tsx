import Link from "next/link";
import { ChevronRight, Download, Settings } from "lucide-react";
import { BLUEFY_APP_STORE } from "@/lib/ios-ble";
import { AgeCard } from "./AgeCard";
import { ArcMeter } from "./ArcMeter";
import { BandActions } from "./BandConnect";
import { InstallBanner } from "./DeviceChrome";
import { EnvironmentLive, HideWithoutBody } from "./TodayIslands";
import { LiveToday } from "./LiveToday";
import { SleepStages, isRestWakeStages } from "./SleepStages";
import { SourceBanner } from "./SourceBanner";
import { TodayHeading, WeekStripLive } from "./TodayClock";
import { TodayJournal } from "./TodayJournal";
import { WorkoutCard } from "./WorkoutCard";
import { DEFAULT_ATHLETE } from "@/lib/athlete";
import { estimateBioAge } from "@/lib/bio-age";
import { formatHours, isSameDay, kcalFromKj, recoveryTone } from "@/lib/format";
import { analyzeDashboard } from "@/lib/intelligence";
import { EMPTY_JOURNAL } from "@/lib/journal";
import { buildDemoDashboard } from "@/lib/mock";
import { isAetherOvernightSleep, scoredSleepMs } from "@/lib/overnight";
import { appPath } from "@/lib/site";

function recoveryColor(score: number) {
  const tone = recoveryTone(score);
  if (tone === "high") return "var(--lime)";
  if (tone === "ok") return "var(--gold)";
  return "var(--ember)";
}

function demoDashboard() {
  const data = buildDemoDashboard();
  data.configured = false;
  data.connected = false;
  data.source = "demo";
  return data;
}

export function TodayStatic() {
  const data = demoDashboard();
  const report = analyzeDashboard(data, EMPTY_JOURNAL, data.workouts);
  const bioAge = estimateBioAge(data, DEFAULT_ATHLETE, {});
  const recovery = data.recoveries[0];
  const cycle = data.cycles[0];
  const sleep = data.sleeps[0];
  const overnightSleep = isAetherOvernightSleep(sleep?.id);
  const restWake = sleep?.score ? isRestWakeStages(sleep.score.stage_summary) : false;
  const todayWorkouts = data.workouts.filter((workout) => isSameDay(workout.start));
  const score = report?.aether ?? recovery?.score?.recovery_score ?? 0;
  const sleepPct = sleep?.score?.sleep_performance_percentage ?? 0;
  const mid = sleep
    ? new Date((new Date(sleep.start).getTime() + new Date(sleep.end).getTime()) / 2)
    : null;
  const midsleepHour = mid ? mid.getHours() + mid.getMinutes() / 60 : null;
  const week = data.recoveries.map((item) => ({
    createdAt: item.created_at,
    score: item.score?.recovery_score ?? null,
  }));

  return (
    <LiveToday>
      <div className="px-5 pt-6 lg:px-2">
        <HideWithoutBody>
          <Link prefetch={false}
            href="/settings"
            className="mb-4 block rounded-[24px] border border-lime/25 bg-lime/8 px-4 py-3"
          >
            <p className="font-display text-lg text-paper">Add your details</p>
            <p className="mt-1 text-xs text-muted">
              Height, weight, age, and name stay on this phone. Lab then uses your body, not a
              stand-in — including biological age.
            </p>
          </Link>
        </HideWithoutBody>

        <header className="mb-6 flex items-start justify-between">
          <div>
            <SourceBanner />
            <TodayHeading />
          </div>
          <div className="flex gap-2">
            <Link prefetch={false}
              href="/download"
              className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5"
              aria-label="Download Aether"
            >
              <Download size={16} />
            </Link>
            <Link prefetch={false}
              href="/settings"
              className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5"
              aria-label="Settings"
            >
              <Settings size={16} />
            </Link>
          </div>
        </header>

        <div className="mb-4">
          <section id="whoop-connect" className="rounded-[28px] border border-lime/30 bg-lime/10 p-5">
            <p className="text-xs uppercase tracking-widest text-lime">WHOOP</p>
            <h2 className="font-display mt-1 text-xl text-paper">Connect your band</h2>
            <p
              className="mt-2 text-sm text-paper/80"
              style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
            >
              Pair a heart-rate strap over the public Bluetooth Heart Rate service. iPhone Safari
              cannot pair the band — install the Aether iPhone app (Xcode on a Mac) or use Bluefy.
              Camera pulse is optical bpm from this phone, not the WHOOP.
            </p>
            <div className="no-ble mt-4 grid gap-2">
              <Link prefetch={false}
                href="/download#ios-native"
                className="rounded-full bg-lime px-4 py-3 text-center text-sm font-medium text-ink"
              >
                Install Aether iPhone app — Bluetooth without Safari
              </Link>
              <a
                href={BLUEFY_APP_STORE}
                className="rounded-full border border-white/15 px-4 py-3 text-center text-sm"
              >
                No Mac? Use Bluefy (free) instead
              </a>
              <Link prefetch={false} href="/download#ios-native" className="mt-1 block text-xs text-lime">
                iPhone WHOOP steps →
              </Link>
            </div>
            <BandActions />
          </section>
        </div>

        <WeekStripLive recoveries={week} />

        <div className="lg:mt-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
          <div>
            {report ? <TodayJournal report={report} /> : null}

            <div className="mt-4 space-y-3">
              <InstallBanner />
              <div className="aether-desk-only flex items-center gap-3 rounded-[24px] border border-white/8 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={appPath("/qr.svg")}
                  alt="QR code to open Aether on a phone"
                  width={88}
                  height={88}
                />
                <p className="text-sm text-muted">Open Aether on the phone that wears the strap.</p>
              </div>
            </div>

            {bioAge ? <AgeCard report={bioAge} variant="compact" sample /> : null}

            <section className="mt-6 rounded-[32px] border border-white/8 bg-panel px-2 pb-6 pt-4">
              <ArcMeter
                value={Math.round(score)}
                max={100}
                color={recoveryColor(score)}
                label="Aether readiness"
                sub={
                  report
                    ? `Sample ${report.whoop ?? "—"} · HRV z ${report.hrvZ >= 0 ? "+" : ""}${report.hrvZ.toFixed(1)}`
                    : recovery?.score
                      ? `HRV ${Math.round(recovery.score.hrv_rmssd_milli)} · RHR ${recovery.score.resting_heart_rate}`
                      : "Calibrating"
                }
              />
            </section>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <Link prefetch={false} href="/lab" className="rounded-[28px] bg-ember/15 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-ember">Lab</p>
                <p className="font-display mt-2 text-4xl leading-none">
                  {report ? report.acwr.toFixed(2) : "—"}
                </p>
                <p className="mt-2 text-xs text-paper/70">Acute:chronic load</p>
              </Link>
              <Link prefetch={false} href="/sleep" className="rounded-[28px] bg-violet/15 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-violet">Sleep</p>
                <p className="font-display mt-2 text-4xl leading-none">{sleepPct}%</p>
                <p className="mt-2 text-xs text-paper/70">
                  {sleep?.score
                    ? formatHours(scoredSleepMs(sleep.score.stage_summary, overnightSleep && !restWake))
                    : "—"}{" "}
                  {overnightSleep ? (restWake ? "quiet HR window" : "asleep") : "in bed"}
                </p>
              </Link>
            </div>

            {recovery?.score && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Mini label="HRV" value={`${Math.round(recovery.score.hrv_rmssd_milli)} ms`} note="sample" />
                <Mini label="Resting HR" value={`${recovery.score.resting_heart_rate} bpm`} note="sample" />
                <Mini
                  label="SpO2"
                  value={
                    recovery.score.spo2_percentage != null
                      ? `${recovery.score.spo2_percentage.toFixed(1)}%`
                      : "—"
                  }
                  note="WHOOP private radio — not on public Bluetooth"
                />
                <Mini
                  label="Skin temp"
                  value={
                    recovery.score.skin_temp_celsius != null
                      ? `${recovery.score.skin_temp_celsius.toFixed(1)}°C`
                      : "—"
                  }
                  note="WHOOP private radio — not on public Bluetooth"
                />
              </div>
            )}
          </div>

          <div>
            <div className="mt-4 lg:mt-6">
              <EnvironmentLive midsleepHour={midsleepHour}>
                <section className="rounded-[28px] border border-dashed border-white/12 px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-aqua">Field</p>
                  <p className="mt-1 text-sm text-paper">Weather, AQI, UV, and heat for your session.</p>
                  <p className="mt-1 text-xs text-muted">
                    Open-Meteo is free and needs no key. Set a location to turn it on.
                  </p>
                  <Link prefetch={false}
                    href="/settings"
                    className="mt-3 inline-block rounded-full bg-white/8 px-4 py-2 text-sm text-lime"
                  >
                    Set location
                  </Link>
                </section>
              </EnvironmentLive>
            </div>

            {sleep?.score && (
              <section className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-lg">Last night</h2>
                  <Link prefetch={false} href={`/sleep/view?id=${encodeURIComponent(sleep.id)}`} className="text-xs text-lime">
                    Open
                  </Link>
                </div>
                <SleepStages
                  stages={sleep.score.stage_summary}
                  source={overnightSleep ? "aether" : "whoop"}
                />
              </section>
            )}

            <section className="mt-7">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg">Today&apos;s films</h2>
                <Link prefetch={false} href="/workouts" className="flex items-center text-xs text-lime">
                  All workouts <ChevronRight size={14} />
                </Link>
              </div>
              {todayWorkouts.length === 0 ? (
                <p className="rounded-[24px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted">
                  No sessions yet today.{" "}
                  <Link prefetch={false} href="/coach/live" className="text-lime">
                    Track live
                  </Link>{" "}
                  or{" "}
                  <Link prefetch={false} href="/coach/build" className="text-lime">
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
              ? ` · ${formatHours(scoredSleepMs(sleep.score.stage_summary, overnightSleep && !restWake))} ${overnightSleep && !restWake ? "asleep" : "asleep window"}`
              : ""}
          </p>
        )}
      </div>
    </LiveToday>
  );
}

function Mini({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 px-3 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 text-lg">{value}</p>
      {note ? <p className="mt-1 text-[11px] text-muted">{note}</p> : null}
    </div>
  );
}
