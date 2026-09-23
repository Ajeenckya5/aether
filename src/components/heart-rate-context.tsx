"use client";

import { createContext, useContext, useEffect, useState, type ComponentType } from "react";
import type { OvernightProgress, OvernightSummary } from "@/lib/overnight";

export type HrStatus = "off" | "connecting" | "live" | "camera" | "practice" | "error";

export type HrValue = {
  bpm: number | null;
  rmssd: number | null;
  sdnn: number | null;
  restHr: number | null;
  batteryPct: number | null;
  rrCount: number;
  spo2: number | null;
  skinTempC: number | null;
  overnight: OvernightSummary | null;
  nightProgress: OvernightProgress | null;
  fromBand: boolean;
  status: HrStatus;
  message: string | null;
  deviceName: string | null;
  connect: (opts?: { scanAll?: boolean }) => Promise<void>;
  startCamera: () => Promise<void>;
  startPractice: () => void;
  disconnect: () => void;
};

type HrJob =
  | { kind: "connect"; scanAll?: boolean }
  | { kind: "camera" }
  | { kind: "practice" }
  | { kind: "disconnect" };

let latest: HrValue | null = null;
let pending: HrJob | null = null;

function run(api: HrValue, job: HrJob) {
  if (job.kind === "connect") void api.connect(job.scanAll ? { scanAll: true } : undefined);
  if (job.kind === "camera") void api.startCamera();
  if (job.kind === "practice") api.startPractice();
  if (job.kind === "disconnect") api.disconnect();
}

/** Real provider publishes its API so a click that happened first still runs. */
export function publishHeartRate(api: HrValue) {
  latest = api;
  const job = pending;
  pending = null;
  if (job) run(api, job);
}

function queue(job: HrJob) {
  if (latest) {
    run(latest, job);
    return;
  }
  pending = job;
  window.dispatchEvent(new Event("aether-need-hr"));
}

export const EMPTY_HR: HrValue = {
  bpm: null,
  rmssd: null,
  sdnn: null,
  restHr: null,
  batteryPct: null,
  rrCount: 0,
  spo2: null,
  skinTempC: null,
  overnight: null,
  nightProgress: null,
  fromBand: false,
  status: "off",
  message: null,
  deviceName: null,
  connect: async (opts) => queue({ kind: "connect", scanAll: opts?.scanAll }),
  startCamera: async () => queue({ kind: "camera" }),
  startPractice: () => queue({ kind: "practice" }),
  disconnect: () => queue({ kind: "disconnect" }),
};

export const HeartRateContext = createContext<HrValue>(EMPTY_HR);

export function useLiveHeartRate(): HrValue {
  return useContext(HeartRateContext);
}

export function HeartRateSlot({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const [Provider, setProvider] = useState<ComponentType<{ children: React.ReactNode }> | null>(
    null,
  );

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void import("./LiveHeartRate").then((mod) => {
      if (!cancelled) setProvider(() => mod.HeartRateProvider);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    const onNeed = () => {
      void import("./LiveHeartRate").then((mod) => {
        setProvider(() => mod.HeartRateProvider);
      });
    };
    window.addEventListener("aether-need-hr", onNeed);
    return () => window.removeEventListener("aether-need-hr", onNeed);
  }, []);

  if (!Provider) {
    return <HeartRateContext.Provider value={EMPTY_HR}>{children}</HeartRateContext.Provider>;
  }
  return <Provider>{children}</Provider>;
}
