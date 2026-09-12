import { describe, expect, it } from "vitest";
import { estimateBpmFromPpg, fingerLikelyOnLens, type PpgSample } from "./camera-hr";

function sineWave(bpm: number, seconds = 8, hz = 30): PpgSample[] {
  const period = 60 / bpm;
  const samples: PpgSample[] = [];
  const n = Math.round(seconds * hz);
  for (let i = 0; i < n; i++) {
    const t = (i / hz) * 1000;
    const v = 140 + 35 * Math.sin((2 * Math.PI * (t / 1000)) / period);
    samples.push({ t, v });
  }
  return samples;
}

describe("camera PPG bpm", () => {
  it("reads a 72 bpm sine as a plausible pulse", () => {
    const bpm = estimateBpmFromPpg(sineWave(72));
    expect(bpm).not.toBeNull();
    expect(bpm!).toBeGreaterThanOrEqual(66);
    expect(bpm!).toBeLessThanOrEqual(78);
  });

  it("waits until there is enough signal", () => {
    expect(estimateBpmFromPpg(sineWave(72, 0.4))).toBeNull();
  });

  it("treats a bright red frame as a finger on the lens", () => {
    expect(fingerLikelyOnLens(140)).toBe(true);
    expect(fingerLikelyOnLens(20)).toBe(false);
  });
});
