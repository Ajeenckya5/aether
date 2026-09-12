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

/** WHOOP’s radio is closed. We refuse it by name instead of guessing its GATT. */
export function isWhoopBandName(name: string | null | undefined): boolean {
  return Boolean(name && /whoop/i.test(name));
}

export const WHOOP_BAND_REFUSAL =
  "The WHOOP band does not publish a Bluetooth heart-rate service. Aether will not reverse-engineer that radio, and it does not use the WHOOP cloud. Pair a Polar, Garmin, or Wahoo strap.";

export function explainBleError(
  err: unknown,
  bluetoothAvailable: boolean,
): string {
  if (!bluetoothAvailable) {
    return "This browser cannot do live Bluetooth. Use Chrome on an Android phone (from the home-screen app) or Chrome on a computer. iPhone Safari has no Web Bluetooth. Aether does not use the WHOOP cloud.";
  }
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: string }).name)
      : "";
  const message = err instanceof Error ? err.message : "";
  if (name === "NotFoundError") {
    return "No heart-rate strap found. Wear a Polar, Garmin, or Wahoo strap — not the WHOOP band — then tap Scan all devices.";
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
  if (/heart_rate|GATT|getPrimaryService|characteristic/i.test(message)) {
    return "That device is not a standard heart-rate strap. The WHOOP band cannot stream here. Use Polar, Garmin, or Wahoo.";
  }
  return message || "Could not connect. Use Android Chrome with a Polar/Garmin-class strap.";
}
