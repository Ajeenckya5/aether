"use client";

import { useSearchParams } from "next/navigation";
import { SleepDetailView } from "./SleepDetailView";

export function SleepViewClient() {
  const id = useSearchParams().get("id") ?? "";
  return <SleepDetailView id={id} />;
}
