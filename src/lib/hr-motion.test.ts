import { describe, expect, it } from "vitest";
import { zoneFromHr } from "./live-math";
import { announceDue, smoothToward, zoneIndex } from "./hr-motion";

describe("heart-rate motion", () => {
  it("uses the same zone edges as the session math", () => {
    for (const bpm of [40, 90, 110, 130, 150, 170, 190]) {
      expect(zoneIndex(bpm, 190)).toBe(zoneFromHr(bpm, 190));
    }
  });

  it("eases toward the strap value and snaps when motion is reduced", () => {
    const next = smoothToward(60, 120, 16, 280);
    expect(next).toBeGreaterThan(60);
    expect(next).toBeLessThan(120);
    expect(smoothToward(60, 120, 16, 0)).toBe(120);
  });

  it("holds accessible text for 15 seconds", () => {
    expect(announceDue(10_000, 0)).toBe(false);
    expect(announceDue(15_000, 0)).toBe(true);
  });
});
