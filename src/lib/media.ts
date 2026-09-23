import { appPath } from "./site";

export type SportMedia = {
  video: string;
  poster: string;
  tint: string;
};

const POSTER = appPath("/media/route.svg");

function art(tint: string): SportMedia {
  return { video: "", poster: POSTER, tint };
}

const DEFAULT_MEDIA = art("#2a2418");

const BY_KEY: Record<string, SportMedia> = {
  running: art("#1b2a18"),
  cycling: art("#18202a"),
  weightlifting: art("#2a1c16"),
  "functional-fitness": art("#241818"),
  walking: art("#1a2418"),
  yoga: art("#1c1828"),
  hiit: art("#2a1614"),
  swimming: art("#102028"),
  hiking: art("#1a2216"),
  pilates: art("#221828"),
  boxing: art("#2a1414"),
  rowing: art("#142028"),
};

export function mediaForSport(sportName: string): SportMedia {
  const key = sportName.toLowerCase().replace(/[\s_]+/g, "-");
  return BY_KEY[key] ?? DEFAULT_MEDIA;
}

export function isPlayableVideo(src: string): boolean {
  return /\.(mp4|webm)(\?|$)/i.test(src);
}
