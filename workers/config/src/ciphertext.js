const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function ciphertextBody(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const keys = Object.keys(input);
  if (keys.length !== 3 || input.v !== 1) return null;
  if (!keys.includes("v") || !keys.includes("iv") || !keys.includes("ct")) return null;
  if (typeof input.iv !== "string" || typeof input.ct !== "string") return null;
  if (!B64.test(input.iv) || !B64.test(input.ct)) return null;
  if (input.iv.length > 64 || input.ct.length > 200000) return null;
  return { v: 1, iv: input.iv, ct: input.ct };
}

export function blobId(id) {
  return /^[a-f0-9]{32}$/.test(id) ? id : null;
}
