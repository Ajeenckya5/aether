"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { describeHrSupport, gpsLabel, readDevice, type DeviceProbe } from "@/lib/device";
import { appPath } from "@/lib/site";

const SSR_DEVICE: DeviceProbe = {
  bluetooth: false,
  geolocation: false,
  wakeLock: false,
  ios: false,
  standalone: false,
  coarse: false,
};

export function useDevice(): DeviceProbe {
  const [device, setDevice] = useState<DeviceProbe>(SSR_DEVICE);
  useEffect(() => {
    setDevice(readDevice());
  }, []);
  return device;
}

export function DeviceStrip({ gps }: { gps?: boolean }) {
  const device = useDevice();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) {
    return <p className="text-xs text-muted">Works on a phone or a laptop.</p>;
  }
  return (
    <p className="text-xs text-muted">
      {describeHrSupport(device)}
      {gps ? ` ${gpsLabel(device.coarse)} uses this ${device.coarse ? "phone" : "laptop or tablet"}.` : ""}
      {device.ios && !device.wakeLock
        ? " Keep the screen awake on iPhone if the clock pauses in the background."
        : ""}
    </p>
  );
}

export function InstallBanner() {
  const device = useDevice();
  const [promptEvent, setPromptEvent] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register(appPath("/sw.js"), {
      scope: appPath("/") || "/",
    });
  }, []);

  if (hidden || device.standalone) return null;

  if (promptEvent) {
    return (
      <button
        type="button"
        onClick={() => {
          void promptEvent.prompt();
          setHidden(true);
        }}
        className="w-full rounded-2xl border border-lime/30 bg-lime/10 px-3 py-2 text-left text-xs text-paper"
      >
        Install Aether on this phone
      </button>
    );
  }

  if (device.ios) {
    return (
      <p className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-muted">
        Put Aether on the iPhone: Share → Add to Home Screen, then open the icon.
        That is the app — Apple has no App Store listing for Aether.{" "}
        <Link href="/download" className="text-lime">
          Step by step
        </Link>
        <button type="button" className="ml-2 text-lime" onClick={() => setHidden(true)}>
          OK
        </button>
      </p>
    );
  }

  return (
    <p className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-muted">
      Install Aether on this phone so it opens from the home screen, not a
      browser tab.{" "}
      <Link href="/download" className="text-lime">
        Put it on the phone
      </Link>
    </p>
  );
}

export function PhoneInstallCard() {
  const device = useDevice();
  const [promptEvent, setPromptEvent] = useState<{ prompt: () => Promise<void> } | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as Event & { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (device.standalone) return null;

  return (
    <div className="rounded-[28px] border border-lime/30 bg-lime/10 p-5">
      <h2 className="font-display text-xl text-paper">Install on this device</h2>
      <p className="mt-2 text-sm text-paper/80">
        Do not keep using Aether in a browser tab. Add it to the phone home
        screen, then always open the Aether icon — that is the app.
      </p>
      {promptEvent ? (
        <button
          type="button"
          onClick={() => void promptEvent.prompt()}
          className="mt-4 w-full rounded-full bg-lime px-4 py-3 text-sm font-medium text-ink"
        >
          Install Aether on this phone
        </button>
      ) : (
        <Link
          href={device.ios ? "/download#ios" : "/download#android"}
          className="mt-4 flex w-full items-center justify-center rounded-full bg-lime px-4 py-3 text-sm font-medium text-ink"
        >
          {device.ios ? "Show iPhone steps" : "Show Android steps"}
        </Link>
      )}
    </div>
  );
}
