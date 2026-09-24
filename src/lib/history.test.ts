import { describe, expect, it, vi } from "vitest";
import { archiveWindow, ciphertextBody, splitByAge, DAY_MS, RETENTION_MS } from "./history";
import { rememberNight } from "./history-store";
import type { OvernightSummary } from "./overnight";

describe("device history", () => {
  it("keeps 90 days on the device and marks the rest for backup", () => {
    const now = Date.UTC(2026, 8, 23);
    const rows = [
      { at: now - 10 * DAY_MS, id: "recent" },
      { at: now - RETENTION_MS, id: "edge" },
      { at: now - RETENTION_MS - DAY_MS, id: "old" },
    ];
    const split = splitByAge(rows, now);
    expect(split.recent.map((row) => row.id)).toEqual(["recent", "edge"]);
    expect(split.older.map((row) => row.id)).toEqual(["old"]);
  });

  it("asks the backup only when a trend reaches past the on-device window", () => {
    const now = Date.UTC(2026, 8, 23);
    expect(archiveWindow(now, 28)).toBeNull();
    expect(archiveWindow(now, 7)).toBeNull();
    const window = archiveWindow(now, 90);
    expect(window).toEqual({ from: now - 132 * DAY_MS, to: now - 90 * DAY_MS });
  });

  it("accepts ciphertext and rejects health fields", () => {
    expect(ciphertextBody({ v: 1, iv: "AAAA", ct: "BBBB" })).toEqual({ v: 1, iv: "AAAA", ct: "BBBB" });
    expect(ciphertextBody({ v: 1, iv: "AAAA", ct: "BBBB", bpm: 140 })).toBeNull();
    expect(ciphertextBody({ v: 1, iv: "AAAA", ct: "BBBB", id: "user" })).toBeNull();
    expect(ciphertextBody({ v: 1, iv: "not base64!", ct: "BBBB" })).toBeNull();
  });

  it("keeps an old night as ciphertext, with the marker absent from the backup body", async () => {
    const mem = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => mem.get(key) ?? null,
      setItem: (key: string, value: string) => mem.set(key, value),
      removeItem: (key: string) => mem.delete(key),
    });
    const old = Date.now() - 100 * DAY_MS;
    const night: OvernightSummary = {
      start: old - 8 * 3600_000,
      end: old,
      restMs: 7 * 3600_000,
      awakeMs: 20 * 60_000,
      quietMs: 4 * 3600_000,
      deepMs: 2 * 3600_000,
      activeMs: 1 * 3600_000,
      cycles: 4,
      disturbances: 1,
      staged: true,
      epochs: [],
      rmssd: 88,
      restHr: 424242,
      recovery: 70,
      spo2: null,
      skinTempC: null,
      pointCount: 80,
    };
    await rememberNight(night);
    const hot = mem.get("aether-history-v1") ?? "";
    const queue = mem.get("aether-history-queue-v1") ?? "";
    expect(hot).not.toContain("424242");
    expect(queue).toContain('"ct"');
    expect(queue).not.toContain("424242");
    vi.unstubAllGlobals();
  });
});
