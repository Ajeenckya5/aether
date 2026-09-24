import { describe, expect, it } from "vitest";
import { buildAtlas } from "./atlas";
import { DEFAULT_ATHLETE } from "./athlete";
import { EMPTY_JOURNAL } from "./journal";
import { buildDemoDashboard } from "./mock";

describe("body atlas method notes", () => {
  it("does not name a strap brand", () => {
    const report = buildAtlas(buildDemoDashboard(), EMPTY_JOURNAL, DEFAULT_ATHLETE);
    for (const metric of report.metrics) {
      const note = [metric.group, metric.name, metric.display, metric.unit, metric.formula, metric.citation, metric.note ?? ""].join("\n");
      expect(note, metric.id).not.toMatch(/WHOOP/i);
    }
  });
});
