"use client";

import { useEffect, useState } from "react";
import { useLiveHeartRate } from "./heart-rate-context";
import { useDevice } from "./DeviceChrome";
import {
  deriveStrapConnection,
  strapActionLabel,
  type StrapConnection,
} from "@/lib/strap-connection";

export function useStrapConnection(): StrapConnection {
  const hr = useLiveHeartRate();
  const device = useDevice();
  const [probed, setProbed] = useState(false);
  useEffect(() => setProbed(true), []);
  return deriveStrapConnection({
    bluetooth: probed ? device.bluetooth || device.nativeShell : null,
    status: hr.status,
    message: hr.message,
    deviceName: hr.deviceName,
    batteryPct: hr.batteryPct,
    bpm: hr.bpm,
  });
}

export function StrapConnectionStatus() {
  const view = useStrapConnection();
  return (
    <p
      data-strap-state={view.state}
      data-camera-fault={view.state === "camera-error" ? view.fault : undefined}
      className="text-sm text-muted"
    >
      {view.detail}
    </p>
  );
}

export { strapActionLabel };
