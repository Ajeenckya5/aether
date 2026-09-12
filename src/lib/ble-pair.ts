export const BLE_PAIR_KEY = "aether-ble-pair-v1";

export type BlePairRecord = {
  id: string;
  name: string | null;
  keepAlive: boolean;
};

export function parseBlePair(raw: string | null | undefined): BlePairRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BlePairRecord>;
    if (!parsed || typeof parsed.id !== "string" || !parsed.id) return null;
    return {
      id: parsed.id,
      name: typeof parsed.name === "string" && parsed.name ? parsed.name : null,
      keepAlive: parsed.keepAlive !== false,
    };
  } catch {
    return null;
  }
}

export function loadBlePair(): BlePairRecord | null {
  if (typeof window === "undefined") return null;
  return parseBlePair(window.localStorage.getItem(BLE_PAIR_KEY));
}

export function saveBlePair(record: BlePairRecord) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BLE_PAIR_KEY, JSON.stringify(record));
}

export function setBleKeepAlive(keepAlive: boolean) {
  const current = loadBlePair();
  if (!current) return;
  saveBlePair({ ...current, keepAlive });
}

export function pickGrantedDevice<T extends { id: string; name?: string | null }>(
  devices: T[],
  saved: BlePairRecord | null,
): T | null {
  if (!devices.length) return null;
  if (saved) {
    const match = devices.find((device) => device.id === saved.id);
    if (match) return match;
    if (saved.name) {
      const named = devices.find(
        (device) => (device.name ?? "").toLowerCase() === saved.name!.toLowerCase(),
      );
      if (named) return named;
    }
  }
  const whoop = devices.find((device) => /whoop/i.test(device.name ?? ""));
  return whoop ?? devices[0] ?? null;
}

/** Backoff for keep-alive reconnects. Never gives up while keepAlive is on. */
export function reconnectDelayMs(attempt: number): number {
  const n = Math.max(0, Math.min(attempt, 6));
  return Math.min(12_000, 500 * 2 ** n);
}
