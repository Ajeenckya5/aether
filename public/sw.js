const CACHE = "aether-shell-v1";
const SHELL = ["./offline.html", "./icon-192.png", "./icon-512.png", "./media/route.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

function weatherHost(hostname) {
  return (
    hostname === "api.open-meteo.com" ||
    hostname === "air-quality-api.open-meteo.com" ||
    hostname === "geocoding-api.open-meteo.com" ||
    hostname === "api.bigdatacloud.net"
  );
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response && response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  if (!cached) return fresh;
  const age = Date.now() - Number(cached.headers.get("x-aether-cached") || 0);
  if (age > 30 * 60 * 1000) void fresh;
  return cached;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (weatherHost(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && url.pathname.indexOf("/api/") === -1) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          return caches.match("./offline.html");
        }
        return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }),
  );
});
