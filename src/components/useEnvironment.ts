"use client";

import { useEffect, useState } from "react";
import type { EnvironmentSnapshot } from "@/lib/environment";
import { usePlace } from "./usePlace";

export function useEnvironment() {
  const { place, ready, updatePlace } = usePlace();
  const [env, setEnv] = useState<EnvironmentSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!place) {
      setEnv(null);
      return;
    }
    let cancelled = false;
    const url = `/api/environment?lat=${place.lat}&lon=${place.lon}`;
    const load = () => {
      setLoading(true);
      setError(null);
      void fetch(url)
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "Environment failed");
          if (!cancelled) setEnv(body as EnvironmentSnapshot);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setEnv(null);
            setError(err instanceof Error ? err.message : "Environment failed");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const id = window.setInterval(load, 15 * 60 * 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [place]);

  return { place, ready, updatePlace, env, loading, error };
}
