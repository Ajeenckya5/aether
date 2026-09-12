"use client";

import { useCallback, useEffect, useState } from "react";
import { loadPlace, savePlace, type Place } from "@/lib/place";

export function usePlace() {
  const [place, setPlace] = useState<Place | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPlace(loadPlace());
    setReady(true);
  }, []);

  const updatePlace = useCallback((next: Place | null) => {
    savePlace(next);
    setPlace(next);
  }, []);

  return { place, ready, updatePlace };
}
