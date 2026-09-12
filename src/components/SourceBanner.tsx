"use client";

import { useDashboard } from "./DataProvider";
import { isStaticSite } from "@/lib/site";

export function SourceBanner() {
  const { data, loading } = useDashboard();
  if (data.connected) {
    return (
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime/80">
        Live from your WHOOP band
      </p>
    );
  }
  if (isStaticSite()) {
    return (
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
        On-device copy · nothing is stored on this website
      </p>
    );
  }
  return (
    <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
      {loading ? "Checking band…" : "Demo data · connect WHOOP to load yours"}
    </p>
  );
}
