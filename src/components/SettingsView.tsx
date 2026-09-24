"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  athleteFromForm,
  errorsFor,
  formFromAthlete,
  withUnits,
  type AthleteForm,
} from "@/lib/athlete-form";
import { loadAthlete, saveAthlete, type Sex, type Units } from "@/lib/athlete";
import { installGuideHref } from "@/lib/device";
import { exportPrivateData, importPrivateData } from "@/lib/privacy";
import { placeDisplayName } from "@/lib/place";
import { loadSampleData, saveSampleData } from "@/lib/sample-data";
import { clearAppData, formatMegabytes, measureStorage } from "@/lib/storage-budget";
import { installRowLabel, strapStatusLine, strapTip } from "@/lib/strap";
import { applyTheme, loadTheme, type ThemeChoice } from "@/lib/theme";
import { APP_VERSION } from "@/lib/version";
import { appPath } from "@/lib/site";
import { useDevice } from "./DeviceChrome";
import { LocationFields } from "./LocationFields";
import { useLiveHeartRate } from "./heart-rate-context";
import { loadBlePair } from "@/lib/ble-pair";
import { usePlace } from "./usePlace";

type SectionId = "profile" | "devices" | "weather" | "advanced" | "data" | "app" | "danger";
type Panel = "strap" | "location" | "about";
type SaveScope = "profile" | "advanced";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "devices", label: "Devices" },
  { id: "weather", label: "Weather" },
  { id: "advanced", label: "Advanced" },
  { id: "data", label: "Data and privacy" },
  { id: "app", label: "App" },
  { id: "danger", label: "Danger zone" },
];

function useDesktopSettings() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(min-width: 1024px)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

