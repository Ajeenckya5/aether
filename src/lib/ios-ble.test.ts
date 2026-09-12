import { describe, expect, it } from "vitest";
import { BLUEFY_APP_STORE, bluefyOpenHref, isBluefyUserAgent } from "./ios-ble";

describe("iPhone Web Bluetooth via Bluefy", () => {
  it("builds a Bluefy deep link for the live Aether page", () => {
    expect(isBluefyUserAgent("Mozilla/5.0 Bluefy/1.0")).toBe(true);
    expect(isBluefyUserAgent("CriOS/129")).toBe(false);
    expect(bluefyOpenHref("https://ajeenckya5.github.io/aether/")).toContain(
      "bluefy://open?url=",
    );
    expect(BLUEFY_APP_STORE).toMatch(/id1492822055/);
  });
});
