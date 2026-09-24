import { describe, expect, it } from "vitest";
import { appPath, PUBLIC_SITE, scriptString } from "./site";
import { coachSlugs } from "./static-params";

describe("public site paths", () => {
  it("keeps root-relative paths when there is no GitHub Pages base", () => {
    expect(appPath("/privacy")).toBe("/privacy");
  });

  it("points at the GitHub Pages origin so each browser keeps its own storage", () => {
    expect(PUBLIC_SITE).toBe("https://ajeenckya5.github.io/aether");
  });

  it("embeds a path in an inline script without a closing script tag", () => {
    expect(scriptString("</script>")).toBe('"\\u003C\\u002Fscript\\u003E"');
    expect(scriptString("/aether/hr-ring.js")).not.toContain("<");
    expect(scriptString("/aether/hr-ring.js")).not.toContain("/");
  });

  it("pre-renders only the known Coach library slugs", () => {
    expect(coachSlugs().length).toBeGreaterThan(3);
    expect(coachSlugs()).toContain("sunrise-mobility");
    expect(coachSlugs()).not.toContain("custom");
  });
});
