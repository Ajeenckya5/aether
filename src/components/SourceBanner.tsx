"use client";

import { useLiveHeartRate } from "./LiveHeartRate";

export function SourceBanner() {
  const hr = useLiveHeartRate();
  if (hr.status === "live") {
    return (
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime/80">
        Live Bluetooth{hr.deviceName ? ` · ${hr.deviceName}` : ""}
      </p>
    );
  }
  return (
    <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
      On-device · Bluetooth only · no WHOOP cloud
    </p>
  );
}
