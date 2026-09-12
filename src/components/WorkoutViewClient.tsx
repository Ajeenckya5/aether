"use client";

import { useSearchParams } from "next/navigation";
import { WorkoutDetailView } from "./WorkoutDetailView";

export function WorkoutViewClient() {
  const id = useSearchParams().get("id") ?? "";
  return <WorkoutDetailView id={id} />;
}
