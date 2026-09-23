"use client";

import { useEffect, useState } from "react";

/** Clock captured after mount so static HTML never embeds a build-time date. */
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);
  return now;
}
