import { describe, expect, it } from "vitest";
import { countPayload, eventBody, sanitizeFlags } from "./remote-config";

describe("remote config", () => {
  it("keeps only known boolean flags", () => {
    expect(sanitizeFlags({ haptics: false, bpm: 140, id: "abc", counts: true })).toEqual({
      liveHr: true,
      haptics: false,
      chips: true,
      weather: true,
      trends: true,
      counts: true,
    });
  });

  it("counts an allowlisted name and nothing else", () => {
    expect(countPayload("zone")).toEqual({ name: "zone" });
    expect(countPayload("bpm")).toBeNull();
    expect(countPayload("user-1")).toBeNull();
    expect(eventBody({ name: "chip" })).toEqual({ name: "chip" });
    expect(eventBody({ name: "chip", bpm: 140 })).toBeNull();
    expect(eventBody({ name: "chip", id: "abc" })).toBeNull();
  });
});
