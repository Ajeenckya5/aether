import { applyJournal } from "@/lib/apply-journal";
import { loadJournal, type JournalFlags } from "@/lib/journal";
import { countEvent, currentFlags, loadRemoteFlags } from "@/lib/remote-config";

const TONE: Record<string, { title: string; kicker: string; color: string; bg: string }> = {
  push: {
    title: "Push",
    kicker: "Quality intensity is on the table",
    color: "var(--ember)",
    bg: "color-mix(in srgb, var(--ember) 15%, transparent)",
  },
  build: {
    title: "Build",
    kicker: "Aerobic or skill work — not a breakthrough",
    color: "var(--lime)",
    bg: "color-mix(in srgb, var(--lime) 12%, transparent)",
  },
  recover: {
    title: "Recover",
    kicker: "Protect the next 36 hours",
    color: "var(--violet)",
    bg: "color-mix(in srgb, var(--violet) 15%, transparent)",
  },
};

const KEYS = ["alcohol", "lateCaffeine", "travel", "illness"] as const;

function paint(journal: JournalFlags) {
  const report = applyJournal(journal);
  if (!report) return;
  const tone = TONE[report.call] ?? TONE.build;
  const card = document.getElementById("aether-call");
  const title = document.getElementById("aether-call-title");
  const kicker = document.getElementById("aether-call-kicker");
  const why = document.getElementById("aether-call-why");
  if (!card || !title || !kicker || !why) return;
  card.style.background = tone.bg;
  card.dataset.call = report.call;
  title.textContent = tone.title;
  title.style.color = tone.color;
  kicker.textContent = tone.kicker;
  why.replaceChildren();
  for (const reason of report.callWhy) {
    const item = document.createElement("li");
    item.textContent = reason;
    why.appendChild(item);
  }
  card.classList.remove("is-swapping");
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    void card.offsetWidth;
    card.classList.add("is-swapping");
  }
  document.querySelectorAll<HTMLButtonElement>("[data-chip]").forEach((button) => {
    const key = button.dataset.chip ?? "";
    const on =
      key === "alcohol" || key === "lateCaffeine" || key === "travel" || key === "illness"
        ? journal[key]
        : key === `sore-${journal.soreness}`;
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.classList.toggle("is-on", Boolean(on));
  });
}

function toggle(journal: JournalFlags, chip: string): JournalFlags {
  const next = { ...journal };
  if (chip.startsWith("sore-")) {
    const level = Number(chip.slice(5));
    if (level === 0 || level === 1 || level === 2 || level === 3) next.soreness = level;
    return next;
  }
  if ((KEYS as readonly string[]).includes(chip)) {
    const key = chip as (typeof KEYS)[number];
    next[key] = !next[key];
  }
  return next;
}

function pendingChip(): string {
  const chip = (window as Window & { __aetherChip?: string }).__aetherChip;
  (window as Window & { __aetherChip?: string }).__aetherChip = "";
  return typeof chip === "string" ? chip : "";
}

function start() {
  if (!currentFlags().chips) return;
  const root = document.getElementById("aether-chips");
  if (!root || root.dataset.ready === "1") return;
  root.dataset.ready = "1";
  let journal = loadJournal();
  const chip = pendingChip();
  if (chip) journal = toggle(journal, chip);
  paint(journal);
  root.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("[data-chip]");
    if (!button?.dataset.chip) return;
    journal = toggle(journal, button.dataset.chip);
    paint(journal);
    countEvent("chip");
  });
}

void loadRemoteFlags(new URL("remote-config.json", document.baseURI).href).then(() => {
  (window as Window & { aetherBoot?: () => void }).aetherBoot = start;
  start();
});
