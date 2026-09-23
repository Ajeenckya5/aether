import Link from "next/link";
import type { BioAgeReport } from "@/lib/bio-age";

function deltaCopy(delta: number | null): { text: string; className: string } {
  if (delta == null) return { text: "Need more markers", className: "text-muted" };
  if (delta <= -0.5) {
    return {
      text: `${Math.abs(delta).toFixed(1)} years younger`,
      className: "text-lime",
    };
  }
  if (delta >= 0.5) {
    return {
      text: `${delta.toFixed(1)} years older`,
      className: "text-ember",
    };
  }
  return { text: "Aligned with actual age", className: "text-paper/80" };
}

function confidenceCopy(level: BioAgeReport["confidence"]): string {
  if (level === "high") return "High confidence";
  if (level === "medium") return "Medium confidence";
  if (level === "low") return "Low confidence";
  return "Unavailable";
}

export function AgeCard({
  report,
  variant = "full",
  sample = false,
}: {
  report: BioAgeReport;
  variant?: "compact" | "full";
  sample?: boolean;
}) {
  const recoveryAge = report.recoveryAge;
  if (!recoveryAge?.publish || report.biological == null) {
    const nights = recoveryAge?.nightsCollected ?? 0;
    const need = recoveryAge?.nightsRequired ?? 14;
    return (
      <section className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
          Recovery age estimate
        </p>
        <p className="font-display mt-3 text-2xl leading-tight">
          {nights} of {need} nights collected
        </p>
        <p className="mt-2 text-sm text-muted">
          This stays hidden until there are {need} real nights and{" "}
          {recoveryAge?.markersRequired ?? 6} real markers. Sample history never
          gets a confidence label.
        </p>
      </section>
    );
  }

  const ba =
    report.biological == null ? null : Math.round(report.biological * 10) / 10;
  const delta = deltaCopy(report.delta);
  const systems = report.systems.filter((s) => s.age != null);

  const body = (
    <>
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime">
        Recovery age estimate
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="font-display text-[2.5rem] leading-none tabular-nums sm:text-5xl">
            {report.chronological}
          </p>
          <p className="mt-1 text-xs text-muted">Actual</p>
        </div>
        <div className="min-w-0">
          <p className="font-display text-[2.5rem] leading-none tabular-nums sm:text-5xl">
            {ba == null ? "—" : ba % 1 === 0 ? ba.toFixed(0) : ba.toFixed(1)}
          </p>
          <p className="mt-1 text-xs text-muted">Recovery age</p>
        </div>
      </div>
      <p className={`mt-3 text-sm ${delta.className}`}>{delta.text}</p>
      <p className="mt-1 text-xs text-muted">
        {confidenceCopy(report.confidence)} · {report.markersUsed}/
        {report.markersPossible} markers · Klemera–Doubal
        {sample ? " · sample nights" : ""}
      </p>
    </>
  );

  if (variant === "compact") {
    return (
      <section className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5">
        {body}
        {systems.length > 0 && (
          <p className="mt-3 text-xs text-paper/70">
            {systems
              .map((s) => `${s.label} ${Math.round(s.age ?? 0)}`)
              .join(" · ")}
          </p>
        )}
        <div className="mt-3 flex flex-col gap-2 text-xs">
          <Link href="/settings" className="text-paper/80">
            Change actual age in Settings
          </Link>
          <Link href="/lab" className="text-lime">
            Open Lab for the breakdown →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-white/8 bg-panel p-5">
      {body}
      {systems.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {systems.map((s) => (
            <span
              key={s.id}
              className="rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs text-paper/80"
            >
              {s.label} {Math.round(s.age ?? 0)}
            </span>
          ))}
        </div>
      )}
      {report.unconstrained != null &&
        report.unconstrained > 16.05 &&
        report.unconstrained < 89.95 && (
        <p className="mt-3 text-xs text-muted">
          Physiology-only (no age prior): {report.unconstrained.toFixed(1)} y
        </p>
      )}
      {report.missing.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Still unused: {report.missing.join(" · ")}
        </p>
      )}
      <p className="mt-4 text-xs leading-relaxed text-muted">{report.notes[0]}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted">{report.notes[1]}</p>
      <Link href="/settings" className="mt-3 block text-xs text-lime">
        Change actual age in Settings
      </Link>
    </section>
  );
}
