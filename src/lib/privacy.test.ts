import { describe, expect, it } from "vitest";
import {
  isSameOriginRequest,
  privateStorageKeysFrom,
  roundCoords,
} from "./privacy";

describe("private coordinates", () => {
  it("rounds GPS to about a kilometer before leaving the phone", () => {
    expect(roundCoords(30.2672, -97.7431)).toEqual({ lat: 30.27, lon: -97.74 });
  });
});

describe("on-device storage", () => {
  it("only erases Aether keys, not unrelated site data", () => {
    expect(
      privateStorageKeysFrom([
        "aether-journal-v1",
        "aether-place-v1",
        "theme",
        "aether-live-logs-v1",
      ]),
    ).toEqual(["aether-journal-v1", "aether-place-v1", "aether-live-logs-v1"]);
  });
});

describe("mutating API calls", () => {
  it("rejects cross-site logout", () => {
    const req = new Request("http://127.0.0.1:3010/api/auth/logout", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(isSameOriginRequest(req)).toBe(false);
  });

  it("allows same-origin logout", () => {
    const req = new Request("http://127.0.0.1:3010/api/auth/logout", {
      method: "POST",
      headers: { origin: "http://127.0.0.1:3010" },
    });
    expect(isSameOriginRequest(req)).toBe(true);
  });
});
