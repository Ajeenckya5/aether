import { describe, expect, it } from "vitest";
import { outdoorRank } from "./climate";

describe("outdoor rank", () => {
  it("orders go below caution below indoor", () => {
    expect(outdoorRank("go")).toBeLessThan(outdoorRank("caution"));
    expect(outdoorRank("caution")).toBeLessThan(outdoorRank("indoor"));
  });
});