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

const SCRIPT_ESCAPES: Record<string, string> = {
  "<": "\\u003C",
  ">": "\\u003E",
  "/": "\\u002F",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/** A JavaScript string literal that cannot close an inline script tag. */
export function scriptString(value: string): string {
  return JSON.stringify(value).replace(/[<>/\u2028\u2029]/g, (char) => SCRIPT_ESCAPES[char] ?? char);
}

/** Anchor href with the base path and a trailing slash, for pages that are not Next links. */
export function siteHref(path: string): string {
  const hashAt = path.indexOf("#");
  const hash = hashAt >= 0 ? path.slice(hashAt) : "";
  const withoutHash = hashAt >= 0 ? path.slice(0, hashAt) : path;
  const queryAt = withoutHash.indexOf("?");
  const query = queryAt >= 0 ? withoutHash.slice(queryAt) : "";
  const base = queryAt >= 0 ? withoutHash.slice(0, queryAt) : withoutHash;
  const withSlash = base.endsWith("/") ? base : `${base}/`;
  return `${appPath(withSlash)}${query}${hash}`;
}
