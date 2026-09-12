"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAtlas } from "@/lib/atlas";
import { estimateBioAge } from "@/lib/bio-age";
import { useLiveHeartRate } from "./LiveHeartRate";
import {
  DEFAULT_ATHLETE,
  loadAthlete,
  saveAthlete,
  sanitizeAthlete,
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
  const hr = useLiveHeartRate();
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
      const next = sanitizeAthlete({ ...current, ...patch });
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

  const bioAge = useMemo(
    () =>
      estimateBioAge(data, athlete, {
        rmssdMs: hr.status === "live" ? hr.rmssd : null,
        restHr: hr.status === "live" ? hr.restHr : null,
      }),
    [athlete, data, hr.restHr, hr.rmssd, hr.status],
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
    bioAge,
  };
}
