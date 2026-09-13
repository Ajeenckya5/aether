"use client";

import Link from "next/link";
import { PUBLIC_SITE } from "@/lib/site";

export function PrivacyView() {
  return (
    <div className="px-5 pt-6 pb-8 lg:px-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime">Private by default</p>
      <h1 className="font-display mt-2 text-4xl">Your data</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        Aether is built so your health data stays on this phone. The public
        website is only the app shell. There are no ads, no trackers, and no
        Aether account.
      </p>

      <section className="mt-6 rounded-[28px] border border-white/8 bg-panel p-5 text-sm text-paper/80">
        <h2 className="font-display text-xl text-paper">No shared user pile</h2>
        <p className="mt-3 text-muted">
          GitHub Pages only serves HTML, CSS, and JavaScript. It cannot see
          your journal, GPS, or heart-rate. Those live in this browser’s
          storage, locked to this site origin (
          {PUBLIC_SITE.replace("https://", "")}). Another phone, another
          browser, or a different URL cannot read them.
        </p>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5 text-sm text-paper/80">
        <h2 className="font-display text-xl text-paper">Stays on this device</h2>
        <ul className="mt-3 list-disc space-y-2 pl-4 text-muted">
          <li>Journal tags, athlete name/age/sex, height, weight, optional systolic BP, custom workouts, live recordings, GPS tracks.</li>
          <li>Bluetooth heart-rate samples, Aether sleep log, HRV, and resting HR. They are not uploaded.</li>
          <li>Saved city for weather (rounded, not a street pin).</li>
        </ul>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5 text-sm text-paper/80">
        <h2 className="font-display text-xl text-paper">Leaves the phone only if you ask</h2>
        <ul className="mt-3 list-disc space-y-2 pl-4 text-muted">
          <li>
            <strong className="font-medium text-paper">Bluetooth</strong> — live
            heart-rate stays on this phone. Live WHOOP bpm uses the public Heart
            Rate Bluetooth service. The iPhone app uses Core Bluetooth on this
            device — still public Heart Rate only, never WHOOP’s private radio.
            Aether also asks for standard pulse-oximeter and thermometer GATT.
            Overnight Aether sleep (wake, quiet, deep rest, active rest) is
            scored on this phone from that public HR stream. WHOOP’s private
            overnight packets never leave the band except through the official
            WHOOP app.
          </li>
          <li>
            <strong className="font-medium text-paper">Weather</strong> — this browser talks to Open-Meteo with a rounded lat/lon (~1 km). GitHub never sees the pin. City search sends only the letters you type.
          </li>
          <li>
            <strong className="font-medium text-paper">Movements</strong> — Coach cards load public exercises from wger.de. No personal data is sent.
          </li>
        </ul>
        <p className="mt-3 text-muted">
          We do not send your IP to a locator. Search a city instead of
          “approximate IP.”
        </p>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/8 p-5 text-sm text-muted">
        <h2 className="font-display text-lg text-paper">What we never do</h2>
        <ul className="mt-3 list-disc space-y-2 pl-4">
          <li>No advertising SDKs, analytics pixels, or crash reporters.</li>
          <li>No selling or sharing journal, GPS, or heart-rate logs.</li>
          <li>No WHOOP cloud tokens. Live WHOOP bpm uses public Heart Rate GATT only — not WHOOP’s private radio.</li>
        </ul>
        <Link href="/settings" className="mt-4 inline-block text-sm text-lime">
          Erase private data in Settings
        </Link>
      </section>
    </div>
  );
}
