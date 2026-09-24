import { blobId, ciphertextBody } from "./ciphertext.js";

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
      "access-control-allow-headers": "content-type",
      "cache-control": cache,
    },
  });
}

function rows(cursor) {
  if (!cursor) return [];
  if (typeof cursor.toArray === "function") return cursor.toArray();
  return [...cursor];
}

/** SQLite inside one Durable Object. Free plan. Ciphertext rows only. */
export function sqlStore(sql) {
  sql.exec("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  sql.exec("CREATE TABLE IF NOT EXISTS blobs (id TEXT PRIMARY KEY, iv TEXT NOT NULL, ct TEXT NOT NULL)");
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
      const row = rows(sql.exec("SELECT iv, ct FROM blobs WHERE id = ?", id))[0];
      return row ? { v: 1, iv: row.iv, ct: row.ct } : null;
    },
    putBlob(id, body) {
      sql.exec(
        "INSERT INTO blobs (id, iv, ct) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET iv = excluded.iv, ct = excluded.ct",
        id,
        body.iv,
        body.ct,
      );
    },
    deleteBlob(id) {
      sql.exec("DELETE FROM blobs WHERE id = ?", id);
    },
  };
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

export async function handleRequest(request, store) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
        "access-control-allow-headers": "content-type",
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
    if (request.method === "GET") {
      const body = ciphertextBody(store.getBlob(id));
      if (!body) return json({ ok: false }, 404, "no-store");
      return json(body, 200, "private, no-store");
    }
    if (request.method === "PUT") {
      let parsed;
      try {
        parsed = ciphertextBody(await request.json());
      } catch {
        parsed = null;
      }
      if (!parsed) return json({ ok: false }, 400, "no-store");
      store.putBlob(id, parsed);
      return json({ ok: true }, 200, "no-store");
    }
    if (request.method === "DELETE") {
      store.deleteBlob(id);
      return json({ ok: true }, 200, "no-store");
    }
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
