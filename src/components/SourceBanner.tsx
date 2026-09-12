"use client";

import { useLiveHeartRate } from "./LiveHeartRate";

export function SourceBanner() {
  const hr = useLiveHeartRate();
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
  return (
    <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
      On-device · connect your WHOOP over Bluetooth
    </p>
  );
}
