"use client";

import { useEffect, useState } from "react";
import type { LabReport } from "@/lib/intelligence";
import { EMPTY_JOURNAL, loadJournal, type JournalFlags } from "@/lib/journal";
import { CallCard } from "./CallCard";
import { JournalChips } from "./JournalChips";

function sameJournal(a: JournalFlags, b: JournalFlags) {
  return (
    a.alcohol === b.alcohol &&
    a.lateCaffeine === b.lateCaffeine &&
    a.travel === b.travel &&
    a.illness === b.illness &&
    a.soreness === b.soreness
  );
}

export function TodayJournal({ report }: { report: LabReport }) {
  const [journal, setJournal] = useState<JournalFlags>(EMPTY_JOURNAL);
  const [current, setCurrent] = useState(report);

  useEffect(() => {
    const saved = loadJournal();
    if (sameJournal(saved, EMPTY_JOURNAL)) return;
    void import("@/lib/apply-journal").then((mod) => {
      const next = mod.applyJournal(saved);
      if (next) setCurrent(next);
      setJournal(saved);
    });
  }, []);

  return (
    <>
      <div className="mt-6">
        <CallCard report={current} sample />
      </div>
      <div className="mt-4">
        <JournalChips
          journal={journal}
          onChange={(patch) => {
            const next = { ...journal, ...patch };
            setJournal(next);
            void import("@/lib/apply-journal").then((mod) => {
              const updated = mod.applyJournal(next);
              if (updated) setCurrent(updated);
            });
          }}
        />
      </div>
    </>
  );
}
