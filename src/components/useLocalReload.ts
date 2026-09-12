"use client";

import { useEffect, useState } from "react";
import { LOCAL_SYNC_EVENT } from "@/lib/sessions";

/** Reload device-local lists whenever they change, the tab wakes, or storage updates. */
export function useLocalReload<T>(load: () => T, empty: T): T {
  const [value, setValue] = useState(empty);

  useEffect(() => {
    const bump = () => setValue(load());
    bump();
    window.addEventListener("storage", bump);
    window.addEventListener("focus", bump);
    window.addEventListener(LOCAL_SYNC_EVENT, bump);
    document.addEventListener("visibilitychange", bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener("focus", bump);
      window.removeEventListener(LOCAL_SYNC_EVENT, bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, [load]);

  return value;
}
