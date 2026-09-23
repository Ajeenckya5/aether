"use client";

import type { JournalFlags } from "@/lib/journal";

const TOGGLES: { key: keyof JournalFlags; label: string; on?: boolean }[] = [
  { key: "alcohol", label: "Alcohol" },
  { key: "lateCaffeine", label: "Late caffeine" },
  { key: "travel", label: "Travel" },
  { key: "illness", label: "Sick" },
];

export function JournalChips({
  journal,
  onChange,
}: {
  journal: JournalFlags;
  onChange: (patch: Partial<JournalFlags>) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted">
        Today&apos;s context — moves the call immediately
      </p>
      <div className="flex flex-wrap gap-2">
        {TOGGLES.map((item) => {
          const active = Boolean(journal[item.key]);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange({ [item.key]: !active } as Partial<JournalFlags>)}
              className={`rounded-full px-3 py-1.5 text-xs ${
                active ? "bg-lime text-ink" : "bg-white/6 text-paper"
              }`}
            >
              {item.label}
            </button>
          );
        })}
        {[0, 1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange({ soreness: n as JournalFlags["soreness"] })}
            className={`rounded-full px-3 py-1.5 text-xs ${
              journal.soreness === n ? "bg-ember text-ink" : "bg-white/6 text-paper"
            }`}
          >
            {n === 0 ? "Fresh" : `Sore ${n}`}
          </button>
        ))}
      </div>
    </div>
  );
}
