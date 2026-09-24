"use client";

import { useLiveHeartRate } from "./heart-rate-context";

export function BandActions() {
  const hr = useLiveHeartRate();
  const live = hr.status === "live";

  return (
    <>
      <div className="ble-only mt-4 gap-2">
        <button
          type="button"
          onClick={() => void hr.connect()}
          className="min-h-12 rounded-full bg-lime px-4 py-3 text-sm font-medium text-ink"
        >
          {live
            ? `${hr.bpm ?? "--"} bpm · stays connected`
            : hr.status === "connecting"
              ? "Keeping the strap connected…"
              : "Connect a heart-rate strap"}
        </button>
        <button
          type="button"
          onClick={() => void hr.connect({ scanAll: true })}
          className="min-h-12 rounded-full border border-white/15 px-4 py-3 text-sm"
        >
          Scan all devices
        </button>
      </div>
      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={() => void hr.startCamera()}
          className="min-h-12 rounded-full border border-white/15 px-4 py-3 text-sm"
        >
          {hr.status === "camera" ? `${hr.bpm ?? "--"} bpm camera` : "Camera pulse"}
        </button>
        <button
          type="button"
          onClick={() => hr.startPractice()}
          className="min-h-12 rounded-full border border-white/15 px-4 py-3 text-sm"
        >
          {hr.status === "practice" ? `${hr.bpm ?? "--"} demo pulse` : "Demo pulse"}
        </button>
        {(live ||
          hr.status === "connecting" ||
          hr.status === "practice" ||
          hr.status === "camera") && (
          <button
            type="button"
            onClick={() => hr.disconnect()}
            className="min-h-12 rounded-full border border-white/15 px-4 py-3 text-sm"
          >
            Disconnect
          </button>
        )}
      </div>
    </>
  );
}
