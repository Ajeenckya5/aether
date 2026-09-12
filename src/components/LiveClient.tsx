"use client";

import dynamic from "next/dynamic";

const LiveTracker = dynamic(
  () => import("./LiveTracker").then((mod) => ({ default: mod.LiveTracker })),
  {
    ssr: false,
    loading: () => (
      <p className="px-5 pt-16 text-sm text-muted">Opening live track…</p>
    ),
  },
);

export function LiveClient() {
  return <LiveTracker />;
}
