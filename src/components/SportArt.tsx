import { sportKey } from "@/lib/sports";

const TINTS: Record<string, [string, string]> = {
  running: ["#1b2a18", "#d6ff4b"],
  cycling: ["#18202a", "#7ad7ff"],
  weightlifting: ["#2a1c16", "#ff5c2a"],
  "functional-fitness": ["#241818", "#ff5c2a"],
  walking: ["#1a2418", "#d6ff4b"],
  yoga: ["#1c1828", "#9d8cff"],
  pilates: ["#221828", "#9d8cff"],
  hiit: ["#2a1614", "#ff5c2a"],
  swimming: ["#102028", "#7ad7ff"],
  hiking: ["#1a2216", "#d6ff4b"],
  boxing: ["#2a1414", "#ff5c2a"],
  rowing: ["#142028", "#7ad7ff"],
  default: ["#1a1914", "#d6ff4b"],
};

export function SportArt({
  sport,
  className = "",
}: {
  sport: string;
  className?: string;
}) {
  const key = sportKey(sport);
  const [from, to] = TINTS[key] ?? TINTS.default;
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 80% at 80% 20%, ${to}55, transparent 55%), linear-gradient(160deg, ${from}, #0e0d0b)`,
        }}
      />
      <svg viewBox="0 0 200 120" className="absolute inset-0 h-full w-full opacity-70">
        <path
          d="M0 88 C 40 70, 70 96, 110 74 S 170 60, 200 78 L 200 120 L 0 120 Z"
          fill={to}
          opacity="0.18"
        />
        <circle cx="158" cy="28" r="18" fill={to} opacity="0.35" />
        <path
          d="M20 100 L 55 42 L 78 42 L 48 100 Z"
          fill={to}
          opacity="0.22"
        />
      </svg>
    </div>
  );
}
