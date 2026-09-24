import type { LiveLog } from "./sessions";
import type { OvernightSummary } from "./overnight";
import {
  archiveWindow,
  blobId,
  ciphertextBody,
  splitByAge,
  type Ciphertext,
  type StoredNight,
  type StoredRecord,
  type StoredWorkout,
} from "./history";
import { currentWorker } from "./remote-config";
import { bytesToB64 as signBytesToB64, signBackupRequest } from "./backup-auth";

const HOT_KEY = "aether-history-v1";
const INDEX_KEY = "aether-history-index-v1";
const QUEUE_KEY = "aether-history-queue-v1";
const KEY_KEY = "aether-history-key-v1";
const SIGN_KEY = "aether-history-sign-v1";

type IndexRow = { id: string; at: number; kind: StoredRecord["kind"] };
type Hot = { nights: StoredNight[]; workouts: StoredWorkout[] };

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    return (JSON.parse(localStorage.getItem(key) || "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function hot(): Hot {
  const raw = readJson<Partial<Hot>>(HOT_KEY, {});
  return {
    nights: Array.isArray(raw.nights) ? raw.nights : [],
    workouts: Array.isArray(raw.workouts) ? raw.workouts : [],
  };
}

function indexRows(): IndexRow[] {
  const rows = readJson<IndexRow[]>(INDEX_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function queue(): Record<string, Ciphertext> {
  const rows = readJson<Record<string, Ciphertext>>(QUEUE_KEY, {});
  return rows && typeof rows === "object" ? rows : {};
}

function bytesToB64(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function b64ToBytes(value: string): ArrayBuffer {
  const text = atob(value);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i);
  return bytes.buffer;
}

async function deviceKey(): Promise<CryptoKey> {
  const existing = localStorage.getItem(KEY_KEY);
  if (existing) {
    return crypto.subtle.importKey("raw", b64ToBytes(existing), "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  const created = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", created));
  localStorage.setItem(KEY_KEY, bytesToB64(raw));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(record: StoredRecord): Promise<Ciphertext> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(record));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await deviceKey(), encoded));
  return ciphertextBody({ v: 1, iv: bytesToB64(iv), ct: bytesToB64(cipher) })!;
}

async function decrypt(body: Ciphertext): Promise<StoredRecord | null> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(body.iv) },
      await deviceKey(),
      b64ToBytes(body.ct),
    );
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as StoredRecord;
    if (!parsed || (parsed.kind !== "night" && parsed.kind !== "workout")) return null;
    return parsed;
  } catch {
    return null;
  }
}

function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function deviceSigner(): Promise<{ privateKey: CryptoKey; publicKey: string }> {
  const existing = localStorage.getItem(SIGN_KEY);
  if (existing) {
    const parsed = JSON.parse(existing) as { priv?: string; pub?: string };
    if (parsed.priv && parsed.pub) {
      const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        b64ToBytes(parsed.priv),
        { name: "Ed25519" },
        false,
        ["sign"],
      );
      return { privateKey, publicKey: parsed.pub };
    }
  }
  const created = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const priv = new Uint8Array(await crypto.subtle.exportKey("pkcs8", created.privateKey));
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", created.publicKey));
  const stored = { priv: signBytesToB64(priv), pub: signBytesToB64(pub) };
  localStorage.setItem(SIGN_KEY, JSON.stringify(stored));
  return { privateKey: created.privateKey, publicKey: stored.pub };
}

async function signedBlob(method: "GET" | "PUT" | "DELETE", id: string, body?: Ciphertext): Promise<Response> {
  const worker = currentWorker();
  const signer = await deviceSigner();
  const payload = body ? JSON.stringify(body) : "";
  const bytes = new TextEncoder().encode(payload);
  const headers = await signBackupRequest({
    method,
    path: `/blob/${id}`,
    body: bytes,
    privateKey: signer.privateKey,
    publicKey: signer.publicKey,
    now: Date.now(),
  });
  return fetch(`${worker}/blob/${id}`, {
    method,
    headers: body ? { "content-type": "application/json", ...headers } : headers,
    body: body ? payload : undefined,
    cache: "no-store",
  });
}

async function putBlob(id: string, body: Ciphertext): Promise<boolean> {
  const worker = currentWorker();
  if (!worker || !blobId(id)) return false;
  try {
    const response = await signedBlob("PUT", id, body);
    return response.ok;
  } catch {
    return false;
  }
}

