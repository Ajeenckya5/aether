import { describe, expect, it } from "vitest";
import { bytesToB64, canonicalBackup, signBackupRequest } from "@/lib/backup-auth";
import { handleRequest, sqlStore } from "../../workers/config/src/index.js";
import {
  BLOB_MAX_BYTES,
  KEY_BYTE_CAP,
  RATE_LIMIT,
  canonicalBackup as workerCanonical,
} from "../../workers/config/src/sign.js";

const ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CIPHER = { v: 1, iv: "AAAAAAAAAAAAAAAA", ct: "BBBBBBBBBBBB" };
const NOW = 1_700_000_000_000;

function fakeSql() {
  const kv = new Map<string, string>();
  const blobs = new Map<string, { iv: string; ct: string; owner: string; bytes: number }>();
  return {
    exec(statement: string, ...args: Array<string | number>) {
      const sql = statement.replace(/\s+/g, " ").trim();
      const done = { toArray: () => [] as unknown[] };
      if (sql.startsWith("CREATE") || sql.startsWith("ALTER")) return done;
      if (sql.startsWith("SELECT value")) {
        const value = kv.get(String(args[0]));
        return { toArray: () => (value == null ? [] : [{ value }]) };
      }
      if (sql.startsWith("INSERT INTO kv")) {
        kv.set(String(args[0]), String(args[1]));
        return done;
      }
      if (sql.startsWith("SELECT iv")) {
        const row = blobs.get(String(args[0]));
        return { toArray: () => (row ? [row] : []) };
      }
      if (sql.startsWith("INSERT INTO blobs")) {
        blobs.set(String(args[0]), {
          iv: String(args[1]),
          ct: String(args[2]),
          owner: String(args[3]),
          bytes: Number(args[4]),
        });
        return done;
      }
      if (sql.startsWith("DELETE")) {
        blobs.delete(String(args[0]));
        return done;
      }
      throw new Error(sql);
    },
  };
}

async function device() {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicKey = bytesToB64(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
  return { privateKey: pair.privateKey, publicKey };
}

async function authed(
  store: ReturnType<typeof sqlStore>,
  method: string,
  path: string,
  body: unknown,
  signer: { privateKey: CryptoKey; publicKey: string },
  now = NOW,
) {
  const payload = body == null ? "" : typeof body === "string" ? body : JSON.stringify(body);
  const bytes = new TextEncoder().encode(payload);
  const headers = await signBackupRequest({
    method,
    path,
    body: bytes,
    privateKey: signer.privateKey,
    publicKey: signer.publicKey,
    now,
  });
  return handleRequest(
    new Request(`https://backup.test${path}`, {
      method,
      headers: body == null ? headers : { "content-type": "application/json", ...headers },
      body: body == null ? undefined : payload,
    }),
    store,
    now,
  );
}

describe("backup worker", () => {
  it("uses the same signed payload as the phone", () => {
    expect(canonicalBackup("PUT", "/blob/ab", "10", "ff")).toBe(workerCanonical("PUT", "/blob/ab", "10", "ff"));
  });

  it("stores ciphertext and restores the same bytes", async () => {
    const store = sqlStore(fakeSql());
    const signer = await device();
    const put = await authed(store, "PUT", `/blob/${ID}`, CIPHER, signer);
    expect(put.status).toBe(200);
    const got = await authed(store, "GET", `/blob/${ID}`, null, signer);
    expect(got.status).toBe(200);
    const restored = await got.json();
    expect(restored).toEqual(CIPHER);
    expect(Object.keys(restored).sort()).toEqual(["ct", "iv", "v"]);
  });

  it("refuses a body that carries a health field", async () => {
    const store = sqlStore(fakeSql());
    const signer = await device();
    const put = await authed(store, "PUT", `/blob/${ID}`, { ...CIPHER, bpm: 140 }, signer);
    expect(put.status).toBe(400);
    const got = await authed(store, "GET", `/blob/${ID}`, null, signer);
    expect(got.status).toBe(404);
  });

  it("deletes a stored blob", async () => {
    const store = sqlStore(fakeSql());
    const signer = await device();
    await authed(store, "PUT", `/blob/${ID}`, CIPHER, signer);
    const removed = await authed(store, "DELETE", `/blob/${ID}`, null, signer);
    expect(removed.status).toBe(200);
    expect((await authed(store, "GET", `/blob/${ID}`, null, signer)).status).toBe(404);
  });

  it("refuses an unsigned request", async () => {
    const store = sqlStore(fakeSql());
    const put = await handleRequest(
      new Request(`https://backup.test/blob/${ID}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(CIPHER),
      }),
      store,
      NOW,
    );
    expect(put.status).toBe(401);
  });

  it("refuses a different device key", async () => {
    const store = sqlStore(fakeSql());
    const owner = await device();
    const other = await device();
    expect((await authed(store, "PUT", `/blob/${ID}`, CIPHER, owner)).status).toBe(200);
    expect((await authed(store, "GET", `/blob/${ID}`, null, other)).status).toBe(403);
    expect((await authed(store, "PUT", `/blob/${ID}`, CIPHER, other)).status).toBe(403);
    expect((await authed(store, "DELETE", `/blob/${ID}`, null, other)).status).toBe(403);
    const kept = await authed(store, "GET", `/blob/${ID}`, null, owner);
    expect(await kept.json()).toEqual(CIPHER);
  });

  it("refuses a replayed signature", async () => {
    const store = sqlStore(fakeSql());
    const signer = await device();
    const payload = JSON.stringify(CIPHER);
    const bytes = new TextEncoder().encode(payload);
    const headers = await signBackupRequest({
      method: "PUT",
      path: `/blob/${ID}`,
      body: bytes,
      privateKey: signer.privateKey,
      publicKey: signer.publicKey,
      now: NOW,
    });
    const send = () =>
      handleRequest(
        new Request(`https://backup.test/blob/${ID}`, {
          method: "PUT",
          headers: { "content-type": "application/json", ...headers },
          body: payload,
        }),
        store,
        NOW,
      );
    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(401);
  });

  it("refuses an oversized blob", async () => {
    const store = sqlStore(fakeSql());
    const signer = await device();
    const huge = "a".repeat(BLOB_MAX_BYTES + 1);
    const put = await authed(store, "PUT", `/blob/${ID}`, huge, signer);
    expect(put.status).toBe(413);
  });

  it("stops a key once it is over its rate and byte caps", async () => {
    const store = sqlStore(fakeSql());
    const signer = await device();
    for (let i = 0; i < RATE_LIMIT; i += 1) {
      const id = i.toString(16).padStart(32, "b");
      expect((await authed(store, "PUT", `/blob/${id}`, CIPHER, signer)).status).toBe(200);
    }
    const blocked = await authed(store, "PUT", `/blob/${"c".repeat(32)}`, CIPHER, signer);
    expect(blocked.status).toBe(429);

    const fresh = sqlStore(fakeSql());
    fresh.set(`bytes:${signer.publicKey}`, String(KEY_BYTE_CAP));
    const over = await authed(fresh, "PUT", `/blob/${ID}`, CIPHER, signer);
    expect(over.status).toBe(413);
  });
});
