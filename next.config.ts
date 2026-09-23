import type { NextConfig } from "next";

const staticExport = process.env.STATIC_EXPORT === "1";
const configuredBase = process.env.NEXT_PUBLIC_BASE_PATH;
const basePath =
  configuredBase !== undefined ? configuredBase : staticExport ? "/aether" : "";

const nextConfig: NextConfig = {
  ...(staticExport
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "no-referrer" },
                { key: "X-Frame-Options", value: "DENY" },
                { key: "X-DNS-Prefetch-Control", value: "off" },
                {
                  key: "Permissions-Policy",
                  value:
                    "camera=(), microphone=(), usb=(), interest-cohort=(), geolocation=(self), bluetooth=(self)",
                },
              ],
            },
            {
              source: "/api/whoop/:path*",
              headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
            },
            {
              source: "/api/auth/:path*",
              headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
            },
          ];
        },
      }),
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_STATIC: staticExport ? "1" : "",
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL ||
      (staticExport ? "https://ajeenckya5.github.io/aether" : ""),
  },
};

export default nextConfig;
