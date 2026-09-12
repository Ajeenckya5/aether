import { PUBLIC_SITE } from "./site";

/** Free iOS browser with Web Bluetooth. Aether itself is not on the App Store. */
export const BLUEFY_APP_STORE =
  "https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055";

export function isBluefyUserAgent(userAgent: string): boolean {
  return /Bluefy/i.test(userAgent);
}

export function bluefyOpenHref(pageUrl: string): string {
  return `bluefy://open?url=${encodeURIComponent(pageUrl)}`;
}

export function aetherPageUrl(): string {
  if (typeof window !== "undefined") return window.location.href;
  return PUBLIC_SITE;
}
