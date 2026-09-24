import { describe, expect, it } from "vitest";
import {
  explainGeoError,
  GEO_PERMISSION_DENIED,
  GEO_POSITION_UNAVAILABLE,
  GEO_TIMEOUT,
  placeDisplayName,
  placeSourceLabel,
} from "./place";

describe("GPS errors do not throw away a saved city", () => {
  it("says the browser blocked GPS and keeps the city name", () => {
    expect(explainGeoError(GEO_PERMISSION_DENIED, "Madison, Wisconsin, United States")).toMatch(
      /blocked GPS/,
    );
    expect(explainGeoError(GEO_PERMISSION_DENIED, "Madison, Wisconsin, United States")).toMatch(
      /Madison/,
    );
  });

  it("distinguishes timeout and no-fix from a permission block", () => {
    expect(explainGeoError(GEO_TIMEOUT, null)).toMatch(/timed out/);
    expect(explainGeoError(GEO_POSITION_UNAVAILABLE, null)).toMatch(/No GPS fix/);
    expect(explainGeoError(GEO_PERMISSION_DENIED, null)).toMatch(/Search a city/);
  });

  it("shows the city and region, and coordinates only when the name is missing", () => {
    expect(
      placeDisplayName({
        name: "Madison, Wisconsin, United States",
        lat: 43.07,
        lon: -89.4,
      }),
    ).toBe("Madison, Wisconsin");
    expect(placeDisplayName({ name: "Near 43.07, -89.40", lat: 43.07, lon: -89.4 })).toBe(
      "Near 43.07, -89.40",
    );
  });

  it("labels GPS vs city search without implying an IP lookup", () => {
    expect(placeSourceLabel("gps")).toMatch(/GPS/);
    expect(placeSourceLabel("search")).toMatch(/City search/);
    expect(placeSourceLabel("ip")).toBe("Saved pin");
  });
});
