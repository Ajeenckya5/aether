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
import { useDashboard } from "./DataProvider";

export function useLab() {
  const { data: remote, loading } = useDashboard();
  const hr = useLiveHeartRate();
  const data = useMemo(
    () =>
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
    [
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
