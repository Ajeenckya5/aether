export const CONFIG_FLAGS = ["liveHr", "haptics", "chips", "weather", "trends", "counts"] as const;

export type ConfigFlag = (typeof CONFIG_FLAGS)[number];

export type RemoteFlags = Record<ConfigFlag, boolean>;

export const DEFAULT_FLAGS: RemoteFlags = {
  liveHr: true,
  haptics: true,
  chips: true,
  weather: true,
  trends: true,
  counts: false,
};

/** Names the worker will count. Anything else is dropped on the device. */
export const COUNT_NAMES = ["zone", "chip", "weather", "range", "banner"] as const;

export type CountName = (typeof COUNT_NAMES)[number];

export function sanitizeFlags(input: unknown): RemoteFlags {
  const flags = { ...DEFAULT_FLAGS };
  if (!input || typeof input !== "object") return flags;
  const record = input as Record<string, unknown>;
  for (const key of CONFIG_FLAGS) {
    if (typeof record[key] === "boolean") flags[key] = record[key];
  }
  return flags;
}

/** A count is only the event name. No measurement, no identifier. */
export function countPayload(name: string): { name: CountName } | null {
  if (!(COUNT_NAMES as readonly string[]).includes(name)) return null;
  return { name: name as CountName };
}

/** The worker accepts this shape and rejects every other field. */
export function eventBody(input: unknown): { name: CountName } | null {
  if (!input || typeof input !== "object") return null;
  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== "name") return null;
  const name = (input as { name: unknown }).name;
  if (typeof name !== "string") return null;
  return countPayload(name);
}

let flags = { ...DEFAULT_FLAGS };
let worker = "";
let pending: Promise<RemoteFlags> | null = null;

const CACHE_KEY = "aether-flags";
const CACHE_MS = 60 * 60 * 1000;

export function currentFlags(): RemoteFlags {
  return flags;
}

export function currentWorker(): string {
  return worker;
}

function readCache(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { at?: unknown; flags?: unknown; worker?: unknown };
    if (typeof parsed.at !== "number" || Date.now() - parsed.at >= CACHE_MS) return false;
    flags = sanitizeFlags(parsed.flags);
    worker = typeof parsed.worker === "string" ? parsed.worker : "";
    return true;
  } catch {
    return false;
  }
}

function writeCache() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), flags, worker }));
  } catch {
    /* private mode */
  }
}

async function fetchFlags(configUrl: string): Promise<RemoteFlags> {
  if (readCache()) return flags;
  try {
    const local = await fetch(configUrl);
    if (!local.ok) return flags;
    const body = (await local.json()) as { worker?: unknown };
    worker = typeof body.worker === "string" ? body.worker.replace(/\/$/, "") : "";
    if (!worker) {
      writeCache();
      return flags;
    }
    const remote = await fetch(`${worker}/config`);
    if (!remote.ok) return flags;
    flags = sanitizeFlags(await remote.json());
    writeCache();
    return flags;
  } catch {
    return flags;
  }
}

export function loadRemoteFlags(configUrl: string): Promise<RemoteFlags> {
  if (!pending) pending = fetchFlags(configUrl);
  return pending;
}

export function countEvent(name: string) {
  const payload = countPayload(name);
  if (!payload || !flags.counts || !worker) return;
  void fetch(`${worker}/event`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}
