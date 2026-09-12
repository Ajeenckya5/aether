import { describe, expect, it } from "vitest";
import { sampleDataNote, whoopCompareLabel } from "./whoop-source";

describe("sample vs live WHOOP labels", () => {
  it("does not call demo scores WHOOP until the account is connected", () => {
    expect(whoopCompareLabel(false)).toBe("Sample");
    expect(whoopCompareLabel(true)).toBe("WHOOP");
    expect(sampleDataNote(false)).toMatch(/sample/i);
    expect(sampleDataNote(true)).toBeNull();
  });
});
