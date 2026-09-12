export const AETHER_BAND_UA = /AetherBand/i;

export function isAetherBandUserAgent(userAgent: string): boolean {
  return AETHER_BAND_UA.test(userAgent || "");
}

export function hasAetherNativeShell(
  input: { nativeShell?: boolean; userAgent?: string } = {},
): boolean {
  if (input.nativeShell) return true;
  if (input.userAgent && isAetherBandUserAgent(input.userAgent)) return true;
  if (typeof window === "undefined") return false;
  return Boolean((window as Window & { AetherNativeShell?: boolean }).AetherNativeShell);
}
