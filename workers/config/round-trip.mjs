import { bytesToB64, sha256Hex, signBackup } from "./src/sign.js";

const base = (process.argv[2] || "").replace(/\/$/, "");
if (!base) {
  console.error("Missing worker URL");
  process.exit(1);
}

const id = [...crypto.getRandomValues(new Uint8Array(16))]
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");
const payload = JSON.stringify({ v: 1, iv: "AAAAAAAAAAAAAAAA", ct: "BBBBBBBBBBBB" });

const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const publicKey = bytesToB64(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));

async function call(method, body) {
  const bytes = new TextEncoder().encode(body);
  const headers = await signBackup({
    method,
    path: `/blob/${id}`,
    body: bytes,
    privateKey: pair.privateKey,
    publicKey,
    now: Date.now(),
  });
  const response = await fetch(`${base}/blob/${id}`, {
    method,
    headers: body ? { "content-type": "application/json", ...headers } : headers,
    body: body || undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(method, response.status, text);
    process.exit(1);
  }
  return text;
}

await call("PUT", payload);
const restored = await call("GET", "");
const parsed = JSON.parse(restored);
if (parsed.v !== 1 || parsed.ct !== "BBBBBBBBBBBB" || parsed.bpm != null || parsed.iv == null) {
  console.error(restored);
  process.exit(1);
}
if (Object.keys(parsed).sort().join() !== "ct,iv,v") {
  console.error(restored);
  process.exit(1);
}
const hash = await sha256Hex(new TextEncoder().encode(payload));
if (!/^[a-f0-9]{64}$/.test(hash)) process.exit(1);
await call("DELETE", "");
console.log(`round trip ok ${id}`);
