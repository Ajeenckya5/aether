"use client";

import { zonePercents } from "@/lib/hr-curve";
import type { ZoneDurations } from "@/lib/types";

const ZONE_COLORS = [
  "#5b564c",
  "#7ad7ff",
  "#d6ff4b",
  "#f0c14b",
  "#ff5c2a",
  "#ff2d55",
];

const ZONE_NAMES = ["Z0", "Z1", "Z2", "Z3", "Z4", "Z5"];

export function ZoneBar({
  zones,
  compact = false,
}: {
  zones: ZoneDurations | null | undefined;
  compact?: boolean;
}) {
  const pct = zonePercents(zones);

  return (
    <div className="space-y-2">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
        {pct.map((p, i) => (
          <div
            key={ZONE_NAMES[i]}
            style={{ width: `${p * 100}%`, background: ZONE_COLORS[i] }}
          />
        ))}
      </div>
      {!compact && (
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted">
          {ZONE_NAMES.map((name, i) => (
            <span key={name} className="flex items-center gap-1">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: ZONE_COLORS[i] }}
              />
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
