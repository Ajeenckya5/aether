"use client";

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: Math.round((cx + r * Math.cos(a)) * 10) / 10,
    y: Math.round((cy + r * Math.sin(a)) * 10) / 10,
  };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

export function ArcMeter({
  value,
  max,
  color,
  label,
  sub,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  sub?: string;
}) {
  const cx = 110;
  const cy = 118;
  const r = 86;
  const start = -130;
  const sweep = 260;
  const pct = Math.max(0, Math.min(1, value / max));
  const end = start + sweep * pct;
  const display = Number.isInteger(value) ? String(value) : value.toFixed(1);

  return (
    <div className="relative mx-auto w-[220px]">
      <svg viewBox="0 0 220 168" className="h-auto w-full">
        <path
          d={arcPath(cx, cy, r, start, start + sweep)}
          fill="none"
          stroke="rgba(244,239,230,0.08)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d={arcPath(cx, cy, r, start, Math.max(start + 0.1, end))}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          className="meter-glow"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
        <span className="font-display text-[52px] leading-none tracking-tight text-paper">
          {display}
        </span>
        <span className="mt-1 text-[11px] uppercase tracking-[0.22em] text-muted">
          {label}
        </span>
        {sub && <span className="mt-0.5 text-xs text-paper/70">{sub}</span>}
      </div>
    </div>
  );
}
