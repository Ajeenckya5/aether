import { describe, expect, it } from "vitest";
import {
  parseBlePair,
  pickGrantedDevice,
  reconnectDelayMs,
} from "./ble-pair";

describe("remembered WHOOP pairing", () => {
  it("restores a keep-alive record", () => {
    expect(parseBlePair(null)).toBeNull();
    expect(
      parseBlePair(JSON.stringify({ id: "dev-1", name: "WHOOP 4.0", keepAlive: true })),
    ).toEqual({ id: "dev-1", name: "WHOOP 4.0", keepAlive: true });
    expect(parseBlePair("{")).toBeNull();
  });

  it("picks the saved band from Chrome's granted device list", () => {
    const granted = [
      { id: "polar", name: "Polar H10" },
      { id: "whoop", name: "WHOOP 4.0" },
    ];
    expect(
      pickGrantedDevice(granted, { id: "whoop", name: "WHOOP 4.0", keepAlive: true })?.id,
    ).toBe("whoop");
    expect(pickGrantedDevice(granted, null)?.id).toBe("whoop");
  });

  it("backs off reconnects without giving up", () => {
    expect(reconnectDelayMs(0)).toBe(500);
    expect(reconnectDelayMs(3)).toBe(4000);
    expect(reconnectDelayMs(20)).toBe(12000);
  });
});
