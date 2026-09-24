"use client";

import { useEffect, useState } from "react";
import type { EnvironmentSnapshot } from "@/lib/environment";
import { fetchEnvironment } from "@/lib/open-meteo";
import { currentFlags, loadRemoteFlags } from "@/lib/remote-config";
import { appPath } from "@/lib/site";
import { usePlace } from "./usePlace";

const REFRESH_MS = 60 * 60 * 1000;
const ENV_CACHE = "aether-env-cache-v1";

function readEnvCache(place: { lat: number; lon: number }): EnvironmentSnapshot | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(ENV_CACHE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EnvironmentSnapshot;
    if (!parsed?.weather || !parsed.outdoor) return null;
    if (Math.abs(parsed.lat - place.lat) > 0.02 || Math.abs(parsed.lon - place.lon) > 0.02) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeEnvCache(snapshot: EnvironmentSnapshot) {
  try {
    localStorage.setItem(ENV_CACHE, JSON.stringify(snapshot));
  } catch {
    /* private mode */
  }
}

export function useEnvironment() {
  const { place, ready, updatePlace } = usePlace();
  const [env, setEnv] = useState<EnvironmentSnapshot | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!place) {
      setEnv(null);
      return;
    }
    let cancelled = false;
    const cached = readEnvCache(place);
    if (cached) {
      setEnv(cached);
      setStale(true);
    }
    const load = () => {
      setLoading(true);
      setError(null);
      void fetchEnvironment(place.lat, place.lon)
        .then((snapshot) => {
          if (cancelled) return;
          setEnv(snapshot);
          setStale(false);
          writeEnvCache(snapshot);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          if (cached) {
            setEnv(cached);
            setStale(true);
            setError(null);
            return;
          }
          setEnv(null);
          setStale(false);
          setError(err instanceof Error ? err.message : "Environment failed");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    let lastFetch = 0;
    let interval = 0;
    let flagsReady = false;
    const refresh = () => {
      lastFetch = Date.now();
      load();
    };
    setLoading(true);
    void loadRemoteFlags(appPath("/remote-config.json")).then(() => {
      if (cancelled) return;
      flagsReady = true;
      if (!currentFlags().weather) {
        setLoading(false);
        setError("Weather is paused.");
        return;
      }
      refresh();
      interval = window.setInterval(refresh, REFRESH_MS);
    });
    const onVis = () => {
      if (!flagsReady || document.visibilityState !== "visible") return;
      if (!currentFlags().weather) return;
      if (Date.now() - lastFetch < REFRESH_MS) return;
      refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [place]);

  return { place, ready, updatePlace, env, stale, loading, error };
}
