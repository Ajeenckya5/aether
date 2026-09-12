export const HEART_RATE_SERVICE = "heart_rate";
export const HEART_RATE_MEASUREMENT = "heart_rate_measurement";

export const STRAP_FILTERS: Array<{ services?: string[]; namePrefix?: string }> = [
  { services: [HEART_RATE_SERVICE] },
  { namePrefix: "Polar" },
  { namePrefix: "Garmin" },
  { namePrefix: "Wahoo" },
  { namePrefix: "TICKR" },
  { namePrefix: "Tickr" },
  { namePrefix: "HRM" },
  { namePrefix: "Coospo" },
  { namePrefix: "Magene" },
  { namePrefix: "Scosche" },
  { namePrefix: "WHOOP" },
  { namePrefix: "Whoop" },
];

export function heartRateRequestOptions(scanAll: boolean): {
  filters?: Array<{ services?: string[]; namePrefix?: string }>;
  optionalServices: string[];
  acceptAllDevices?: boolean;
} {
  if (scanAll) {
    return {
      acceptAllDevices: true,
      optionalServices: [HEART_RATE_SERVICE],
    };
  }
  return {
    filters: STRAP_FILTERS,
    optionalServices: [HEART_RATE_SERVICE],
  };
}

/** Bluetooth Heart Rate Measurement (GATT 0x2A37). */
export function parseHeartRate(data: DataView): number | null {
  if (data.byteLength < 2) return null;
  const flags = data.getUint8(0);
  if (flags & 0x1) {
    if (data.byteLength < 3) return null;
    return data.getUint16(1, true);
  }
  return data.getUint8(1);
}

export function isPlausibleHr(bpm: number): boolean {
  return bpm > 20 && bpm < 240;
}

export function isWhoopBandName(name: string | null | undefined): boolean {
  return Boolean(name && /whoop/i.test(name));
}

/** Public Bluetooth Heart Rate (0x180D) — the same open GATT Goose also reads for live bpm. */
export const WHOOP_PUBLIC_HR =
  "WHOOP is using the public Heart Rate service (Bluetooth 180D). Live bpm can stream here. Overnight recovery, sleep, and strain packets use WHOOP’s private radio — a native iOS app like Goose can parse that; a website cannot, and Aether will not copy that protocol.";

export const WHOOP_NO_PUBLIC_HR =
  "This WHOOP did not expose the public Heart Rate service in this browser. Aether only uses that open GATT for live bpm. Full band history needs a native iOS companion, not a website. Keep the band in the official WHOOP app for recovery/sleep, or tap Scan all devices and pick it again.";

export function explainBleError(
  err: unknown,
  bluetoothAvailable: boolean,
): string {
  if (!bluetoothAvailable) {
    return "This browser cannot do live Bluetooth. Use Chrome or Edge on an Android phone (from the home-screen app) or a computer. iPhone Safari and iPhone Chrome have no Web Bluetooth — native iOS apps can use CoreBluetooth instead.";
  }
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: string }).name)
      : "";
  const message = err instanceof Error ? err.message : "";
  if (name === "NotFoundError") {
    return "No heart-rate strap found. Wear the WHOOP band or a Polar / Garmin / Wahoo strap, then tap Scan all devices.";
  }
  if (name === "SecurityError" || /secure|https/i.test(message)) {
    return "Bluetooth needs the installed phone app (home-screen icon) or localhost. HTTP on a LAN address will not pair.";
  }
  if (name === "NetworkError") {
    return "The strap dropped Bluetooth. Put it on, wake it, and pair again.";
  }
  if (name === "NotAllowedError" || /cancel|abort/i.test(message)) {
    return "Pairing cancelled. Tap Connect over Bluetooth to try again.";
  }
  if (/WHOOP/i.test(message) && /public Heart Rate|did not expose/i.test(message)) {
    return WHOOP_NO_PUBLIC_HR;
  }
  if (/heart_rate|GATT|getPrimaryService|characteristic/i.test(message)) {
    return "That device did not expose a standard heart-rate service. If it is a WHOOP, tap Scan all devices. Aether uses public Heart Rate GATT only.";
  }
  return message || "Could not connect. Use Chrome or Edge on Android with a Polar/Garmin-class strap.";
}
