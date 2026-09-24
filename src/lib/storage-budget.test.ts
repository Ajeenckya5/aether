import { describe, expect, it } from "vitest";
import {
  SHELL_BUDGET,
  SHELL_CACHE,
  STORAGE_BOOT,
  STORAGE_BUDGET,
  STORAGE_PRESSURE,
  formatMegabytes,
  oldestOwnedCaches,
} from "./storage-budget";

describe("storage budget", () => {
  it("keeps each app under 5 MB and starts eviction at 80 percent", () => {
    expect(STORAGE_BUDGET).toBe(5 * 1024 * 1024);
    expect(STORAGE_PRESSURE).toBe(0.8 * STORAGE_BUDGET);
    expect(SHELL_BUDGET).toBe(2 * 1024 * 1024);
  });

  it("formats a short megabyte label", () => {
    expect(formatMegabytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatMegabytes(0)).toBe("0.0 MB");
  });

  it("evicts older Aether caches before the current shell", () => {
    expect(
      oldestOwnedCaches(["job-autopilot-shell-3", "aether-shell-v0", SHELL_CACHE, "pact-shell-v1"]),
    ).toEqual(["aether-shell-v0"]);
  });

  it("boots from navigator.storage.estimate and only deletes Aether caches", () => {
    expect(STORAGE_BOOT).toContain("navigator.storage.estimate");
    expect(STORAGE_BOOT).toContain(String(STORAGE_PRESSURE));
    expect(STORAGE_BOOT).toContain('name.indexOf("aether-")===0&&name!==CURRENT');
  });
});
