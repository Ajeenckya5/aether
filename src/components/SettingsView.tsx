"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Athlete } from "@/lib/athlete";
import { useDashboard } from "./DataProvider";
import { LocationFields } from "./LocationFields";
import { publicDownloadUrls } from "@/lib/downloads";
import { eraseLocalPrivateData } from "@/lib/privacy";
import { appPath, isStaticSite, PUBLIC_SITE } from "@/lib/site";
import { DeviceStrip, InstallBanner } from "./DeviceChrome";
import { BluetoothPanel } from "./LiveHeartRate";
import { useLab } from "./useLab";

const ERRORS: Record<string, string> = {
  config: "Add WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET to .env.local, then restart.",
  oauth: "WHOOP sign-in did not finish. Try connect again.",
  token: "WHOOP did not return tokens. Check the redirect URI and client secret.",
};

export function SettingsView() {
  const { data, refresh } = useDashboard();
  const [busy, setBusy] = useState(false);
  const [erasing, setErasing] = useState(false);
  const params = useSearchParams();
  const [oauthError, setOauthError] = useState<string | null>(null);
  const downloads = publicDownloadUrls();
  const staticSite = isStaticSite();

  useEffect(() => {
    setOauthError(ERRORS[params.get("error") ?? ""] ?? null);
  }, [params]);

  async function disconnect() {
    setBusy(true);
    try {
      await fetch(appPath("/api/auth/logout"), { method: "POST" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function eraseEverything() {
    if (
      !window.confirm(
        "Erase journal, workouts, live recordings, and location on this phone?",
      )
    ) {
      return;
    }
    setErasing(true);
    try {
      if (!staticSite) {
        await fetch(appPath("/api/auth/logout"), { method: "POST" });
      }
      eraseLocalPrivateData();
      window.location.assign(appPath("/") || "/");
    } finally {
      setErasing(false);
    }
  }

  return (
    <div className="px-5 pt-6 pb-8 lg:px-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime">Band</p>
      <h1 className="font-display mt-2 text-4xl">Settings</h1>
      <div className="mt-4">
        <InstallBanner />
      </div>

      <section className="mt-6 rounded-[28px] border border-lime/25 bg-lime/8 p-5">
        <h2 className="font-display text-xl text-paper">On this phone</h2>
        <p className="mt-2 text-sm text-muted">
          Install Aether to the home screen so it is a phone app, not a laptop
          dashboard. Then pair live Bluetooth. GitHub is only the source files.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href="/download"
            className="rounded-full bg-lime px-4 py-3 text-center text-sm font-medium text-ink"
          >
            Step-by-step install
          </Link>
          <Link
            href="/download#bluetooth"
            className="rounded-full border border-white/15 px-4 py-3 text-center text-sm"
          >
            Live Bluetooth
          </Link>
        </div>
      </section>

      <div className="mt-4">
        <BluetoothPanel />
      </div>

      {oauthError && !staticSite && (
        <p className="mt-4 rounded-2xl bg-ember/15 px-4 py-3 text-sm text-ember">
          {oauthError}
        </p>
      )}

      {staticSite ? (
        <section className="mt-6 rounded-[28px] border border-white/8 bg-panel p-5">
          <h2 className="font-display text-xl">Your copy stays on this phone</h2>
          <p className="mt-2 text-sm text-muted">
            This public site is a static app. There is no Aether account and no
            shared database, so another person’s journal cannot mix with yours.
            Recovery numbers here are demo. Live workouts, GPS, and notes live
            only in this browser’s storage.
          </p>
          <p className="mt-2 text-sm text-muted">
            Connecting a WHOOP band needs a private server you run (the GitHub
            source). The band still syncs through the official WHOOP app.
          </p>
          <a
            className="mt-4 inline-block text-sm text-lime"
            href={downloads.repoUrl}
            target="_blank"
            rel="noreferrer"
          >
            Run your own copy
          </a>
        </section>
      ) : (
        <>
      <section className="mt-6 rounded-[28px] border border-white/8 bg-panel p-5">
        <h2 className="font-display text-xl">How your WHOOP data gets here</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-paper/80">
          <li>Wear the band. It records locally on the device.</li>
          <li>
            Open the official WHOOP app so the band can sync over Bluetooth.
            WHOOP does not publish a public Bluetooth protocol for third-party
            apps, so Aether cannot talk to the strap directly.
          </li>
          <li>
            Connect Aether below. WHOOP asks you to approve read access, then
            we pull recovery, strain, sleep, and workouts from their official
            API.
          </li>
        </ol>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5">
        <p className="text-xs uppercase tracking-widest text-muted">Status</p>
        <p className="font-display mt-1 text-2xl">
          {data.connected ? "Connected to WHOOP" : "Demo mode"}
        </p>
        <p className="mt-2 text-sm text-muted">
          {data.connected
            ? `${data.profile.first_name || "Connected"} · WHOOP tokens stay in httpOnly cookies`
            : data.configured
              ? "Credentials are set. Sign in to load your band."
              : "Add WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET to .env.local, then sign in."}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <a
            href={appPath("/api/auth/whoop")}
            className="rounded-full bg-lime px-4 py-3 text-center text-sm font-medium text-ink"
          >
            {data.connected ? "Reconnect WHOOP" : "Connect WHOOP"}
          </a>
          {data.connected && (
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={busy}
              className="rounded-full border border-white/15 px-4 py-3 text-sm"
            >
              {busy ? "Disconnecting…" : "Disconnect"}
            </button>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 p-5 text-sm text-muted">
        <h2 className="font-display text-lg text-paper">Developer setup</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-4">
          <li>
            Create an app at{" "}
            <a
              className="text-lime"
              href="https://developer.whoop.com"
              target="_blank"
              rel="noreferrer"
            >
              developer.whoop.com
            </a>
          </li>
          <li>
            Set redirect URI to{" "}
            <code className="text-paper">http://localhost:3000/api/auth/callback</code>
          </li>
          <li>
            Request scopes: recovery, cycles, sleep, workout, profile, body
            measurement, and offline.
          </li>
          <li>Copy client id and secret into .env.local and restart the app.</li>
        </ol>
      </section>
        </>
      )}

      <section className="mt-4 rounded-[28px] border border-white/8 p-5 text-sm text-muted">
        <h2 className="font-display text-lg text-paper">Aether Lab vs WHOOP 5.0</h2>
        <p className="mt-2">
          WHOOP 5.0 added Healthspan and Stress behind membership tiers, and still
          does not show Banister fitness/fatigue, Gabbett ACWR, or why recovery
          moved. Lab trains an open ridge model (14k athlete-days, R² 0.94) and
          applies it to your band data with same-day journal tags.
        </p>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5">
        <h2 className="font-display text-lg text-paper">Athlete constants</h2>
        <p className="mt-2 text-sm text-muted">
          Age, sex, and HRmax feed Tanaka, Nes, Gulati, Karvonen, BMR, and VO2
          estimates in Lab → Atlas. Cycle day is optional (1–28) for luteal RHR
          notes.
        </p>
        <AthleteFields />
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5">
        <h2 className="font-display text-lg text-paper">Private data</h2>
        <p className="mt-2 text-sm text-muted">
          Journal, live workouts, GPS tracks, and athlete notes stay on this
          phone. They never go to GitHub Pages. Weather uses a rounded location
          from this browser. We never look up your IP. No ads or trackers.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href="/privacy"
            className="rounded-full border border-white/15 px-4 py-3 text-center text-sm"
          >
            How we keep it private
          </Link>
          <button
            type="button"
            onClick={() => void eraseEverything()}
            disabled={erasing}
            className="rounded-full border border-ember/40 px-4 py-3 text-sm text-ember"
          >
            {erasing ? "Erasing…" : "Erase private data on this phone"}
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5">
        <h2 className="font-display text-lg text-paper">Location</h2>
        <p className="mt-2 text-sm text-muted">
          GPS (rounded to ~1 km) or city search. Weather, AQI, UV, and heat use
          Open-Meteo with that coarse pin. Your IP is never sent to a locator.
        </p>
        <div className="mt-4">
          <LocationFields />
        </div>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 p-5 text-sm text-muted">
        <h2 className="font-display text-lg text-paper">Phone app</h2>
        <p className="mt-2">
          After install, open the home-screen icon. That is the device app — not
          a laptop dashboard. The live site is{" "}
          <a className="text-lime" href={PUBLIC_SITE} target="_blank" rel="noreferrer">
            {PUBLIC_SITE.replace("https://", "")}
          </a>
          . Source files stay on{" "}
          <a className="text-lime" href={downloads.repoUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-4">
          <li>iPhone: Share → Add to Home Screen. Live HR strap pairing needs Android Chrome; use Practice pulse here. WHOOP still records the band.</li>
          <li>Android: Install app, then Pair live HR with a Polar/Garmin/Wahoo strap.</li>
          <li>Do not keep working in a laptop browser after you have the icon on the phone.</li>
        </ul>
        <div className="mt-3">
          <DeviceStrip gps />
        </div>
      </section>
    </div>
  );
}

function AthleteFields() {
  const { athlete, updateAthlete } = useLab();
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <label className="text-xs text-muted">
        Age
        <input
          type="number"
          min={16}
          max={90}
          value={athlete.age}
          onChange={(e) => updateAthlete({ age: Number(e.target.value) || 32 })}
          className="mt-1 w-full rounded-2xl border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
        />
      </label>
      <label className="text-xs text-muted">
        Sex
        <select
          value={athlete.sex}
          onChange={(e) =>
            updateAthlete({ sex: e.target.value as Athlete["sex"] })
          }
          className="mt-1 w-full rounded-2xl border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
        >
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="unspecified">Unspecified</option>
        </select>
      </label>
      <label className="text-xs text-muted">
        HRmax override
        <input
          type="number"
          min={140}
          max={220}
          placeholder="Tanaka"
          value={athlete.maxHrOverride ?? ""}
          onChange={(e) =>
            updateAthlete({
              maxHrOverride: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="mt-1 w-full rounded-2xl border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
        />
      </label>
      <label className="text-xs text-muted">
        Cycle day (1–28)
        <input
          type="number"
          min={1}
          max={28}
          value={athlete.cycleDay ?? ""}
          onChange={(e) =>
            updateAthlete({
              cycleDay: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="mt-1 w-full rounded-2xl border border-white/10 bg-ink px-3 py-2 text-sm text-paper"
        />
      </label>
    </div>
  );
}
