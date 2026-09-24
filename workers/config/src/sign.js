/** Signed blob requests. The device Ed25519 key signs method, path, timestamp, and body hash. */

export const SIGN_WINDOW_MS = 60_000;
export const BLOB_MAX_BYTES = 256 * 1024;
export const RATE_LIMIT = 60;
export const RATE_WINDOW_MS = 60_000;
export const KEY_BYTE_CAP = 8 * 1024 * 1024;

export function canonicalBackup(method, path, timestamp, bodyHash) {
  return `${method}\n${path}\n${timestamp}\n${bodyHash}`;
}

export function bytesToB64(bytes) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

export function b64ToBytes(value) {
  const text = atob(value);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i);
  return bytes;
}

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signBackup({ method, path, body, privateKey, publicKey, now }) {
  const timestamp = String(now);
  const bodyHash = await sha256Hex(body);
  const message = new TextEncoder().encode(canonicalBackup(method, path, timestamp, bodyHash));
  const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, message));
  return {
    "x-aether-key": publicKey,
    "x-aether-time": timestamp,
    "x-aether-sig": bytesToB64(signature),
  };
}

/**
 * Returns the device public key when the signature is valid and inside the 60s window.
 * The caller records the signature so the same request cannot be replayed.
 */
export async function verifyBackup(request, body, now) {
  const publicKey = (request.headers.get("x-aether-key") || "").trim();
  const timestamp = (request.headers.get("x-aether-time") || "").trim();
  const signature = (request.headers.get("x-aether-sig") || "").trim();
  if (!/^\d+$/.test(timestamp)) return null;
  const at = Number(timestamp);
  if (Math.abs(now - at) > SIGN_WINDOW_MS) return null;
  let pub;
  let sig;
  try {
    pub = b64ToBytes(publicKey);
    sig = b64ToBytes(signature);
  } catch {
    return null;
  }
  if (pub.length !== 32 || sig.length !== 64) return null;
  const path = new URL(request.url).pathname;
  const bodyHash = await sha256Hex(body);
  const message = new TextEncoder().encode(canonicalBackup(request.method, path, timestamp, bodyHash));
  try {
    const key = await crypto.subtle.importKey("raw", pub, { name: "Ed25519" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("Ed25519", key, sig, message);
    if (!ok) return null;
  } catch {
    return null;
  }
  return { publicKey, signature };
}
