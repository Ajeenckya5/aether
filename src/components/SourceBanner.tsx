"use client";

import { useDashboard } from "./DataProvider";
import { useLiveHeartRate } from "./LiveHeartRate";

export function SourceBanner() {
  const hr = useLiveHeartRate();
  const { data } = useDashboard();
  if (hr.status === "live") {
    const whoop = /whoop/i.test(hr.deviceName ?? "");
    return (
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime/80">
        {whoop
          ? `Live WHOOP · public Heart Rate${hr.deviceName ? ` · ${hr.deviceName}` : ""}`
          : `Live Bluetooth${hr.deviceName ? ` · ${hr.deviceName}` : ""}`}
      </p>
    );
  }
  if (data.connected) {
    return (
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime/80">
        WHOOP account · overnight from the official API
      </p>
    );
  }
  return (
    <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
      Sample recovery · connect WHOOP over Bluetooth for live bpm
    </p>
  );
}
