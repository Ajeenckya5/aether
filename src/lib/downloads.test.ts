import { describe, expect, it } from "vitest";
import {
  buildDownloadUrls,
  installHref,
  storeListed,
} from "./downloads";

describe("download links", () => {
  it("points GitHub, ZIP, and clone at the public repo", () => {
    const urls = buildDownloadUrls();
    expect(urls.repoUrl).toBe("https://github.com/Ajeenckya5/aether");
    expect(urls.zipUrl).toBe(
      "https://github.com/Ajeenckya5/aether/archive/refs/heads/master.zip",
    );
    expect(urls.cloneUrl).toBe("https://github.com/Ajeenckya5/aether.git");
    expect(urls.apkUrl).toBe(
      "https://github.com/Ajeenckya5/aether/releases/download/android-sideload/Aether.apk",
    );
  });

  it("uses GitHub as source, and the live app URL for phone install until stores exist", () => {
    const urls = buildDownloadUrls();
    expect(storeListed("android", urls)).toBe(false);
    expect(storeListed("ios", urls)).toBe(false);
    expect(installHref("android", urls)).toBe("https://ajeenckya5.github.io/aether");
    expect(installHref("ios", urls)).toBe("https://ajeenckya5.github.io/aether");
    expect(installHref("github", urls)).toBe(urls.repoUrl);
  });

  it("switches Android and iOS buttons to the stores when listings exist", () => {
    const urls = buildDownloadUrls({
      playStoreUrl: "https://play.google.com/store/apps/details?id=app.aether",
      appStoreUrl: "https://apps.apple.com/app/aether/id000",
    });
    expect(storeListed("android", urls)).toBe(true);
    expect(storeListed("ios", urls)).toBe(true);
    expect(installHref("android", urls)).toContain("play.google.com");
    expect(installHref("ios", urls)).toContain("apps.apple.com");
    expect(installHref("github", urls)).toBe("https://github.com/Ajeenckya5/aether");
  });
});
