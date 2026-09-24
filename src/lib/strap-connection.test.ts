import { describe, expect, it } from "vitest";
import { explainCameraError } from "./ble-hr";
import { deriveStrapConnection, type StrapSignals } from "./strap-connection";

const base: StrapSignals = {
  bluetooth: true,
  status: "off",
  message: null,
  deviceName: null,
  batteryPct: null,
  bpm: null,
};

describe("strap connection", () => {
  it("is unsupported when this browser has no Bluetooth", () => {
    const view = deriveStrapConnection({ ...base, bluetooth: false });
    expect(view.state).toBe("unsupported");
  });

  it("stays idle until Bluetooth has been probed", () => {
    expect(deriveStrapConnection({ ...base, bluetooth: null }).state).toBe("idle");
  });

  it("is requesting while the chooser is open", () => {
    const view = deriveStrapConnection({ ...base, status: "connecting", message: null });
    expect(view.state).toBe("requesting");
    if (view.state === "requesting") expect(view.detail).toMatch(/Requesting/);
  });

  it("is connected and names the battery", () => {
    const view = deriveStrapConnection({
      ...base,
      status: "live",
      deviceName: "Polar H10",
      batteryPct: 81,
      bpm: 62,
    });
    expect(view).toMatchObject({
      state: "connected",
      name: "Polar H10",
      batteryPct: 81,
      bpm: 62,
    });
    if (view.state === "connected") expect(view.detail).toBe("Polar H10, 81% battery");
  });

  it("says the battery was not reported when the strap omits it", () => {
    const view = deriveStrapConnection({ ...base, status: "live", deviceName: "Polar H10" });
    if (view.state === "connected") expect(view.detail).toBe("Polar H10, battery not reported");
  });

  it("is cancelled when the person dismisses the chooser", () => {
    const view = deriveStrapConnection({
      ...base,
      status: "error",
      message: "Pairing cancelled. Tap Connect a heart-rate strap to try again.",
    });
    expect(view.state).toBe("cancelled");
  });

  it("is lost and retrying after the link drops", () => {
    const view = deriveStrapConnection({
      ...base,
      status: "connecting",
      message: "Link dropped. Keeping Polar H10 connected…",
    });
    expect(view).toMatchObject({ state: "lost", retrying: true });
  });

  it("retries when the strap is not in range yet", () => {
    const view = deriveStrapConnection({
      ...base,
      status: "connecting",
      message: "Band not in range yet. Keeping the strap connected…",
    });
    expect(view.state).toBe("lost");
  });

  it("is an error for a device that has no public heart-rate service", () => {
    const view = deriveStrapConnection({
      ...base,
      status: "error",
      message: "That device did not expose a standard heart-rate service.",
    });
    expect(view.state).toBe("error");
  });

  it.each([
    ["NotAllowedError", "permission"],
    ["NotFoundError", "missing"],
    ["OverconstrainedError", "missing"],
    ["NotReadableError", "busy"],
    ["AbortError", "busy"],
    ["SecurityError", "insecure"],
    ["UnknownError", "unknown"],
  ] as const)("maps camera %s to %s", (name, fault) => {
    const message = explainCameraError({ name });
    const view = deriveStrapConnection({ ...base, status: "error", message });
    expect(view).toMatchObject({ state: "camera-error", fault, detail: message });
  });

  it("shows the camera pulse while the camera is running", () => {
    const view = deriveStrapConnection({ ...base, status: "camera", bpm: 70 });
    expect(view).toMatchObject({ state: "camera", bpm: 70 });
  });
});
