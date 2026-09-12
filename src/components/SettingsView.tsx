"use client";

import { useState } from "react";
import Link from "next/link";
import { LocationFields } from "./LocationFields";
import { publicDownloadUrls } from "@/lib/downloads";
import { eraseLocalPrivateData } from "@/lib/privacy";
import { appPath, PUBLIC_SITE } from "@/lib/site";
import { DeviceStrip, InstallBanner } from "./DeviceChrome";
import { BluetoothPanel } from "./LiveHeartRate";
import { AthleteFields } from "./AthleteFields";

export function SettingsView() {
  const [erasing, setErasing] = useState(false);
  const downloads = publicDownloadUrls();

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
          Install Aether to the home screen so it is a phone app. Then connect
          over Bluetooth. GitHub is only the source files.
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

      <section className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5">
        <h2 className="font-display text-xl">Bluetooth only</h2>
        <p className="mt-2 text-sm text-muted">
          Aether never signs into WHOOP and never pulls the WHOOP cloud. The
          only live connection is Bluetooth on this phone. Pair a standard
          heart-rate strap (Polar, Garmin, Wahoo). The WHOOP band uses a closed
          radio WHOOP does not publish, so it cannot stream here.
        </p>
      </section>

      <div className="mt-4">
        <BluetoothPanel />
      </div>

      <section className="mt-4 rounded-[28px] border border-white/8 p-5 text-sm text-muted">
        <h2 className="font-display text-lg text-paper">Aether Lab vs WHOOP 5.0</h2>
        <p className="mt-2">
          WHOOP 5.0 added Healthspan and Stress behind membership tiers, and still
          does not show Banister fitness/fatigue, Gabbett ACWR, or why recovery
          moved. Lab trains an open ridge model (14k athlete-days, R² 0.94) on
          the physiology this phone can see — live Bluetooth HR, journal tags,
          and the body details you type. Biological age uses Klemera–Doubal on
          VO2, HRV, sleep, BMI, and optional blood pressure — not WHOOP PAC, and
          not a DNA or blood clock.
        </p>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5">
        <h2 className="font-display text-lg text-paper">You</h2>
        <p className="mt-2 text-sm text-muted">
          Name, height, weight, age, sex, and optional systolic stay on this
          phone. Lab uses them for BMI, BMR, zones, and Klemera–Doubal
          biological age — not a demo body.
        </p>
        <AthleteFields />
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5">
        <h2 className="font-display text-lg text-paper">Private data</h2>
        <p className="mt-2 text-sm text-muted">
          Journal, live workouts, GPS tracks, and your height, weight, name, and
          blood pressure stay on this phone. They never go to GitHub Pages or
          to WHOOP. Weather uses a rounded location from this browser. We never
          look up your IP. No ads or trackers.
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
          GPS is optional. A saved city is enough. Coordinates are rounded to
          ~1 km. If this browser blocks GPS, search a city — weather still
          uses that pin. Your IP is never sent to a locator.
        </p>
        <div className="mt-4">
          <LocationFields />
        </div>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 p-5 text-sm text-muted">
        <h2 className="font-display text-lg text-paper">Phone app</h2>
        <p className="mt-2">
          After install, open the home-screen icon. That is the phone app — no
          browser chrome. There is no App Store or Play Store listing. The
          one-time install address is{" "}
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
          <li>iPhone: Safari Share → Add to Home Screen (not the App Store). Live HR pairing needs Android Chrome; use Practice pulse here.</li>
          <li>Android: Chrome Install app (not Play Store), then Connect over Bluetooth with a Polar/Garmin/Wahoo strap.</li>
          <li>After the icon is on the phone, open that — not a browser tab.</li>
        </ul>
        <div className="mt-3">
          <DeviceStrip gps />
        </div>
      </section>
    </div>
  );
}
