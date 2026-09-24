const CACHE = "aether-shell-v1";
const SHELL_LIMIT = 2 * 1024 * 1024;
const SHELL = ["./offline.html", "./icons/icon-192.png", "./icons/icon-512.png", "./media/route.svg"];

function isWorkoutMedia(request, url) {
  if (request.destination === "video" || request.destination === "audio") return true;
  return /\.(mp4|webm|m4v|mov|m3u8|mp3|m4a)(\?|$)/i.test(url.pathname);
}

function shellRequest(request, url) {
  if (isWorkoutMedia(request, url)) return false;
  if (url.pathname.indexOf("/api/") !== -1) return false;
  if (request.mode === "navigate") return true;
  return /\/(?:offline\.html|manifest\.webmanifest|sw\.js|route\.svg)$/.test(url.pathname) || /\/icons\/[^/]+\.png$/.test(url.pathname);
}

async function cacheBytes(cache) {
  const requests = await cache.keys();
  let total = 0;
  for (const request of requests) {
    const response = await cache.match(request);
    if (!response) continue;
    total += (await response.clone().arrayBuffer()).byteLength;
  }
  return total;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("aether-") && key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isWorkoutMedia(request, url)) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (shellRequest(request, url) && response && response.ok) {
          const copy = response.clone();
          void caches.open(CACHE).then(async (cache) => {
            const body = await copy.clone().arrayBuffer();
            if ((await cacheBytes(cache)) + body.byteLength > SHELL_LIMIT) return;
            await cache.put(request, new Response(body, { headers: copy.headers }));
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") return caches.match("./offline.html");
        return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      }),
  );
});