async function getBlob(id: string): Promise<Ciphertext | null> {
  const pending = queue()[id];
  if (pending) return ciphertextBody(pending);
  const worker = currentWorker();
  if (!worker) return null;
  try {
    const response = await signedBlob("GET", id);
    if (!response.ok) return null;
    return ciphertextBody(await response.json());
  } catch {
    return null;
  }
}

async function storeCipher(id: string, body: Ciphertext) {
  const uploaded = await putBlob(id, body);
  const pending = queue();
  if (uploaded) delete pending[id];
  else pending[id] = body;
  writeJson(QUEUE_KEY, pending);
}

export async function archiveRecords(rows: StoredRecord[]): Promise<void> {
  if (typeof localStorage === "undefined" || rows.length === 0) return;
  const index = indexRows();
  const known = new Set(index.map((row) => `${row.kind}:${row.at}`));
  for (const row of rows) {
    const stamp = `${row.kind}:${row.at}`;
    if (known.has(stamp)) continue;
    const id = newId();
    const body = await encrypt(row);
    await storeCipher(id, body);
    index.push({ id, at: row.at, kind: row.kind });
    known.add(stamp);
  }
  writeJson(INDEX_KEY, index);
}

export function workoutRecord(log: LiveLog): StoredWorkout {
  return {
    kind: "workout",
    at: Date.parse(log.start),
    id: log.id,
    start: log.start,
    end: log.end,
    sport: log.sport,
    strain: log.strainProxy,
    avgHr: log.avgHr,
    maxHr: log.maxHr,
    distanceM: log.distanceM,
    zoneMs: log.zoneMs,
  };
}

export function nightRecord(summary: OvernightSummary): StoredNight {
  return {
    kind: "night",
    at: summary.end,
    end: new Date(summary.end).toISOString(),
    restMs: summary.restMs,
    awakeMs: summary.awakeMs,
    quietMs: summary.quietMs,
    deepMs: summary.deepMs,
    activeMs: summary.activeMs,
    rmssd: summary.rmssd,
    restHr: summary.restHr,
    recovery: summary.recovery,
  };
}

export function retainHot(rows: StoredRecord[], now = Date.now()): StoredRecord[] {
  const current = hot();
  const nights = new Map(current.nights.map((row) => [row.at, row]));
  const workouts = new Map(current.workouts.map((row) => [row.id, row]));
  for (const row of rows) {
    if (row.kind === "night") nights.set(row.at, row);
    else workouts.set(row.id, row);
  }
  const nightSplit = splitByAge([...nights.values()], now);
  const workoutSplit = splitByAge([...workouts.values()], now);
  writeJson(HOT_KEY, { nights: nightSplit.recent, workouts: workoutSplit.recent });
  return [...nightSplit.older, ...workoutSplit.older];
}

export async function rememberNight(summary: OvernightSummary | null): Promise<void> {
  if (!summary) return;
  const next = nightRecord(summary);
  const saved = hot().nights.find((row) => row.at === next.at);
  if (saved && JSON.stringify(saved) === JSON.stringify(next)) return;
  const older = retainHot([next]);
  await archiveRecords(older);
}

export async function rememberWorkout(log: LiveLog): Promise<void> {
  const older = retainHot([workoutRecord(log)]);
  await archiveRecords(older);
}

export async function loadForTrend(trendDays: number, now = Date.now()): Promise<StoredRecord[]> {
  const window = archiveWindow(now, trendDays);
  if (!window || typeof localStorage === "undefined") return [];
  const wanted = indexRows().filter((row) => row.at >= window.from && row.at < window.to);
  const rows: StoredRecord[] = [];
  for (const item of wanted) {
    const body = await getBlob(item.id);
    if (!body) continue;
    const record = await decrypt(body);
    if (record) rows.push(record);
  }
  return rows;
}

export async function deleteArchivedBlobs(): Promise<void> {
  const worker = currentWorker();
  const ids = indexRows().map((row) => row.id);
  if (worker) {
    await Promise.all(
      ids.map((id) => signedBlob("DELETE", id).catch(() => undefined)),
    );
  }
  localStorage.removeItem(HOT_KEY);
  localStorage.removeItem(INDEX_KEY);
  localStorage.removeItem(QUEUE_KEY);
  localStorage.removeItem(KEY_KEY);
  localStorage.removeItem(SIGN_KEY);
}
