import { announceDue, prefersReducedMotion, smoothToward, zoneIndex } from "@/lib/hr-motion";
import { countEvent, currentFlags, loadRemoteFlags } from "@/lib/remote-config";

const CIRC = 2 * Math.PI * 42;
const TAU_MS = 280;
const STALE_MS = 15_000;

type Sample = { bpm: number | null; at: number };

function readStored(): Sample | null {
  try {
    const raw = localStorage.getItem("aether-hr-live");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Sample;
    if (typeof parsed.bpm !== "number" || typeof parsed.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function mount() {
  const root = document.getElementById("aether-hr");
  const ring = document.getElementById("aether-hr-ring");
  const marker = document.getElementById("aether-hr-marker");
  const number = document.getElementById("aether-hr-bpm");
  const live = document.getElementById("aether-hr-live");
  if (!root || !ring || !marker || !number || !live) return;
  if (!currentFlags().liveHr) {
    root.hidden = true;
    return;
  }

  let target: number | null = null;
  let seenAt = 0;
  let shown = 0;
  let lastZone: number | null = null;
  let lastAnnounced = 0;
  let lastFrame = 0;
  let looping = false;
  const maxHr = Number(root.dataset.maxHr) || 190;

  const paint = (now: number, dt: number) => {
    if (target == null) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    const reduced = prefersReducedMotion();
    shown = reduced ? target : smoothToward(shown || target, target, dt, TAU_MS);
    const pct = Math.max(0, Math.min(1, shown / maxHr));
    ring.style.strokeDashoffset = String(CIRC * (1 - pct));
    marker.style.left = `${pct * 100}%`;
    number.textContent = String(Math.round(shown));
    const zone = zoneIndex(target, maxHr);
    if (lastZone != null && zone !== lastZone) {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      if (!reduced && currentFlags().haptics && coarse && navigator.vibrate) navigator.vibrate(12);
      countEvent("zone");
    }
    lastZone = zone;
    if (lastAnnounced === 0 || announceDue(now, lastAnnounced)) {
      lastAnnounced = now;
      live.textContent = `${Math.round(target)} beats per minute, zone ${zone}`;
    }
  };

  const loop = (now: number) => {
    if (target == null || prefersReducedMotion()) {
      looping = false;
      return;
    }
    paint(now, lastFrame ? now - lastFrame : 16);
    lastFrame = now;
    window.requestAnimationFrame(loop);
  };

  const accept = (sample: Sample | null) => {
    if (!sample || sample.bpm == null || Date.now() - sample.at > STALE_MS) {
      target = null;
      root.hidden = true;
      return;
    }
    target = sample.bpm;
    seenAt = sample.at;
    if (prefersReducedMotion()) {
      paint(performance.now(), 0);
      return;
    }
    if (!looping) {
      looping = true;
      lastFrame = 0;
      window.requestAnimationFrame(loop);
    }
  };

  accept(readStored());
  try {
    const channel = new BroadcastChannel("aether-hr");
    channel.onmessage = (event: MessageEvent<Sample>) => accept(event.data);
  } catch {
    window.setInterval(() => accept(readStored()), 1000);
  }
  window.setInterval(() => {
    if (target != null && Date.now() - seenAt > STALE_MS) {
      target = null;
      root.hidden = true;
      return;
    }
    if (target == null) return;
    if (prefersReducedMotion()) {
      paint(performance.now(), 0);
      return;
    }
    if (!looping) {
      looping = true;
      lastFrame = 0;
      window.requestAnimationFrame(loop);
    }
  }, 1000);
}

void loadRemoteFlags(new URL("remote-config.json", document.baseURI).href).then(mount);
