import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/site";

export const dynamic = "force-static";

const root = BASE_PATH ? `${BASE_PATH}/` : "/";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aether",
    short_name: "Aether",
    description:
      "Phone app for recovery, live tracking, and an open lab. Your data stays in this browser.",
    start_url: root,
    scope: root,
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e0d0b",
    theme_color: "#0e0d0b",
    icons: [
      {
        src: `${BASE_PATH}/icon`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
