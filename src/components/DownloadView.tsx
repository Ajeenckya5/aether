"use client";

import { Apple, Download, Github, Smartphone } from "lucide-react";
import {
  installHref,
  publicDownloadUrls,
  storeListed,
} from "@/lib/downloads";
import { InstallBanner, useDevice } from "./DeviceChrome";

export function DownloadView() {
  const urls = publicDownloadUrls();
  const device = useDevice();
  const androidStore = storeListed("android", urls);
  const iosStore = storeListed("ios", urls);

  return (
    <div className="px-5 pt-6 pb-8 lg:px-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime">Get Aether</p>
      <h1 className="font-display mt-2 text-4xl">Download</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        The app lives on GitHub. You download it from there, then install the
        same project on an iPhone and on Android (home-screen app) or run it on
        a laptop.
      </p>

      <div className="mt-5">
        <InstallBanner />
      </div>

      <a
        href={urls.repoUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-6 flex items-center gap-4 rounded-[28px] border border-lime/35 bg-lime/12 p-5"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-lime text-ink">
          <Github size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl text-paper">GitHub</span>
          <span className="mt-0.5 block text-sm text-muted">
            Required download. Source, ZIP, and clone.
          </span>
          <span className="mt-1 block truncate text-xs text-lime">{urls.repoUrl}</span>
        </span>
      </a>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <a
          href={urls.zipUrl}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-lime px-4 py-3 text-sm font-medium text-ink"
        >
          <Download size={16} />
          Download ZIP
        </a>
        <a
          href={urls.repoUrl}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-3 text-sm"
        >
          Open repository
        </a>
      </div>

      <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">
        git clone {urls.cloneUrl}
      </p>

      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        <article
          id="ios"
          className="rounded-[28px] border border-white/8 bg-panel p-5"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8">
              <Apple size={20} />
            </span>
            <div>
              <h2 className="font-display text-xl">iPhone and iPad</h2>
              <p className="text-xs uppercase tracking-widest text-muted">
                {iosStore ? "App Store" : "Available now · GitHub + Home Screen"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-paper/80">
            {iosStore
              ? "Open the App Store listing, or still clone from GitHub if you want the source."
              : "Apple has not listed Aether on the App Store yet (that needs an Apple Developer account and review). It is available on iOS today: download from GitHub, run the app, then in Safari tap Share → Add to Home Screen."}
          </p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-sm text-muted">
            <li>Download or clone from GitHub.</li>
            <li>
              {device.ios
                ? "You are on iOS — use Share → Add to Home Screen on this site."
                : "Open the running site in Safari on the iPhone."}
            </li>
            <li>Launch Aether from the home screen like any other app.</li>
          </ol>
          <a
            href={installHref("ios", urls)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-center rounded-full bg-paper px-4 py-3 text-sm font-medium text-ink"
          >
            {iosStore ? "Get it on the App Store" : "Get iOS build from GitHub"}
          </a>
        </article>

        <article
          id="android"
          className="rounded-[28px] border border-white/8 bg-panel p-5"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8">
              <Smartphone size={20} />
            </span>
            <div>
              <h2 className="font-display text-xl">Android</h2>
              <p className="text-xs uppercase tracking-widest text-muted">
                {androidStore ? "Play Store" : "Available now · GitHub + Install app"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-paper/80">
            {androidStore
              ? "Open the Play Store listing, or still clone from GitHub if you want the source."
              : "Google has not listed Aether on the Play Store yet (that needs a Play Console account and review). It is available on Android today: download from GitHub, run the app, then in Chrome tap Install app or Add to Home Screen."}
          </p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-sm text-muted">
            <li>Download or clone from GitHub.</li>
            <li>Open the site in Chrome on the phone.</li>
            <li>Install Aether, then pair a Polar/Garmin-class strap if you want live HR.</li>
          </ol>
          <a
            href={installHref("android", urls)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-center rounded-full bg-lime px-4 py-3 text-sm font-medium text-ink"
          >
            {androidStore ? "Get it on Google Play" : "Get Android build from GitHub"}
          </a>
        </article>
      </div>

      <section className="mt-4 rounded-[28px] border border-white/8 p-5 text-sm text-muted">
        <h2 className="font-display text-lg text-paper">Laptop</h2>
        <p className="mt-2">
          Same GitHub download. Run <code className="text-paper">npm install</code>{" "}
          then <code className="text-paper">npm run dev</code>, or install the
          site as an app in Chrome or Edge.
        </p>
      </section>
    </div>
  );
}
