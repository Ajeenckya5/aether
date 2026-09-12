import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aether",
    short_name: "Aether",
    description: "WHOOP band companion for phone and laptop — live tracking, builder, open lab.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0e0d0b",
    theme_color: "#0e0d0b",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
