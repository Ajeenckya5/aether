/** Device signature for a backup blob. Must match workers/config/src/sign.js. */

export function canonicalBackup(method: string, path: string, timestamp: string, bodyHash: string): string {
  return `${method}\n${path}\n${timestamp}\n${bodyHash}`;
}

export function bytesToB64(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signBackupRequest(input: {
  method: string;
  path: string;
  body: Uint8Array;
  privateKey: CryptoKey;
  publicKey: string;
  now: number;
}): Promise<Record<string, string>> {
  const timestamp = String(input.now);
  const bodyHash = await sha256Hex(input.body);
  const message = new TextEncoder().encode(
    canonicalBackup(input.method, input.path, timestamp, bodyHash),
  );
  const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", input.privateKey, message));
  return {
    "x-aether-key": input.publicKey,
    "x-aether-time": timestamp,
    "x-aether-sig": bytesToB64(signature),
  };
}
