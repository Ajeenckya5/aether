"use client";

import { useEffect, useState } from "react";
import { useLiveHeartRate } from "./heart-rate-context";

/** Swap in the full live Today view only after a strap or camera session exists. */
export function LiveToday({ children }: { children: React.ReactNode }) {
  const hr = useLiveHeartRate();
  const [View, setView] = useState<React.ComponentType | null>(null);
  const live = hr.status !== "off" || hr.fromBand || hr.overnight != null;

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    void import("./TodayView").then((mod) => {
      if (!cancelled) setView(() => mod.TodayView);
    });
    return () => {
      cancelled = true;
    };
  }, [live]);

  if (View) return <View />;
  return children;
}
