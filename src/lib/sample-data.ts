const KEY = "aether-sample-data-v1";
export const SAMPLE_DATA_EVENT = "aether-sample-data";

export function loadSampleData(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveSampleData(on: boolean) {
  localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(SAMPLE_DATA_EVENT));
}