function useAthleteForm() {
  const [form, setForm] = useState<AthleteForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedIn, setSavedIn] = useState<SaveScope | null>(null);
  const touched = useRef(false);
  const scope = useRef<SaveScope>("profile");

  useEffect(() => {
    setForm(formFromAthlete(loadAthlete()));
  }, []);

  useEffect(() => {
    if (!form || !touched.current) return;
    const where = scope.current;
    const timer = window.setTimeout(() => {
      const nextErrors = errorsFor(form);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;
      saveAthlete(athleteFromForm(form));
      setSavedIn(where);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [form]);

  function edit(patch: Partial<AthleteForm>, nextScope: SaveScope) {
    touched.current = true;
    scope.current = nextScope;
    setSavedIn(null);
    setForm((current) => (current ? { ...current, ...patch } : current));
  }

  return { form, errors, savedIn, edit };
}

export function SettingsView() {
  const desktop = useDesktopSettings();
  const [section, setSection] = useState<SectionId>("profile");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const formApi = useAthleteForm();

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pt-4 pb-6" data-settings-layout={desktop ? "desktop" : "phone"}>
      {!desktop && panel ? (
        <Detail panel={panel} onBack={() => setPanel(null)} />
      ) : (
        <>
          <h1 className="font-display text-3xl">Settings</h1>
          <div className={desktop ? "mt-4 grid grid-cols-[11.5rem_minmax(0,1fr)] gap-6" : ""}>
            {desktop ? (
              <nav aria-label="Settings sections" className="flex flex-col">
                {SECTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={section === item.id ? "true" : undefined}
                    onClick={() => setSection(item.id)}
                    className={`min-h-11 rounded-xl px-3 text-left text-sm ${
                      section === item.id ? "bg-white/8 text-lime" : "text-paper"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            ) : null}
            <div>
              {desktop ? (
                <DesktopPane section={section} formApi={formApi} />
              ) : (
                <PhoneList
                  formApi={formApi}
                  advancedOpen={advancedOpen}
                  onAdvanced={() => setAdvancedOpen((open) => !open)}
                  onOpen={setPanel}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PhoneList({
  formApi,
  advancedOpen,
  onAdvanced,
  onOpen,
}: {
  formApi: ReturnType<typeof useAthleteForm>;
  advancedOpen: boolean;
  onAdvanced: () => void;
  onOpen: (panel: Panel) => void;
}) {
  return (
    <>
      <ProfileBlock formApi={formApi} />
      <DevicesBlock onOpen={() => onOpen("strap")} />
      <WeatherBlock onOpen={() => onOpen("location")} />
      <section aria-labelledby="advanced-heading" className="mt-5">
        <h2 id="advanced-heading" className="px-1 text-[13px] text-muted">
          Advanced
        </h2>
        <div className="mt-1 overflow-hidden rounded-2xl bg-white/6">
          <button
            type="button"
            aria-expanded={advancedOpen}
            onClick={onAdvanced}
            className="flex min-h-11 w-full items-center px-3 text-left text-sm"
          >
            {advancedOpen ? "Hide advanced" : "Show advanced"}
            <ChevronRight size={16} aria-hidden className={`ml-auto ${advancedOpen ? "rotate-90" : ""}`} />
          </button>
          {advancedOpen ? <AdvancedFields formApi={formApi} /> : null}
        </div>
      </section>
      <DataBlock />
      <AppBlock onAbout={() => onOpen("about")} aboutInline={false} />
      <DangerBlock />
    </>
  );
}

function DesktopPane({
  section,
  formApi,
}: {
  section: SectionId;
  formApi: ReturnType<typeof useAthleteForm>;
}) {
  if (section === "profile") return <ProfileBlock formApi={formApi} />;
  if (section === "devices") return <StrapScreen />;
  if (section === "weather") return <LocationScreen />;
  if (section === "advanced") return <AdvancedBlock formApi={formApi} />;
  if (section === "data") return <DataBlock />;
  if (section === "app") return <AppBlock onAbout={() => undefined} aboutInline />;
  return <DangerBlock />;
}

function Group({
  id,
  title,
  saved,
  children,
  note,
}: {
  id: string;
  title: string;
  saved?: boolean;
  children: ReactNode;
  note?: string;
}) {
  return (
    <section aria-labelledby={id} className="mt-5">
      <div className="flex min-h-6 items-center justify-between px-1">
        <h2 id={id} className="text-[13px] text-muted">
          {title}
        </h2>
        {saved ? (
          <p role="status" className="flex items-center gap-1 text-[13px] text-lime">
            <Check size={14} aria-hidden />
            Saved
          </p>
        ) : null}
      </div>
      <div className="mt-1 divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/6">{children}</div>
      {note ? <p className="mt-1 px-1 text-xs text-muted">{note}</p> : null}
    </section>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="px-3 pb-2 text-xs text-ember">
      {message}
    </p>
  );
}

function ProfileBlock({ formApi }: { formApi: ReturnType<typeof useAthleteForm> }) {
  const { form, errors, savedIn, edit } = formApi;
  if (!form) {
    return (
      <Group id="profile-heading" title="Profile">
        <p className="px-3 py-3 text-sm text-muted">Loading profile…</p>
      </Group>
    );
  }
  const imperial = form.units === "imperial";
  return (
    <Group id="profile-heading" title="Profile" saved={savedIn === "profile"}>
      <div className="flex min-h-11 items-center gap-3 px-3">
        <label htmlFor="athlete-name" className="w-24 shrink-0 text-sm">
          Name
        </label>
        <input
          id="athlete-name"
          value={form.displayName}
          maxLength={40}
          autoComplete="given-name"
          onChange={(event) => edit({ displayName: event.target.value }, "profile")}
          className="min-h-11 w-full bg-transparent text-right text-sm outline-none"
        />
      </div>
      <div className="flex min-h-11 items-center gap-3 px-3">
        <span id="units-label" className="w-24 shrink-0 text-sm">
          Units
        </span>
        <div role="group" aria-labelledby="units-label" className="ml-auto flex">
          {(
            [
              ["metric", "cm, kg"],
              ["imperial", "ft, lb"],
            ] as const
          ).map(([units, label]) => (
            <button
              key={units}
              type="button"
              aria-pressed={form.units === units}
              onClick={() => edit(withUnits(form, units as Units), "profile")}
              className={`min-h-11 px-3 text-sm ${form.units === units ? "bg-lime text-ink" : "text-paper"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-h-11 items-center gap-3 px-3">
        <label htmlFor="athlete-age" className="w-24 shrink-0 text-sm">
          Age
        </label>
        <input
          id="athlete-age"
          inputMode="numeric"
          aria-invalid={Boolean(errors.age)}
          aria-describedby={errors.age ? "age-error" : undefined}
          value={form.age}
          onChange={(event) => edit({ age: event.target.value }, "profile")}
          className="min-h-11 w-full bg-transparent text-right text-sm outline-none"
        />
      </div>
      <FieldError id="age-error" message={errors.age} />
      <div className="flex min-h-11 items-center gap-3 px-3">
        <label htmlFor="athlete-sex" className="w-24 shrink-0 text-sm">
          Sex
        </label>
        <select
          id="athlete-sex"
          value={form.sex}
          onChange={(event) => edit({ sex: event.target.value as Sex }, "profile")}
          className="ml-auto min-h-11 bg-transparent text-right text-sm outline-none"
        >
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="unspecified">Prefer not to say</option>
        </select>
      </div>
      {imperial ? (
        <div className="flex min-h-11 items-center gap-3 px-3">
          <span id="height-label" className="w-24 shrink-0 text-sm">
            Height
          </span>
          <div className="ml-auto flex" aria-labelledby="height-label">
            <label className="text-sm text-muted">
              ft
              <input
                inputMode="numeric"
                aria-label="Height feet"
                aria-invalid={Boolean(errors.height)}
                aria-describedby={errors.height ? "height-error" : undefined}
                value={form.feet}
                onChange={(event) => edit({ feet: event.target.value }, "profile")}
                className="ml-1 w-12 min-h-11 bg-transparent text-right text-sm text-paper outline-none"
              />
            </label>
            <label className="ml-2 text-sm text-muted">
              in
              <input
                inputMode="numeric"
                aria-label="Height inches"
                aria-invalid={Boolean(errors.height)}
                value={form.inches}
                onChange={(event) => edit({ inches: event.target.value }, "profile")}
                className="ml-1 w-12 min-h-11 bg-transparent text-right text-sm text-paper outline-none"
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="flex min-h-11 items-center gap-3 px-3">
          <label htmlFor="athlete-height" className="w-24 shrink-0 text-sm">
            Height
          </label>
          <input
            id="athlete-height"
            inputMode="decimal"
            aria-label="Height in centimeters"
            aria-invalid={Boolean(errors.height)}
            aria-describedby={errors.height ? "height-error" : undefined}
            value={form.heightCm}
            onChange={(event) => edit({ heightCm: event.target.value }, "profile")}
            className="min-h-11 w-full bg-transparent text-right text-sm outline-none"
          />
          <span className="text-sm text-muted">cm</span>
        </div>
      )}
      <FieldError id="height-error" message={errors.height} />
      <div className="flex min-h-11 items-center gap-3 px-3">
        <label htmlFor="athlete-weight" className="w-24 shrink-0 text-sm">
          Weight
        </label>
        <input
          id="athlete-weight"
          inputMode="decimal"
          aria-label={imperial ? "Weight in pounds" : "Weight in kilograms"}
          aria-invalid={Boolean(errors.weight)}
          aria-describedby={errors.weight ? "weight-error" : undefined}
          value={form.weight}
          onChange={(event) => edit({ weight: event.target.value }, "profile")}
          className="min-h-11 w-full bg-transparent text-right text-sm outline-none"
        />
        <span className="text-sm text-muted">{imperial ? "lb" : "kg"}</span>
      </div>
      <FieldError id="weight-error" message={errors.weight} />
    </Group>
  );
}

function DevicesBlock({ onOpen }: { onOpen: () => void }) {
  const status = useStrapStatus();
  return (
    <Group id="devices-heading" title="Devices">
      <button type="button" onClick={onOpen} className="flex min-h-11 w-full items-center gap-3 px-3 text-left">
        <span className="text-sm">Heart-rate strap</span>
        <span className="ml-auto truncate text-sm text-muted">{status}</span>
        <ChevronRight size={16} aria-hidden />
      </button>
    </Group>
  );
}

function WeatherBlock({ onOpen }: { onOpen: () => void }) {
  const { place } = usePlace();
  return (
    <Group id="weather-heading" title="Weather">
      <button type="button" onClick={onOpen} className="flex min-h-11 w-full items-center gap-3 px-3 text-left">
        <span className="text-sm">Location</span>
        <span className="ml-auto truncate text-sm text-muted">
          {place ? placeDisplayName(place) : "Not set"}
        </span>
        <ChevronRight size={16} aria-hidden />
      </button>
    </Group>
  );
}

function AdvancedBlock({ formApi }: { formApi: ReturnType<typeof useAthleteForm> }) {
  return (
    <Group id="advanced-desk-heading" title="Advanced">
      <AdvancedFields formApi={formApi} />
    </Group>
  );
}

function AdvancedFields({ formApi }: { formApi: ReturnType<typeof useAthleteForm> }) {
  const { form, errors, edit, savedIn } = formApi;
  if (!form) return null;
  return (
    <div>
      {savedIn === "advanced" ? (
        <p role="status" className="flex items-center gap-1 px-3 pt-2 text-[13px] text-lime">
          <Check size={14} aria-hidden />
          Saved
        </p>
      ) : null}
      <label htmlFor="rest-hr" className="block px-3 py-2 text-sm">
        Resting heart rate
        <input
          id="rest-hr"
          inputMode="numeric"
          placeholder="Leave blank to measure from your strap"
          aria-invalid={Boolean(errors.rest)}
          aria-describedby={errors.rest ? "rest-error" : undefined}
          value={form.rest}
          onChange={(event) => edit({ rest: event.target.value }, "advanced")}
          className="mt-1 w-full bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </label>
      <FieldError id="rest-error" message={errors.rest} />
      <label htmlFor="max-hr" className="block border-t border-white/10 px-3 py-2 text-sm">
        Max heart rate
        <input
          id="max-hr"
          inputMode="numeric"
          placeholder="Leave blank to estimate from age"
          aria-invalid={Boolean(errors.max)}
          aria-describedby={errors.max ? "max-error" : undefined}
          value={form.max}
          onChange={(event) => edit({ max: event.target.value }, "advanced")}
          className="mt-1 w-full bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </label>
      <FieldError id="max-error" message={errors.max} />
      <div className="flex min-h-11 items-center gap-3 border-t border-white/10 px-3">
        <span id="cycle-label" className="text-sm">
          Cycle tracking
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={form.cycleTracking}
          aria-labelledby="cycle-label"
          onClick={() => edit({ cycleTracking: !form.cycleTracking }, "advanced")}
          className={`ml-auto min-h-11 rounded-full px-3 text-sm ${form.cycleTracking ? "bg-lime text-ink" : "bg-white/10"}`}
        >
          {form.cycleTracking ? "On" : "Off"}
        </button>
      </div>
      {form.cycleTracking ? (
        <div className="border-t border-white/10 px-3">
          <div className="flex min-h-11 items-center gap-3">
            <label htmlFor="cycle-start" className="text-sm">
              Cycle start
            </label>
            <input
              id="cycle-start"
              type="date"
              value={form.cycleStart}
              aria-invalid={Boolean(errors.cycle)}
              aria-describedby={errors.cycle ? "cycle-error" : undefined}
              onChange={(event) => edit({ cycleStart: event.target.value }, "advanced")}
              className="ml-auto min-h-11 bg-transparent text-sm outline-none"
            />
          </div>
          <FieldError id="cycle-error" message={errors.cycle} />
        </div>
      ) : null}
      <div className="border-t border-white/10 px-3 pb-3">
        <div className="flex min-h-11 items-center gap-3">
          <label htmlFor="systolic" className="shrink-0 text-sm">
            Blood pressure
          </label>
          <input
            id="systolic"
            inputMode="numeric"
            aria-invalid={Boolean(errors.systolic)}
            aria-describedby="bp-note"
            value={form.systolic}
            onChange={(event) => edit({ systolic: event.target.value }, "advanced")}
            className="min-h-11 w-full bg-transparent text-right text-sm outline-none"
          />
        </div>
        <p id="bp-note" className="text-xs text-muted">
          A home reading can sharpen the age estimate. It stays on this phone.
        </p>
        <FieldError id="systolic-error" message={errors.systolic} />
      </div>
    </div>
  );
}

function DataBlock() {
  const [sample, setSample] = useState(true);
  const [storage, setStorage] = useState("…");
  useEffect(() => {
    setSample(loadSampleData());
    void measureStorage().then((bytes) => setStorage(formatMegabytes(bytes)));
  }, []);
  return (
    <Group id="data-heading" title="Data and privacy">
      <button
        type="button"
        onClick={() => {
          const blob = new Blob([exportPrivateData()], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "aether-export.json";
          link.click();
          URL.revokeObjectURL(url);
        }}
        className="flex min-h-11 w-full items-center px-3 text-left text-sm"
      >
        Export my data
      </button>
      <label className="flex min-h-11 cursor-pointer items-center px-3 text-sm">
        Restore from backup
        <input
          type="file"
          accept="application/json"
          className="sr-only"
          aria-label="Restore from backup"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                importPrivateData(String(reader.result ?? ""));
                window.location.reload();
              } catch {
                window.alert("That file is not an Aether backup.");
              }
            };
            reader.readAsText(file);
          }}
        />
      </label>
      <div className="flex min-h-11 items-center gap-3 px-3">
        <span id="sample-label" className="text-sm">
          Sample data
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={sample}
          aria-labelledby="sample-label"
          onClick={() => {
            const next = !sample;
            setSample(next);
            saveSampleData(next);
          }}
          className={`ml-auto min-h-11 rounded-full px-3 text-sm ${sample ? "bg-lime text-ink" : "bg-white/10"}`}
        >
          {sample ? "On" : "Off"}
        </button>
      </div>
      <div className="flex min-h-11 items-center gap-3 px-3">
        <span className="text-sm">Storage on this device</span>
        <span id="storageUsed" className="ml-auto text-sm text-muted">
          Storage used: {storage}
        </span>
      </div>
      <Link href="/privacy" className="flex min-h-11 items-center px-3 text-sm">
        How your data stays private
        <ChevronRight size={16} aria-hidden className="ml-auto" />
      </Link>
    </Group>
  );
}

function AppBlock({ onAbout, aboutInline }: { onAbout: () => void; aboutInline: boolean }) {
  const device = useDevice();
  const [theme, setTheme] = useState<ThemeChoice>("system");
  const [prompt, setPrompt] = useState<{ prompt: () => Promise<void> } | null>(null);
  useEffect(() => setTheme(loadTheme()), []);
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  return (
    <Group id="app-heading" title="App">
      {device.standalone ? null : prompt ? (
        <button
          type="button"
          onClick={() => void prompt.prompt()}
          className="flex min-h-11 w-full items-center px-3 text-left text-sm"
        >
          Install on this phone
        </button>
      ) : (
        <Link href={installGuideHref(device)} className="flex min-h-11 items-center px-3 text-sm">
          {installRowLabel(device)}
          <ChevronRight size={16} aria-hidden className="ml-auto" />
        </Link>
      )}
      <div className="flex min-h-11 items-center gap-2 px-3">
        <span id="theme-label" className="text-sm">
          Theme
        </span>
        <div role="group" aria-labelledby="theme-label" className="ml-auto flex">
          {(
            [
              ["system", "System"],
              ["light", "Light"],
              ["dark", "Dark"],
            ] as const
          ).map(([choice, label]) => (
            <button
              key={choice}
              type="button"
              aria-pressed={theme === choice}
              onClick={() => {
                setTheme(choice);
                applyTheme(choice);
              }}
              className={`min-h-11 px-2 text-sm ${theme === choice ? "bg-lime text-ink" : "text-paper"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {aboutInline ? (
        <AboutBody />
      ) : (
        <button type="button" onClick={onAbout} className="flex min-h-11 w-full items-center px-3 text-left text-sm">
          About and methods
          <ChevronRight size={16} aria-hidden className="ml-auto" />
        </button>
      )}
    </Group>
  );
}

function DangerBlock() {
  const [ask, setAsk] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = phrase.trim().toLowerCase() === "erase";
  return (
    <Group id="danger-heading" title="Danger zone">
      <button
        type="button"
        onClick={() => setAsk(true)}
        className="flex min-h-11 w-full items-center px-3 text-left text-sm text-ember"
      >
        Erase all data on this device
      </button>
      {ask ? (
        <div className="px-3 pb-3">
          <label htmlFor="erase-confirm" className="text-sm">
            Type erase to confirm
          </label>
          <input
            id="erase-confirm"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            autoComplete="off"
            className="mt-1 w-full rounded-xl border border-white/10 bg-transparent px-3 text-sm outline-none"
          />
          <button
            type="button"
            disabled={!ready || busy}
            onClick={() => {
              if (!ready) return;
              setBusy(true);
              void import("@/lib/history-store")
                .then((mod) => mod.deleteArchivedBlobs())
                .then(() => clearAppData())
                .finally(() => {
                  window.location.assign(appPath("/") || "/");
                });
            }}
            className="mt-2 min-h-11 rounded-full border border-ember/40 px-4 text-sm text-ember disabled:opacity-40"
          >
            {busy ? "Erasing…" : "Erase data"}
          </button>
        </div>
      ) : null}
    </Group>
  );
}

function Detail({ panel, onBack }: { panel: Panel; onBack: () => void }) {
  return (
    <div>
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1 text-sm text-lime">
        <ChevronLeft size={16} aria-hidden />
        Settings
      </button>
      {panel === "strap" ? <StrapScreen /> : null}
      {panel === "location" ? <LocationScreen /> : null}
      {panel === "about" ? <AboutBody /> : null}
    </div>
  );
}

function useStrapStatus() {
  const hr = useLiveHeartRate();
  const [savedName, setSavedName] = useState<string | null>(null);
  useEffect(() => {
    setSavedName(loadBlePair()?.name ?? null);
  }, [hr.status]);
  return strapStatusLine({
    connected: hr.status === "live",
    name: hr.deviceName || savedName,
    batteryPct: hr.batteryPct,
  });
}

function StrapScreen() {
  const hr = useLiveHeartRate();
  const device = useDevice();
  const status = useStrapStatus();
  return (
    <Group id="strap-heading" title="Heart-rate strap">
      <p className="px-3 py-3 text-sm">{status}</p>
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => void hr.connect()}
          className="min-h-11 w-full rounded-full bg-lime px-4 text-sm font-medium text-ink"
        >
          {hr.status === "connecting" ? "Pairing…" : "Pair"}
        </button>
        <p className="mt-3 text-sm text-muted">{strapTip(device)}</p>
        <Link href="/download" className="mt-2 inline-flex min-h-11 items-center text-sm text-lime">
          Learn more
        </Link>
      </div>
    </Group>
  );
}

function LocationScreen() {
  return (
    <Group id="location-heading" title="Location" note="The city name is saved, and the pin is rounded to about a kilometer.">
      <div className="px-3 py-3">
        <LocationFields />
      </div>
    </Group>
  );
}

function AboutBody() {
  return (
    <Group id="about-heading" title="About and methods">
      <div className="px-3 py-3 text-sm">
        <p>Version {APP_VERSION}</p>
        <p className="mt-2 text-muted">
          Readiness uses the heart rate from your strap, your journal, and the body details on this phone.
        </p>
        <p className="mt-2 text-muted">Each method page lists the calculation and the paper it comes from.</p>
        <div className="mt-3 flex flex-col">
          <Link href="/lab" className="flex min-h-11 items-center">
            Methods
          </Link>
          <Link href="/atlas" className="flex min-h-11 items-center">
            Body measures
          </Link>
        </div>
      </div>
    </Group>
  );
}
