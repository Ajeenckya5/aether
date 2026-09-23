import { describe, expect, it } from "vitest";
import { labelFromReverse, reverseGeocodeUrl } from "./open-meteo";

describe("reverse geocode", () => {
  it("uses BigDataCloud and falls back to a near label", () => {
    expect(reverseGeocodeUrl(43.07, -89.4)).toContain("api.bigdatacloud.net");
    expect(reverseGeocodeUrl(43.07, -89.4)).not.toContain("/v1/reverse");
    expect(labelFromReverse({ city: "Madison", principalSubdivision: "Wisconsin", countryName: "United States" }, 43.07, -89.4)).toContain("Madison");
    expect(labelFromReverse(null, 43.07, -89.4)).toBe("Near 43.07, -89.40");
  });
});
