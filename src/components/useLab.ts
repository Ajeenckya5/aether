"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAtlas } from "@/lib/atlas";
import {
  DEFAULT_ATHLETE,
  loadAthlete,
  saveAthlete,
  type Athlete,
} from "@/lib/athlete";
import { analyzeDashboard } from "@/lib/intelligence";
import {
  EMPTY_JOURNAL,
  loadJournal,
  saveJournal,
  type JournalFlags,
} from "@/lib/journal";
import { useDashboard } from "./DataProvider";

export function useLab() {
  const { data, loading } = useDashboard();
  const [journal, setJournal] = useState<JournalFlags>(EMPTY_JOURNAL);
  const [athlete, setAthlete] = useState<Athlete>(DEFAULT_ATHLETE);

  useEffect(() => {
    setJournal(loadJournal());
    setAthlete(loadAthlete());
  }, []);

  const updateJournal = useCallback((patch: Partial<JournalFlags>) => {
    setJournal((current) => {
      const next = { ...current, ...patch };
      saveJournal(next);
      return next;
    });
  }, []);

  const updateAthlete = useCallback((patch: Partial<Athlete>) => {
    setAthlete((current) => {
      const next = { ...current, ...patch };
      saveAthlete(next);
      return next;
    });
  }, []);

  const report = useMemo(
    () => analyzeDashboard(data, journal, data.workouts),
    [data, journal],
  );

  const atlas = useMemo(
    () => buildAtlas(data, journal, athlete),
    [data, journal, athlete],
  );

  return {
    data,
    loading,
    journal,
    updateJournal,
    athlete,
    updateAthlete,
    report,
    atlas,
  };
}
