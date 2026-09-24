const MEDIA = /\.(mp4|webm|m4v|mov|m3u8|mp3|m4a)(\?|$)/i;
const STREAM_HOST = /(?:youtube|youtu\.be|ytimg|googlevideo)/i;

const sessionUrls = new Set<string>();

export function isWorkoutMedia(url: string): boolean {
  return MEDIA.test(url) || STREAM_HOST.test(url);
}

/** Pull a clip into this tab only. The object URL is dropped when the session ends. */
export async function streamSessionMedia(src: string): Promise<string> {
  const response = await fetch(src, { cache: "no-store" });
  if (!response.ok) throw new Error("Media did not load.");
  const url = URL.createObjectURL(await response.blob());
  sessionUrls.add(url);
  return url;
}

export async function releaseSessionMedia(): Promise<void> {
  for (const url of sessionUrls) URL.revokeObjectURL(url);
  sessionUrls.clear();
  if (typeof caches === "undefined" || !caches.keys) return;
  const names = await caches.keys();
  for (const name of names) {
    if (!name.startsWith("aether-") && !name.startsWith("pact-")) continue;
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      if (isWorkoutMedia(request.url)) await cache.delete(request);
    }
  }
}
