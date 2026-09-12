"use client";

import { useCallback, useEffect, useState } from "react";
import { loadPlace, savePlace, type Place } from "@/lib/place";
import { LOCAL_SYNC_EVENT } from "@/lib/sessions";

export function usePlace() {
  const [place, setPlace] = useState<Place | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => setPlace(loadPlace());
    refresh();
    setReady(true);
    window.addEventListener(LOCAL_SYNC_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LOCAL_SYNC_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const updatePlace = useCallback((next: Place | null) => {
    savePlace(next);
    setPlace(next);
  }, []);

  return { place, ready, updatePlace };
}
