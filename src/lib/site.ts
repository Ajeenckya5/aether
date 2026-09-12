export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const IS_STATIC = process.env.NEXT_PUBLIC_STATIC === "1";
export const PUBLIC_SITE =
  process.env.NEXT_PUBLIC_SITE_URL || "https://ajeenckya5.github.io/aether";

export function isStaticSite(): boolean {
  return IS_STATIC;
}

/** Prefix a root-relative path for GitHub Pages (`/aether`). Link hrefs are handled by Next. */
export function appPath(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}
