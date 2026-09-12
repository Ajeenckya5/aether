"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { EMPTY_DASHBOARD, type Dashboard } from "@/lib/types";

type DataContextValue = {
  data: Dashboard;
  loading: boolean;
  refresh: (opts?: { quiet?: boolean }) => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Dashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    try {
      const res = await fetch("/api/whoop/dashboard", { cache: "no-store" });
      if (res.ok) {
        setData((await res.json()) as Dashboard);
      }
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh({ quiet: true }), 120_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh({ quiet: true });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  const value = useMemo(() => ({ data, loading, refresh }), [data, loading, refresh]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useDashboard must be used inside DataProvider");
  return ctx;
}
