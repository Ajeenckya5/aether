export type StrapStatus = "off" | "connecting" | "live" | "camera" | "practice" | "error";

export type CameraFault = "permission" | "missing" | "busy" | "insecure" | "unknown";

export type StrapConnection =
  | { state: "unsupported"; detail: string }
  | { state: "requesting"; detail: string }
  | { state: "connected"; name: string; batteryPct: number | null; bpm: number | null; detail: string }
  | { state: "cancelled"; detail: string }
  | { state: "lost"; retrying: true; detail: string }
  | { state: "error"; detail: string }
  | { state: "camera"; bpm: number | null; detail: string }
  | { state: "camera-error"; fault: CameraFault; detail: string }
  | { state: "idle"; detail: string };

export type StrapSignals = {
  /** null until the browser has been probed, so the first paint stays idle. */
  bluetooth: boolean | null;
  status: StrapStatus;
  message: string | null;
  deviceName: string | null;
  batteryPct: number | null;
  bpm: number | null;
};

const UNSUPPORTED =
  "This browser cannot pair a strap. Use Chrome or Edge, or install the phone app.";

export function cameraFaultFromMessage(message: string): CameraFault | null {
  if (/permission was denied/i.test(message)) return "permission";
  if (/no camera is available/i.test(message)) return "missing";
  if (/camera is in use/i.test(message)) return "busy";
  if (/camera needs a secure page/i.test(message)) return "insecure";
  if (/could not start the camera/i.test(message)) return "unknown";
  return null;
}

function lostMessage(message: string | null): boolean {
  if (!message) return false;
  return /link dropped|not in range|keep retrying|keeping .+ connected/i.test(message);
}

function batteryText(batteryPct: number | null): string {
  if (batteryPct == null || !Number.isFinite(batteryPct)) return "battery not reported";
  return `${Math.round(batteryPct)}% battery`;
}

export function deriveStrapConnection(input: StrapSignals): StrapConnection {
  if (input.status === "camera") {
    const bpm = input.bpm;
    return {
      state: "camera",
      bpm,
      detail: bpm == null ? "Camera pulse" : `${bpm} bpm from the camera`,
    };
  }
  const fault = input.message ? cameraFaultFromMessage(input.message) : null;
  if (input.status === "error" && fault) {
    return { state: "camera-error", fault, detail: input.message ?? "Could not start the camera." };
  }
  if (input.bluetooth === false && input.status !== "live") {
    return { state: "unsupported", detail: UNSUPPORTED };
  }
  if (input.status === "live") {
    const name = input.deviceName?.trim() || "Heart-rate strap";
    const batteryPct =
      input.batteryPct != null && Number.isFinite(input.batteryPct) ? input.batteryPct : null;
    return {
      state: "connected",
      name,
      batteryPct,
      bpm: input.bpm,
      detail: `${name}, ${batteryText(batteryPct)}`,
    };
  }
  if (input.status === "connecting" && lostMessage(input.message)) {
    return {
      state: "lost",
      retrying: true,
      detail: input.message?.trim() || "Strap lost. Retrying…",
    };
  }
  if (input.status === "connecting") {
    return { state: "requesting", detail: "Requesting the strap…" };
  }
  if (input.status === "error" && input.message && /cancel/i.test(input.message)) {
    return { state: "cancelled", detail: input.message };
  }
  if (input.status === "error") {
    return { state: "error", detail: input.message?.trim() || "Could not connect." };
  }
  return { state: "idle", detail: "Not connected" };
}

export function strapActionLabel(view: StrapConnection): string {
  switch (view.state) {
    case "unsupported":
      return "Bluetooth unavailable";
    case "requesting":
      return "Requesting the strap…";
    case "connected":
      return view.bpm == null ? view.detail : `${view.bpm} bpm · ${batteryText(view.batteryPct)}`;
    case "cancelled":
      return "Pairing cancelled";
    case "lost":
      return "Retrying the strap…";
    case "error":
      return "Could not connect";
    case "camera":
      return view.detail;
    case "camera-error":
      return "Camera unavailable";
    case "idle":
      return "Connect a heart-rate strap";
  }
}
