import { analyzeDashboard, type LabReport } from "@/lib/intelligence";
import { EMPTY_JOURNAL, saveJournal, type JournalFlags } from "@/lib/journal";
import { buildDemoDashboard } from "@/lib/mock";

export function applyJournal(journal: JournalFlags): LabReport | null {
  const data = buildDemoDashboard();
  data.configured = false;
  data.connected = false;
  data.source = "demo";
  saveJournal({ ...EMPTY_JOURNAL, ...journal });
  return analyzeDashboard(data, journal, data.workouts);
}
