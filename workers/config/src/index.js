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

export default {
  async fetch(request, env) {
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
      const raw = await env.FLAGS.get("config");
      return json(readFlags(raw));
    }
    const blob = url.pathname.match(/^\/blob\/([a-f0-9]{32})$/);
    if (blob) {
      const id = blobId(blob[1]);
      if (!id) return json({ ok: false }, 400, "no-store");
      const key = `blob:${id}`;
      if (request.method === "GET") {
        const stored = await env.FLAGS.get(key);
        const body = ciphertextBody(stored ? JSON.parse(stored) : null);
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
        await env.FLAGS.put(key, JSON.stringify(parsed));
        return json({ ok: true }, 200, "no-store");
      }
      if (request.method === "DELETE") {
        await env.FLAGS.delete(key);
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
      const next = Number((await env.FLAGS.get(key)) || "0") + 1;
      await env.FLAGS.put(key, String(next));
      return json({ ok: true });
    }
    return json({ ok: false }, 404);
  },
};
