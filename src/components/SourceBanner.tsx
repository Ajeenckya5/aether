"use client";

import { useDashboard } from "./DataProvider";

export function SourceBanner() {
  const { data, loading } = useDashboard();
  if (data.connected) {
    return (
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime/80">
        Live from your WHOOP band
      </p>
    );
  }
  return (
    <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
      {loading ? "Checking band…" : "Demo data · connect WHOOP to load yours"}
    </p>
  );
}
