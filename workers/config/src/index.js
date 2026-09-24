import { blobId, ciphertextBody } from "./ciphertext.js";
import { BLOB_MAX_BYTES, KEY_BYTE_CAP, RATE_LIMIT, RATE_WINDOW_MS, SIGN_WINDOW_MS, verifyBackup } from "./sign.js";

const FLAGS = ["liveHr", "haptics", "chips", "weather", "trends", "counts"];
const COUNTS = new Set(["zone", "chip", "weather", "range", "banner"]);
const DEFAULTS = {
  liveHr: true,
  haptics: true,
  chips: true,
  weather: true,
  trends: true,
  counts: false,
};

function json(body, status = 200, cache = "public, max-age=60") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type, x-aether-key, x-aether-time, x-aether-sig",
      "cache-control": cache,
    },
  });
}

function rows(cursor) {
  if (!cursor) return [];
  if (typeof cursor.toArray === "function") return cursor.toArray();
  return [...cursor];
}

/** SQLite inside one Durable Object. Free plan. Ciphertext rows only, each bound to one device key. */
export function sqlStore(sql) {
  sql.exec("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  sql.exec(
    "CREATE TABLE IF NOT EXISTS blobs (id TEXT PRIMARY KEY, iv TEXT NOT NULL, ct TEXT NOT NULL, owner TEXT NOT NULL DEFAULT '', bytes INTEGER NOT NULL DEFAULT 0)",
  );
  try {
    sql.exec("ALTER TABLE blobs ADD COLUMN owner TEXT NOT NULL DEFAULT ''");
  } catch {
    /* column already exists */
  }
  try {
    sql.exec("ALTER TABLE blobs ADD COLUMN bytes INTEGER NOT NULL DEFAULT 0");
  } catch {
    /* column already exists */
  }
  return {
    get(key) {
      const row = rows(sql.exec("SELECT value FROM kv WHERE key = ?", key))[0];
      return row ? row.value : null;
    },
    set(key, value) {
      sql.exec(
        "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        key,
        value,
      );
    },
    getBlob(id) {
      const row = rows(sql.exec("SELECT iv, ct, owner, bytes FROM blobs WHERE id = ?", id))[0];
      if (!row) return null;
      return {
        v: 1,
        iv: row.iv,
        ct: row.ct,
        owner: row.owner || "",
        bytes: Number(row.bytes) || 0,
      };
    },
    putBlob(id, body, owner, size) {
      sql.exec(
        "INSERT INTO blobs (id, iv, ct, owner, bytes) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET iv = excluded.iv, ct = excluded.ct, owner = excluded.owner, bytes = excluded.bytes",
        id,
        body.iv,
        body.ct,
        owner,
        size,
      );
    },
    deleteBlob(id) {
      sql.exec("DELETE FROM blobs WHERE id = ?", id);
    },
  };
}

function rememberSignature(store, auth, now) {
  const key = `seen:${auth.publicKey}`;
  const prev = JSON.parse(store.get(key) || "[]").filter((row) => now - row.at <= SIGN_WINDOW_MS);
  if (prev.some((row) => row.signature === auth.signature)) return false;
  prev.push({ signature: auth.signature, at: now });
  store.set(key, JSON.stringify(prev));
  return true;
}

function takeRate(store, publicKey, now) {
  const key = `rate:${publicKey}`;
  const prev = JSON.parse(store.get(key) || "null");
  const fresh = !prev || now - prev.start >= RATE_WINDOW_MS;
  const next = fresh ? { start: now, count: 1 } : { start: prev.start, count: prev.count + 1 };
  if (next.count > RATE_LIMIT) return false;
  store.set(key, JSON.stringify(next));
  return true;
}

async function gateBlob(request, raw, store, now) {
  if (raw.byteLength > BLOB_MAX_BYTES) return { response: json({ ok: false }, 413, "no-store") };
  const auth = await verifyBackup(request, raw, now);
  if (!auth) return { response: json({ ok: false }, 401, "no-store") };
  if (!rememberSignature(store, auth, now)) return { response: json({ ok: false }, 401, "no-store") };
  if (!takeRate(store, auth.publicKey, now)) return { response: json({ ok: false }, 429, "no-store") };
  return { auth };
}

