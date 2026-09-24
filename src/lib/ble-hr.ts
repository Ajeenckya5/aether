import { STANDARD_VITAL_SERVICES } from "./ble-vitals";

export const HEART_RATE_SERVICE = "heart_rate";
export const HEART_RATE_MEASUREMENT = "heart_rate_measurement";
export const BATTERY_SERVICE = "battery_service";
export const BATTERY_LEVEL = "battery_level";

const LIVE_SERVICES = [
  HEART_RATE_SERVICE,
  BATTERY_SERVICE,
  ...STANDARD_VITAL_SERVICES,
];

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
      optionalServices: LIVE_SERVICES,
    };
  }
  return {
    filters: STRAP_FILTERS,
    optionalServices: LIVE_SERVICES,
  };
}

export type HeartRateSample = {
  bpm: number;
  rrMs: number[];
};

const HR_UINT16 = 0x1;
const HR_ENERGY = 0x8;
const HR_RR = 0x10;

/** Bluetooth Heart Rate Measurement (GATT 0x2A37) — bpm plus optional R-R. */
export function parseHeartRateMeasurement(data: DataView): HeartRateSample | null {
  if (data.byteLength < 2) return null;
  const flags = data.getUint8(0);
  let offset = 1;
  let bpm: number;
  if (flags & HR_UINT16) {
    if (data.byteLength < 3) return null;
    bpm = data.getUint16(offset, true);
    offset += 2;
  } else {
    bpm = data.getUint8(offset);
    offset += 1;
  }
  if (flags & HR_ENERGY) {
    if (data.byteLength < offset + 2) return { bpm, rrMs: [] };
    offset += 2;
  }
  const rrMs: number[] = [];
  if (flags & HR_RR) {
    while (offset + 2 <= data.byteLength) {
      rrMs.push((data.getUint16(offset, true) / 1024) * 1000);
      offset += 2;
    }
  }
  return { bpm, rrMs };
}

export function parseHeartRate(data: DataView): number | null {
  return parseHeartRateMeasurement(data)?.bpm ?? null;
}

/** RMSSD in milliseconds from successive R-R intervals. */
export function rmssdMs(rrMs: number[]): number | null {
  if (rrMs.length < 3) return null;
  let sum = 0;
  let n = 0;
  for (let i = 1; i < rrMs.length; i++) {
    const d = rrMs[i] - rrMs[i - 1];
    sum += d * d;
    n += 1;
  }
  if (n === 0) return null;
  const value = Math.sqrt(sum / n);
  return Number.isFinite(value) ? value : null;
}

/** SDNN in milliseconds — standard deviation of R-R intervals. */
export function sdnnMs(rrMs: number[]): number | null {
  if (rrMs.length < 3) return null;
  const mean = rrMs.reduce((a, b) => a + b, 0) / rrMs.length;
  let sum = 0;
  for (const rr of rrMs) sum += (rr - mean) ** 2;
  const value = Math.sqrt(sum / (rrMs.length - 1));
  return Number.isFinite(value) ? value : null;
}

/** Drop implausible or ectopic R-R beats before HRV. */
export function cleanRrIntervals(rrMs: number[]): number[] {
  const out: number[] = [];
  for (const rr of rrMs) {
    if (rr < 300 || rr > 2000) continue;
    const prev = out[out.length - 1];
    if (prev != null && Math.abs(rr - prev) / prev > 0.25) continue;
    out.push(rr);
  }
  return out;
}

export function isPlausibleHr(bpm: number): boolean {
  return bpm > 20 && bpm < 240;
}

export type BandConnectionPhase =
  | "idle"
  | "requesting"
  | "connected"
  | "unavailable"
  | "cancelled";

export function bandConnectionPhase(
  status: string,
  message: string | null,
): BandConnectionPhase {
  if (status === "live" || status === "camera") return "connected";
  if (status === "connecting") return "requesting";
  if (status === "error") {
    return message && /cancel/i.test(message) ? "cancelled" : "unavailable";
  }
  return "idle";
}

export function isWhoopBandName(name: string | null | undefined): boolean {
  return Boolean(name && /whoop/i.test(name));
}

/** Public Bluetooth Heart Rate (0x180D) — the same open GATT Goose also reads for live bpm. */
export const WHOOP_PUBLIC_HR =
  "The strap is streaming the public Heart Rate service (Bluetooth 180D): live bpm, R-R/HRV when the band sends it, and battery if exposed. Aether also asks for the standard pulse-oximeter and thermometer services — if this firmware exposes them, SpO2 and skin temp appear. Leave this page connected overnight for Aether sleep from that stream. A strap’s private recovery score stays on its own radio.";

export const WHOOP_NO_PUBLIC_HR =
  "This strap did not expose the public Heart Rate service in this browser. Aether only uses that open GATT for live bpm. Tap Scan all devices and pick it again.";

export function explainCameraError(err: unknown): string {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: string }).name)
      : "";
  if (name === "NotAllowedError") {
    return "Camera permission was denied. Allow the camera for this site, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera is available on this device.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "The camera is in use by another app. Close that app and try again.";
  }
  if (name === "SecurityError") {
    return "The camera needs a secure page. Open the installed app or https.";
  }
  return "Could not start the camera.";
}

export function explainBleError(
  err: unknown,
  bluetoothAvailable: boolean,
): string {
  if (!bluetoothAvailable) {
    return "This browser cannot do live Bluetooth. On iPhone open Aether in Bluefy (free Web BLE browser). On Android or a laptop use Chrome or Edge.";
  }
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: string }).name)
      : "";
  const message = err instanceof Error ? err.message : "";
  if (name === "NotFoundError") {
    return "No heart-rate strap found. Wear the strap, then tap Scan all devices.";
  }
  if (name === "SecurityError" || /secure|https/i.test(message)) {
    return "Bluetooth needs the installed phone app (home-screen icon) or localhost. HTTP on a LAN address will not pair.";
  }
  if (name === "NetworkError") {
    return "The strap dropped Bluetooth. Aether will keep retrying. Wear the band and keep this screen open.";
  }
  if (name === "NotAllowedError" || /cancel|abort/i.test(message)) {
    return "Pairing cancelled. Tap Connect a heart-rate strap to try again.";
  }
  if (message === WHOOP_NO_PUBLIC_HR || (/public Heart Rate/i.test(message) && /did not expose/i.test(message))) {
    return WHOOP_NO_PUBLIC_HR;
  }
  if (/heart_rate|GATT|getPrimaryService|characteristic/i.test(message)) {
    return "That device did not expose a standard heart-rate service. Tap Scan all devices. Aether uses public Heart Rate GATT only.";
  }
  return message || "Could not connect. Use Chrome or Edge on Android with a Polar/Garmin-class strap.";
}
