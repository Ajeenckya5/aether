"use client";

import { useMemo } from "react";
import { buildAtlas } from "@/lib/atlas";
import type { Athlete } from "@/lib/athlete";
import type { Dashboard } from "@/lib/types";
import type { JournalFlags } from "@/lib/journal";

export function useAtlas(data: Dashboard, journal: JournalFlags, athlete: Athlete) {
  return useMemo(() => buildAtlas(data, journal, athlete), [data, journal, athlete]);
}
