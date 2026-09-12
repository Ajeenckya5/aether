"use client";

import dynamic from "next/dynamic";

const WorkoutBuilder = dynamic(
  () => import("./WorkoutBuilder").then((mod) => ({ default: mod.WorkoutBuilder })),
  {
    ssr: false,
    loading: () => (
      <p className="px-5 pt-16 text-sm text-muted">Opening builder…</p>
    ),
  },
);

export function BuildClient() {
  return <WorkoutBuilder />;
}
