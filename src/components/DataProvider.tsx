"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { buildDemoDashboard } from "@/lib/mock";
import type { Dashboard } from "@/lib/types";

type DataContextValue = {
  data: Dashboard;
  loading: boolean;
  refresh: (opts?: { quiet?: boolean }) => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

function localDashboard(): Dashboard {
  const demo = buildDemoDashboard();
  demo.configured = false;
  demo.connected = false;
  demo.source = "demo";
  return demo;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Dashboard>(localDashboard);

  const refresh = useCallback(async () => {
    setData(localDashboard());
  }, []);

  const value = useMemo(
    () => ({ data, loading: false, refresh }),
    [data, refresh],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useDashboard must be used inside DataProvider");
  return ctx;
}
