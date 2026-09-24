import { describe, expect, it } from "vitest";
import { handleRequest, sqlStore } from "../../workers/config/src/index.js";

const ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CIPHER = { v: 1, iv: "AAAAAAAAAAAAAAAA", ct: "BBBBBBBBBBBB" };

function fakeSql() {
  const kv = new Map<string, string>();
  const blobs = new Map<string, { iv: string; ct: string }>();
  return {
    exec(statement: string, ...args: string[]) {
      const sql = statement.replace(/\s+/g, " ").trim();
      const done = { toArray: () => [] as unknown[] };
      if (sql.startsWith("CREATE")) return done;
      if (sql.startsWith("SELECT value")) {
        const value = kv.get(args[0]);
        return { toArray: () => (value == null ? [] : [{ value }]) };
      }
      if (sql.startsWith("INSERT INTO kv")) {
        kv.set(args[0], args[1]);
        return done;
      }
      if (sql.startsWith("SELECT iv")) {
        const row = blobs.get(args[0]);
        return { toArray: () => (row ? [row] : []) };
      }
      if (sql.startsWith("INSERT INTO blobs")) {
        blobs.set(args[0], { iv: args[1], ct: args[2] });
        return done;
      }
      if (sql.startsWith("DELETE")) {
        blobs.delete(args[0]);
        return done;
      }
      throw new Error(sql);
    },
  };
}

function call(store: ReturnType<typeof sqlStore>, method: string, path: string, body?: unknown) {
  return handleRequest(
    new Request(`https://backup.test${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
    store,
  );
}

describe("backup worker", () => {
  it("stores ciphertext and restores the same bytes", async () => {
    const store = sqlStore(fakeSql());
    const put = await call(store, "PUT", `/blob/${ID}`, CIPHER);
    expect(put.status).toBe(200);
    const got = await call(store, "GET", `/blob/${ID}`);
    expect(got.status).toBe(200);
    expect(await got.json()).toEqual(CIPHER);
  });

  it("refuses a body that carries a health field", async () => {
    const store = sqlStore(fakeSql());
    const put = await call(store, "PUT", `/blob/${ID}`, { ...CIPHER, bpm: 140 });
    expect(put.status).toBe(400);
    const got = await call(store, "GET", `/blob/${ID}`);
    expect(got.status).toBe(404);
  });

  it("deletes a stored blob", async () => {
    const store = sqlStore(fakeSql());
    await call(store, "PUT", `/blob/${ID}`, CIPHER);
    const removed = await call(store, "DELETE", `/blob/${ID}`);
    expect(removed.status).toBe(200);
    expect((await call(store, "GET", `/blob/${ID}`)).status).toBe(404);
  });
});
