/** Same-device notice that a strap sample arrived. The payload is bpm and a timestamp only. */
export function publishLiveBpm(bpm: number | null) {
  if (typeof window === "undefined") return;
  const payload = { bpm, at: Date.now() };
  try {
    if (bpm == null) localStorage.removeItem("aether-hr-live");
    else localStorage.setItem("aether-hr-live", JSON.stringify(payload));
  } catch {
    /* private mode */
  }
  try {
    const channel = new BroadcastChannel("aether-hr");
    channel.postMessage(payload);
    channel.close();
  } catch {
    /* older browsers */
  }
}
