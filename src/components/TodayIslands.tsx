"use client";

import { useEffect, useState } from "react";
import { hasPersonalBody, loadAthlete } from "@/lib/athlete";
import { loadPlace } from "@/lib/place";

export function HideWithoutBody({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    setShow(!hasPersonalBody(loadAthlete()));
  }, []);
  if (!show) return null;
  return children;
}

export function EnvironmentLive({
  midsleepHour,
  children,
}: {
  midsleepHour: number | null;
  children: React.ReactNode;
}) {
  const [Card, setCard] = useState<React.ComponentType<{
    midsleepHour?: number | null;
  }> | null>(null);

  useEffect(() => {
    if (!loadPlace()) return;
    void import("./EnvironmentCard").then((mod) => setCard(() => mod.EnvironmentCard));
  }, []);

  if (!Card) return children;
  return <Card midsleepHour={midsleepHour} />;
}
