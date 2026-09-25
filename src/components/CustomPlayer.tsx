"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { CoachSession } from "@/lib/coach";
import { asCoachSession, getCustomWorkout } from "@/lib/sessions";
import { CoachPlayer } from "./CoachPlayer";

export function CustomPlayer() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const [session, setSession] = useState<CoachSession | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const workout = id ? getCustomWorkout(id) : undefined;
    if (!workout) {
      setMissing(true);
      return;
    }
    setSession(asCoachSession(workout));
  }, [id]);

  if (missing) {
    return (
      <div className="px-5 pt-16 text-sm text-muted">
        That custom workout is not on this device.{" "}
        <Link href="/coach/build" className="text-lime underline underline-offset-2">
          Build one
        </Link>
        .
      </div>
    );
  }

  if (!session) {
    return <p className="px-5 pt-16 text-sm text-muted">Loading session…</p>;
  }

  return <CoachPlayer session={session} liveHref={`/coach/live?kind=custom&id=${id}`} />;
}
