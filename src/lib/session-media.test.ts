import { describe, expect, it } from "vitest";
import { isWorkoutMedia } from "./session-media";

describe("workout media", () => {
  it("treats streams as session media and leaves the app shell alone", () => {
    expect(isWorkoutMedia("https://cdn.example/session.mp4")).toBe(true);
    expect(isWorkoutMedia("https://www.youtube-nocookie.com/embed/abc")).toBe(true);
    expect(isWorkoutMedia("https://i.ytimg.com/vi/abc/hqdefault.jpg")).toBe(true);
    expect(isWorkoutMedia("/aether/media/route.svg")).toBe(false);
    expect(isWorkoutMedia("/aether/offline.html")).toBe(false);
  });
});