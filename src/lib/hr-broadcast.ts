/** Same-device notice that a strap sample arrived. The payload is bpm and a timestamp only. */
export function publishLiveBpm(bpm: number | null) {
  if (typeof window === "undefined") return;
  try {
    const channel = new BroadcastChannel("aether-hr");
    channel.postMessage({ bpm, at: Date.now() });
    channel.close();
  } catch {
    /* older browsers */
  }
}
