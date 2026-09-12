"use client";

import { Apple, Download, FolderGit2, Smartphone } from "lucide-react";
import { publicDownloadUrls } from "@/lib/downloads";
import { preferPhoneShell } from "@/lib/device";
import { PUBLIC_SITE } from "@/lib/site";
import { InstallBanner, PhoneInstallCard, useDevice } from "./DeviceChrome";
import { BluetoothPanel } from "./LiveHeartRate";

export function DownloadView() {
  const urls = publicDownloadUrls();
  const device = useDevice();
  const onPhone = preferPhoneShell(device);

  return (
    <div className="px-5 pt-6 pb-8 lg:px-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-lime">On your phone</p>
      <h1 className="font-display mt-2 text-4xl">Put Aether on this device</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        Open the public site on your phone, then add it to the home screen.
        Journal, workouts, and heart-rate stay in this browser — GitHub Pages
        never stores them. Follow the steps for your phone, then pair live
        Bluetooth.
      </p>

      <section className="mt-6 rounded-[28px] border border-lime/25 bg-lime/8 p-5">
        <h2 className="font-display text-xl text-paper">Public site</h2>
        <p className="mt-2 text-sm text-muted">
          On the phone, open this address in Safari (iPhone) or Chrome (Android):
        </p>
        <a
          href={PUBLIC_SITE}
          className="mt-3 block break-all font-mono text-sm text-lime"
        >
          {PUBLIC_SITE}
        </a>
        <p className="mt-2 text-xs text-muted">
          Each phone keeps its own copy. There is no login and no shared user
          list on this host.
        </p>
      </section>

      <div className="mt-5">
        <InstallBanner />
      </div>

      {device.standalone && (
        <p className="mt-4 rounded-[24px] border border-lime/30 bg-lime/10 px-4 py-3 text-sm text-paper">
          This copy is already the phone app. Use the home-screen icon next time.
          Pair live HR below.
        </p>
      )}

      <section id="install" className="mt-6">
        <PhoneInstallCard />
      </section>

      <section
        id="ios"
        className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8">
            <Apple size={20} />
          </span>
          <div>
            <h2 className="font-display text-xl">iPhone — step by step</h2>
            <p className="text-xs uppercase tracking-widest text-muted">
              Home screen app, not Safari
            </p>
          </div>
        </div>
        <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm text-paper/80">
          <li>On the iPhone, open this page in <strong className="font-medium text-paper">Safari</strong> (not Chrome).</li>
          <li>Tap the Share button (square with an arrow).</li>
          <li>Scroll and tap <strong className="font-medium text-paper">Add to Home Screen</strong>, then Add.</li>
          <li>Leave Safari. Tap the <strong className="font-medium text-paper">Aether</strong> icon on the home screen.</li>
          <li>It opens as a phone app (no browser bar, no laptop sidebar).</li>
        </ol>
        {!onPhone && (
          <p className="mt-3 text-sm text-muted">
            You are on a computer. Pick up the iPhone, type this same address in
            Safari, then do the steps above.
          </p>
        )}
      </section>

      <section
        id="android"
        className="mt-4 rounded-[28px] border border-white/8 bg-panel p-5"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8">
            <Smartphone size={20} />
          </span>
          <div>
            <h2 className="font-display text-xl">Android — step by step</h2>
            <p className="text-xs uppercase tracking-widest text-muted">
              Home screen app, then live Bluetooth
            </p>
          </div>
        </div>
        <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm text-paper/80">
          <li>On the Android phone, open this page in <strong className="font-medium text-paper">Chrome</strong>.</li>
          <li>Tap <strong className="font-medium text-paper">Install</strong> when Chrome offers it, or Chrome menu → <strong className="font-medium text-paper">Install app</strong> / Add to Home screen.</li>
          <li>Tap the <strong className="font-medium text-paper">Aether</strong> icon. That is the app on the device.</li>
          <li>Scroll to Live Bluetooth and pair a Polar / Garmin / Wahoo strap.</li>
        </ol>
      </section>

      <div className="mt-4">
        <BluetoothPanel />
      </div>

      <section className="mt-4 rounded-[28px] border border-white/8 p-5 text-sm text-muted">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8 text-paper">
            <FolderGit2 size={20} />
          </span>
          <div>
            <h2 className="font-display text-lg text-paper">Source on GitHub</h2>
            <p className="text-xs uppercase tracking-widest">Only if you need the files</p>
          </div>
        </div>
        <p className="mt-3">
          You do not need GitHub to use Aether on the phone. GitHub is the
          source download if you want to run or change the project.
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-4">
          <li>
            Open{" "}
            <a className="text-lime" href={urls.repoUrl} target="_blank" rel="noreferrer">
              {urls.repoUrl.replace("https://", "")}
            </a>
          </li>
          <li>Click Code → Download ZIP, or copy the clone command below.</li>
          <li>That is source, not the phone icon. Put the running site on the phone with the steps above.</li>
        </ol>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <a
            href={urls.zipUrl}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3 text-sm text-paper"
          >
            <Download size={16} />
            Download ZIP
          </a>
          <a
            href={urls.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center rounded-full border border-white/15 px-4 py-3 text-sm"
          >
            Open GitHub
          </a>
        </div>
        <p className="mt-3 font-mono text-[11px] leading-relaxed">
          git clone {urls.cloneUrl}
        </p>
      </section>
    </div>
  );
}
