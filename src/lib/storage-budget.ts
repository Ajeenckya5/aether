export const STORAGE_BUDGET = 5 * 1024 * 1024;
export const STORAGE_PRESSURE = 0.8 * STORAGE_BUDGET;
export const SHELL_CACHE = "aether-shell-v1";
export const SHELL_BUDGET = 2 * 1024 * 1024;

function storageAreaBytes(area: Storage, ownedOnly: boolean): number {
  let bytes = 0;
  for (let index = 0; index < area.length; index += 1) {
    const key = area.key(index) || "";
    if (ownedOnly && !key.startsWith("aether-")) continue;
    bytes += (key.length + String(area.getItem(key) || "").length) * 2;
  }
  return bytes;
}

export function localStorageBytes(ownedOnly = false): number {
  try {
    return storageAreaBytes(localStorage, ownedOnly);
  } catch {
    return 0;
  }
}

async function estimateUsage(): Promise<number> {
  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      return Number(estimate.usage) || 0;
    }
  } catch {
    return 0;
  }
  return 0;
}

async function ownedCacheBytes(): Promise<number> {
  if (typeof caches === "undefined" || !caches.keys) return 0;
  const names = (await caches.keys()).filter((name) => name.startsWith("aether-"));
  let total = 0;
  for (const name of names) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      if (!response) continue;
      total += (await response.clone().arrayBuffer()).byteLength;
    }
  }
  return total;
}

/** Origin usage from navigator.storage.estimate(), plus localStorage when the browser omits it. */
export async function measureStorage(): Promise<number> {
  const usage = await estimateUsage();
  const local = localStorageBytes(false);
  const ownedLocal = localStorageBytes(true);
  let foreignCache = false;
  if (typeof caches !== "undefined" && caches.keys) {
    foreignCache = (await caches.keys()).some((name) => !name.startsWith("aether-"));
  }
  if (local === ownedLocal && !foreignCache) {
    return usage < local ? usage + local : usage;
  }
  return ownedLocal + (await ownedCacheBytes());
}

export function formatMegabytes(bytes: number): string {
  return `${(Math.max(0, Number(bytes) || 0) / (1024 * 1024)).toFixed(1)} MB`;
}

export function oldestOwnedCaches(names: string[], current = SHELL_CACHE): string[] {
  return names.filter((name) => name.startsWith("aether-") && name !== current).sort();
}

export async function enforceStorageBudget(): Promise<number> {
  if ((await measureStorage()) < STORAGE_PRESSURE) return measureStorage();
  if (typeof caches !== "undefined" && caches.keys) {
    const names = oldestOwnedCaches(await caches.keys());
    for (const name of names) {
      if ((await measureStorage()) < STORAGE_PRESSURE) return measureStorage();
      await caches.delete(name);
    }
    if ((await measureStorage()) >= STORAGE_PRESSURE) {
      const cache = await caches.open(SHELL_CACHE);
      for (const request of await cache.keys()) {
        if ((await measureStorage()) < STORAGE_PRESSURE) return measureStorage();
        await cache.delete(request);
      }
    }
  }
  return measureStorage();
}

export async function clearAppData(): Promise<void> {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("aether-")) localStorage.removeItem(key);
    }
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("aether-")) sessionStorage.removeItem(key);
    }
  } catch {
    /* private mode */
  }
  try {
    if (typeof caches !== "undefined") {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("aether-")).map((name) => caches.delete(name)));
    }
  } catch {
    /* ignore */
  }
  try {
    const factory = indexedDB as IDBFactory & { databases?: () => Promise<Array<{ name?: string }>> };
    if (factory.databases) {
      const databases = await factory.databases();
      await Promise.all(
        databases
          .filter((database) => database.name?.startsWith("aether"))
          .map(
            (database) =>
              new Promise<void>((resolve) => {
                const request = indexedDB.deleteDatabase(database.name!);
                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
                request.onblocked = () => resolve();
              }),
          ),
      );
    }
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("aether-local"));
}

export const STORAGE_BOOT = `(function(){var TRIGGER=${STORAGE_PRESSURE};var CURRENT=${JSON.stringify(SHELL_CACHE)};function localBytes(owned){var n=0;try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i)||"";if(owned&&k.indexOf("aether-")!==0)continue;n+=(k.length+String(localStorage.getItem(k)||"").length)*2;}}catch(e){}return n;}async function used(){var usage=0;try{if(navigator.storage&&navigator.storage.estimate){var estimate=await navigator.storage.estimate();usage=Number(estimate.usage)||0;}}catch(e){}var local=localBytes(false);var owned=localBytes(true);var foreign=local!==owned;try{if(window.caches&&caches.keys){var names=await caches.keys();for(var i=0;i<names.length;i++){if(names[i].indexOf("aether-")!==0)foreign=true;}}}catch(e){}if(!foreign)return usage<local?usage+local:usage;var cacheBytes=0;try{var ownedNames=(await caches.keys()).filter(function(name){return name.indexOf("aether-")===0;});for(var n=0;n<ownedNames.length;n++){var cache=await caches.open(ownedNames[n]);var reqs=await cache.keys();for(var r=0;r<reqs.length;r++){var res=await cache.match(reqs[r]);if(res)cacheBytes+=(await res.clone().arrayBuffer()).byteLength;}}}catch(e){}return owned+cacheBytes;}async function evict(){if(!(window.caches&&caches.keys))return;if(await used()<TRIGGER)return;var names=(await caches.keys()).filter(function(name){return name.indexOf("aether-")===0&&name!==CURRENT;}).sort();for(var i=0;i<names.length;i++){if(await used()<TRIGGER)return;await caches.delete(names[i]);}if(await used()<TRIGGER)return;var cache=await caches.open(CURRENT);var reqs=await cache.keys();for(var j=0;j<reqs.length;j++){if(await used()<TRIGGER)return;await cache.delete(reqs[j]);}}void evict();})();`;