function readFlags(raw) {
  const flags = { ...DEFAULTS };
  if (!raw) return flags;
  try {
    const parsed = JSON.parse(raw);
    for (const key of FLAGS) {
      if (typeof parsed[key] === "boolean") flags[key] = parsed[key];
    }
  } catch {
    /* keep defaults */
  }
  return flags;
}

export async function handleRequest(request, store, now = Date.now()) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
        "access-control-allow-headers": "content-type, x-aether-key, x-aether-time, x-aether-sig",
      },
    });
  }
  if (request.method === "GET" && url.pathname === "/config") {
    return json(readFlags(store.get("config")));
  }
  const blob = url.pathname.match(/^\/blob\/([a-f0-9]{32})$/);
  if (blob) {
    const id = blobId(blob[1]);
    if (!id) return json({ ok: false }, 400, "no-store");
    if (request.method !== "GET" && request.method !== "PUT" && request.method !== "DELETE") {
      return json({ ok: false }, 405, "no-store");
    }
    const raw = new Uint8Array(await request.arrayBuffer());
    const gated = await gateBlob(request, raw, store, now);
    if (gated.response) return gated.response;
    const owner = gated.auth.publicKey;
    if (request.method === "GET") {
      const stored = store.getBlob(id);
      if (!stored) return json({ ok: false }, 404, "no-store");
      if (stored.owner !== owner) return json({ ok: false }, 403, "no-store");
      return json({ v: 1, iv: stored.iv, ct: stored.ct }, 200, "private, no-store");
    }
    if (request.method === "PUT") {
      const existing = store.getBlob(id);
      if (existing && existing.owner && existing.owner !== owner) return json({ ok: false }, 403, "no-store");
      let parsed;
      try {
        parsed = ciphertextBody(JSON.parse(new TextDecoder().decode(raw)));
      } catch {
        parsed = null;
      }
      if (!parsed) return json({ ok: false }, 400, "no-store");
      const prevBytes = existing && existing.owner === owner ? existing.bytes : 0;
      const used = Number(store.get(`bytes:${owner}`) || "0");
      const nextUsed = used - prevBytes + raw.byteLength;
      if (nextUsed > KEY_BYTE_CAP) return json({ ok: false }, 413, "no-store");
      store.putBlob(id, parsed, owner, raw.byteLength);
      store.set(`bytes:${owner}`, String(nextUsed));
      return json({ ok: true }, 200, "no-store");
    }
    const existing = store.getBlob(id);
    if (existing && existing.owner && existing.owner !== owner) return json({ ok: false }, 403, "no-store");
    if (existing && existing.owner === owner) {
      const used = Number(store.get(`bytes:${owner}`) || "0");
      store.set(`bytes:${owner}`, String(Math.max(0, used - existing.bytes)));
    }
    store.deleteBlob(id);
    return json({ ok: true }, 200, "no-store");
  }
  if (request.method === "POST" && url.pathname === "/event") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false }, 400);
    }
    const keys = body && typeof body === "object" ? Object.keys(body) : [];
    if (keys.length !== 1 || keys[0] !== "name" || !COUNTS.has(body.name)) {
      return json({ ok: false }, 400);
    }
    const key = `count:${body.name}`;
    const next = Number(store.get(key) || "0") + 1;
    store.set(key, String(next));
    return json({ ok: true });
  }
  return json({ ok: false }, 404);
}

export class BackupStore {
  constructor(ctx) {
    this.store = sqlStore(ctx.storage.sql);
  }

  fetch(request) {
    return handleRequest(request, this.store);
  }
}

export default {
  async fetch(request, env) {
    const id = env.BACKUP.idFromName("aether");
    return env.BACKUP.get(id).fetch(request);
  },
};
