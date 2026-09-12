import { describe, expect, it } from "vitest";
import { appPath, PUBLIC_SITE } from "./site";
import { coachSlugs } from "./static-params";

describe("public site paths", () => {
  it("keeps root-relative paths when there is no GitHub Pages base", () => {
    expect(appPath("/privacy")).toBe("/privacy");
  });

  it("points at the GitHub Pages origin so each browser keeps its own storage", () => {
    expect(PUBLIC_SITE).toBe("https://ajeenckya5.github.io/aether");
  });

  it("pre-renders only the known Coach library slugs", () => {
    expect(coachSlugs().length).toBeGreaterThan(3);
    expect(coachSlugs()).toContain("sunrise-mobility");
    expect(coachSlugs()).not.toContain("custom");
  });
});
