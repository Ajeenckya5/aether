"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { describeHrSupport, gpsLabel, readDevice, type DeviceProbe } from "@/lib/device";

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
    void navigator.serviceWorker.register("/sw.js");
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
        Install Aether on this laptop or Android phone
      </button>
    );
  }

  if (device.ios) {
    return (
      <p className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-muted">
        On iPhone: Share → Add to Home Screen. Live tracking and your workouts then open like an app.{" "}
        <Link href="/download" className="text-lime">
          GitHub + iOS
        </Link>
        <button type="button" className="ml-2 text-lime" onClick={() => setHidden(true)}>
          OK
        </button>
      </p>
    );
  }

  return null;
}
