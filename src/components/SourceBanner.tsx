"use client";

import { useDashboard } from "./DataProvider";
import { useLiveHeartRate } from "./LiveHeartRate";

export function SourceBanner() {
  const hr = useLiveHeartRate();
  const { data } = useDashboard();
  if (hr.status === "live") {
    const whoop = /whoop/i.test(hr.deviceName ?? "");
    const extras = [
      hr.rmssd != null ? `HRV ${hr.rmssd} ms` : null,
      hr.batteryPct != null ? `bat ${hr.batteryPct}%` : null,
      hr.spo2 != null ? `SpO2 ${hr.spo2.toFixed(1)}%` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime/80">
        {whoop ? "Live WHOOP · public Heart Rate" : "Live Bluetooth"}
        {hr.deviceName ? ` · ${hr.deviceName}` : ""}
        {extras ? ` · ${extras}` : ""}
      </p>
    );
  }
  if (hr.status === "camera") {
    return (
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime/80">
        Live camera pulse · not the WHOOP band
      </p>
    );
  }
  if (hr.overnight) {
    return (
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime/80">
        Aether overnight · Aether sleep from public HR · not WHOOP stages
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
      Sample recovery · pair WHOOP for live HRV, RHR, and Aether sleep
    </p>
  );
}
