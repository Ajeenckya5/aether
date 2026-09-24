"use client";

import { useLiveHeartRate } from "./heart-rate-context";
import { StrapConnectionStatus, strapActionLabel, useStrapConnection } from "./StrapConnection";

export function BandActions() {
  const hr = useLiveHeartRate();
  const strap = useStrapConnection();
  const live = strap.state === "connected" || strap.state === "lost" || strap.state === "requesting";

  return (
    <>
      <div className="ble-only mt-4 gap-2">
        <button
          type="button"
          onClick={() => void hr.connect()}
          data-strap-state={strap.state}
          className="min-h-12 rounded-full bg-lime px-4 py-3 text-sm font-medium text-ink"
        >
          {strapActionLabel(strap)}
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
      <StrapConnectionStatus />
      </div>
    </>
  );
}
