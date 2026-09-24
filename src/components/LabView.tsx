"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/hr-motion";
import { MODEL_CARD } from "@/lib/model";
import { countEvent, loadRemoteFlags } from "@/lib/remote-config";
import { appPath } from "@/lib/site";
import { AgeCard } from "./AgeCard";
import { AtlasPanel } from "./AtlasPanel";
import { CallCard } from "./CallCard";
import { CallMotion } from "./CallMotion";
import { EnvironmentCard } from "./EnvironmentCard";
import { JournalChips } from "./JournalChips";
import { SourceBanner } from "./SourceBanner";
import { useEnvironment } from "./useEnvironment";
import { useAtlas } from "./useAtlas";
import { useLab } from "./useLab";

export function LabView() {
  const [days, setDays] = useState<7 | 28 | 90>(28);
  const { report, journal, updateJournal, data, bioAge, athlete } = useLab(days);
  const atlas = useAtlas(data, journal, athlete);
  const { env } = useEnvironment();
  const [tab, setTab] = useState<"call" | "atlas">("call");
  const [ranges, setRanges] = useState(true);
  useEffect(() => {
    void loadRemoteFlags(appPath("/remote-config.json")).then((flags) => setRanges(flags.trends));
  }, []);

  const sleep = data.sleeps[0];
  const mid = sleep
    ? new Date(
        (new Date(sleep.start).getTime() + new Date(sleep.end).getTime()) / 2,
      )
    : null;
  const midsleepHour = mid ? mid.getHours() + mid.getMinutes() / 60 : null;
  const outdoorNotes =
    env && env.outdoor.level !== "go" ? env.outdoor.notes : undefined;

  const windowCtl = report ? report.series.ctl.slice(-days) : [];
  const windowAtl = report ? report.series.atl.slice(-days) : [];
  const peak = Math.max(...windowCtl, ...windowAtl, 1);

  return (
    <div className="px-5 pt-6 pb-8 lg:px-2">
      <SourceBanner />
      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-lime">
        Open physiology
      </p>
      <h1 className="font-display mt-2 text-4xl">Lab</h1>
      <p className="mt-2 text-sm text-muted">
        Every published algorithm this band, journal, and body stats can
        actually drive — with the formula and paper on each row. Methods this
        phone cannot measure stay listed as unavailable instead of guessed.
        {data.connected
          ? ""
          : " Overnight recovery and sleep here stay a sample. Pair a strap to overlay live HRV, resting heart rate, and Aether sleep from public heart rate."}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTab("call")}
          className={`rounded-full py-2 text-sm ${tab === "call" ? "bg-lime text-ink" : "bg-white/6"}`}
        >
          Call
        </button>
        <button
          type="button"
          onClick={() => setTab("atlas")}
          className={`rounded-full py-2 text-sm ${tab === "atlas" ? "bg-lime text-ink" : "bg-white/6"}`}
        >
          Atlas · {atlas.metrics.length}
        </button>
      </div>

      {tab === "atlas" ? (
        <div className="mt-6 space-y-4">
          <AgeCard report={bioAge} sample={!data.connected} />
          <EnvironmentCard midsleepHour={midsleepHour} />
          <AtlasPanel atlas={atlas} />
        </div>
      ) : !report ? (
        <>
          <div className="mt-6">
            <AgeCard report={bioAge} sample={!data.connected} />
          </div>
          <p className="mt-6 text-sm text-muted">
            Need a few scored days before Lab can run the daily call.
          </p>
        </>
      ) : (
        <>

      <div className="mt-6">
        <CallMotion signature={`${report.call}:${report.callWhy.join("|")}`}>
          <CallCard
            report={report}
            extraNotes={outdoorNotes}
            sample={!data.connected}
          />
        </CallMotion>
      </div>

      <div className="mt-4">
            <AgeCard report={bioAge} sample={!data.connected} />
      </div>

      <div className="mt-4">
        <JournalChips journal={journal} onChange={updateJournal} />
      </div>

      <div className="mt-4">
        <EnvironmentCard midsleepHour={midsleepHour} />
      </div>

      <section className="mt-6 rounded-[28px] border border-white/8 bg-panel p-4">
        <h2 className="font-display text-lg">Why Aether disagrees</h2>
        <p className="mt-1 text-xs text-muted">
          Feature contributions from the trained readiness model (ridge, 14k
          athlete-days, R² {MODEL_CARD.r2}).
        </p>
        <ul className="mt-4 space-y-3">
          {report.attributions.map((item) => {
            const mag = Math.min(100, Math.abs(item.contribution) * 6);
            const good = item.contribution >= 0;
            return (
              <li key={item.feature}>
                <div className="flex justify-between text-sm">
                  <span className="text-paper/80">{item.label}</span>
                  <span className={good ? "text-lime" : "text-ember"}>
                    {good ? "+" : ""}
                    {item.contribution.toFixed(1)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div
                    className={`h-full rounded-full ${good ? "bg-lime" : "bg-ember"}`}
                    style={{ width: `${mag}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2">
        <Stat
          label="TSB"
          value={report.tsb.toFixed(0)}
          note={report.tsb >= 0 ? "Fresh" : "Fatigued"}
        />
        <Stat
          label="ACWR"
          value={report.acwr.toFixed(2)}
          note={
            report.acwrBand === "sweet"
              ? "Sweet spot"
              : report.acwrBand === "spike"
                ? "Injury spike"
                : report.acwrBand === "caution"
                  ? "Caution"
                  : "Underload"
          }
        />
        <Stat label="HRV z" value={signed(report.hrvZ)} note="vs 14-day you" />
        <Stat label="RHR z" value={signed(report.rhrZ)} note="up is worse" />
        <Stat
          label="Stress load"
          value={Math.round(report.stress).toString()}
          note="open analog of 5.0 Stress"
        />
        <Stat
          label="Risk"
          value={`${Math.round(report.risk * 100)}%`}
          note={report.overreaching ? "Overreaching flag" : report.riskLabel}
        />
      </section>

      <section className="mt-6 rounded-[28px] border border-white/8 p-4">
        <h2 className="font-display text-lg">Fitness / fatigue</h2>
        <p className="mt-1 text-xs text-muted">
          Banister EMAs · CTL 42d fitness, ATL 7d fatigue. Showing {windowCtl.length} days.
        </p>
        {ranges && (
          <div className="mt-3 flex flex-wrap gap-2">
            {([7, 28, 90] as const).map((span) => (
              <button
                key={span}
                type="button"
                aria-pressed={days === span}
                className={`min-h-11 rounded-full px-3 text-xs ${
                  days === span ? "bg-lime text-ink" : "bg-white/8 text-paper"
                }`}
                onClick={() => {
                  setDays(span);
                  countEvent("range");
                }}
              >
                {span} days
              </button>
            ))}
          </div>
        )}
        <svg viewBox="0 0 100 48" className="mt-4 h-28 w-full" preserveAspectRatio="none">
          <DrawPath d={linePath(windowCtl, peak)} stroke="#d6ff4b" />
          <DrawPath d={linePath(windowAtl, peak)} stroke="#ff5c2a" />
        </svg>
        <div className="flex justify-between text-[11px] text-muted">
          <span className="text-lime">Fitness CTL {report.ctl.toFixed(0)}</span>
          <span className="text-ember">Fatigue ATL {report.atl.toFixed(0)}</span>
        </div>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 p-4">
        <h2 className="font-display text-lg">If you train today</h2>
        <p className="mt-1 text-xs text-muted">
          Counterfactual load on tomorrow&apos;s readiness and ACWR.
        </p>
        <div className="mt-3 space-y-2">
          {report.counterfactuals.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-2xl bg-white/4 px-3 py-3 text-sm"
            >
              <span>{row.label}</span>
              <span className="text-muted">
                readiness {Math.round(row.readiness)} · ACWR {row.acwr.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 p-4">
        <h2 className="font-display text-lg">Vital slope</h2>
        <p className="font-display mt-1 text-2xl capitalize">{report.vitalSlope}</p>
        <p className="mt-2 text-sm text-paper/75">{report.vitalNote}</p>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 p-4">
        <h2 className="font-display text-lg">This week&apos;s shape</h2>
        <p className="mt-1 text-xs text-muted">
          Polarized distribution from heart-rate zones. Target ~80% easy.
        </p>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full">
          <div className="bg-lime" style={{ width: `${report.polarized.easy * 100}%` }} />
          <div className="bg-[#f0c14b]" style={{ width: `${report.polarized.moderate * 100}%` }} />
          <div className="bg-ember" style={{ width: `${report.polarized.hard * 100}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-3 text-center text-xs text-muted">
          <div>Easy {Math.round(report.polarized.easy * 100)}%</div>
          <div>Tempo {Math.round(report.polarized.moderate * 100)}%</div>
          <div>Hard {Math.round(report.polarized.hard * 100)}%</div>
        </div>
        <p className="mt-3 text-sm">
          Zone 2: {Math.round(report.zone2WeekMin)} / {report.zone2TargetMin} min
        </p>
        <p className="text-sm text-muted">
          Lifting minutes this week: {Math.round(report.mechanicalWeek)}. Strain
          undercounts mechanical work, so lifting is weighted up.
        </p>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 p-4 text-sm text-muted">
        <h2 className="font-display text-lg text-paper">Model card</h2>
        <p className="mt-2">
          {MODEL_CARD.name}. The weights were fit on synthetic days from published
          physiology. This page does not show a held-out accuracy number.
        </p>
        <p className="mt-2">
          Priors: Plews HRV, Banister fitness-fatigue, Gabbett ACWR, sleep
          architecture. Weights live in{" "}
          <code className="text-paper">src/lib/model-weights.json</code>. Retrain
          with <code className="text-paper">python3 scripts/train_readiness.py</code>.
        </p>
        <Link href="/strain" className="mt-3 inline-block text-lime">
          Strain history →
        </Link>
      </section>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 px-3 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className="font-display mt-1 text-2xl">{value}</p>
      <p className="text-[11px] text-muted">{note}</p>
    </div>
  );
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
}

function DrawPath({ d, stroke }: { d: string; stroke: string }) {
  const ref = useRef<SVGPathElement>(null);
  useEffect(() => {
    const path = ref.current;
    if (!path) return;
    if (prefersReducedMotion()) {
      path.style.transition = "none";
      path.style.strokeDasharray = "";
      path.style.strokeDashoffset = "0";
      return;
    }
    const length = path.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) return;
    path.style.transition = "none";
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      path.style.transition = "stroke-dashoffset 700ms ease";
      path.style.strokeDashoffset = "0";
    };
    let inner = 0;
    const frame = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(reveal);
    });
    const backup = window.setTimeout(reveal, 48);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(inner);
      window.clearTimeout(backup);
      if (!revealed) {
        path.style.transition = "none";
        path.style.strokeDashoffset = "0";
      }
    };
  }, [d]);
  return (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth="1.4"
      vectorEffect="non-scaling-stroke"
    />
  );
}

function linePath(values: number[], peak: number): string {
  if (values.length === 0) return "";
  return values
    .map((v, i) => {
      const x = values.length === 1 ? 0 : (i / (values.length - 1)) * 100;
      const y = 46 - (v / peak) * 42;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}
