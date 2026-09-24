"use client";

import { useDashboard } from "./DataProvider";
import { useLiveHeartRate } from "./heart-rate-context";

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
        {whoop ? "Live strap · public Heart Rate" : "Live Bluetooth"}
        {hr.deviceName ? ` · ${hr.deviceName}` : ""}
        {extras ? ` · ${extras}` : ""}
      </p>
    );
  }
  if (hr.status === "camera") {
    return (
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime/80">
        Live camera pulse · optical bpm from this phone
      </p>
    );
  }
  if (hr.overnight) {
    return (
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime/80">
        Aether overnight · sleep scored from public heart rate
      </p>
    );
  }
  if (data.connected) {
    return (
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime/80">
        Strap account · overnight from the official API
      </p>
    );
  }
  return (
    <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted">
      <span className="rounded-full border border-dashed border-white/25 px-2 py-0.5 text-paper/70">
        Demo
      </span>
      Pair a heart-rate strap
    </p>
  );
}
