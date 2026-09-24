"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { estimateBioAge } from "@/lib/bio-age";
import { useLiveHeartRate } from "./heart-rate-context";
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
import { overlayDashboard } from "@/lib/band-live";
import { mergeArchived, type StoredRecord } from "@/lib/history";
import { loadForTrend } from "@/lib/history-store";
import { useDashboard } from "./DataProvider";

export function useLab(trendDays: 7 | 28 | 90 = 28) {
  const { data: remote, loading } = useDashboard();
  const hr = useLiveHeartRate();
  const [journal, setJournal] = useState<JournalFlags>(EMPTY_JOURNAL);
  const [athlete, setAthlete] = useState<Athlete>(DEFAULT_ATHLETE);
  const [archived, setArchived] = useState<StoredRecord[]>([]);

  useEffect(() => {
    setJournal(loadJournal());
    setAthlete(loadAthlete());
  }, []);

  useEffect(() => {
    let cancel = false;
    void loadForTrend(trendDays).then((rows) => {
      if (!cancel) setArchived(rows);
    });
    return () => {
      cancel = true;
    };
  }, [trendDays]);

  const data = useMemo(
    () =>
      mergeArchived(
        overlayDashboard(remote, {
          rmssd: hr.rmssd,
          sdnn: hr.sdnn,
          restHr: hr.restHr,
          bpm: hr.bpm,
          batteryPct: hr.batteryPct,
          rrCount: hr.rrCount,
          deviceName: hr.deviceName,
          spo2: hr.spo2,
          skinTempC: hr.skinTempC,
          overnight: hr.overnight,
          at: 0,
        }),
        archived,
      ),
    [
      archived,
      hr.batteryPct,
      hr.bpm,
      hr.deviceName,
      hr.overnight,
      hr.restHr,
      hr.rmssd,
      hr.rrCount,
      hr.sdnn,
      hr.skinTempC,
      hr.spo2,
      remote,
    ],
  );

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

  const bioAge = useMemo(
    () =>
      estimateBioAge(data, athlete, {
        rmssdMs: hr.rmssd,
        restHr: hr.restHr,
      }),
    [athlete, data, hr.restHr, hr.rmssd],
  );

  return {
    data,
    loading,
    journal,
    updateJournal,
    athlete,
    updateAthlete,
    report,
    bioAge,
  };
}
