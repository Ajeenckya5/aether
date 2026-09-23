import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/site";

export const dynamic = "force-static";

const root = BASE_PATH ? `${BASE_PATH}/` : "/";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: root,
    name: "Aether",
    short_name: "Aether",
    description:
      "Phone app for recovery, live tracking, and an open lab. Your data stays on this device.",
    start_url: root,
    scope: root,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#0e0d0b",
    theme_color: "#0e0d0b",
    prefer_related_applications: false,
    categories: ["health", "sports", "fitness"],
    launch_handler: {
      client_mode: ["focus-existing", "navigate-existing"],
    },
    icons: [
      {
        src: `${BASE_PATH}/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${BASE_PATH}/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${BASE_PATH}/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Today", short_name: "Today", url: root },
      { name: "Lab", short_name: "Lab", url: `${BASE_PATH}/lab` },
      { name: "Track live", short_name: "Live", url: `${BASE_PATH}/coach/live` },
    ],
  };
}
