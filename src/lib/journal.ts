export type JournalFlags = {
  alcohol: boolean;
  lateCaffeine: boolean;
  travel: boolean;
  illness: boolean;
  soreness: 0 | 1 | 2 | 3;
};

export const EMPTY_JOURNAL: JournalFlags = {
  alcohol: false,
  lateCaffeine: false,
  travel: false,
  illness: false,
  soreness: 0,
};

const KEY = "aether-journal-v1";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function loadJournal(day = todayKey()): JournalFlags {
  if (typeof window === "undefined") return { ...EMPTY_JOURNAL };
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<
      string,
      JournalFlags
    >;
    return { ...EMPTY_JOURNAL, ...(all[day] ?? {}) };
  } catch {
    return { ...EMPTY_JOURNAL };
  }
}

export function saveJournal(flags: JournalFlags, day = todayKey()) {
  const all = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<
    string,
    JournalFlags
  >;
  all[day] = flags;
  localStorage.setItem(KEY, JSON.stringify(all));
}
