export type SportMedia = {
  video: string;
  poster: string;
  tint: string;
};

const DEFAULT_MEDIA: SportMedia = {
  video:
    "https://videos.pexels.com/video-files/3195394/3195394-sd_640_360_25fps.mp4",
  poster:
    "https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=1200",
  tint: "#2a2418",
};

const BY_KEY: Record<string, SportMedia> = {
  running: {
    video:
      "https://videos.pexels.com/video-files/4753989/4753989-sd_640_360_30fps.mp4",
    poster:
      "https://images.pexels.com/photos/2803158/pexels-photo-2803158.jpeg?auto=compress&cs=tinysrgb&w=1200",
    tint: "#1b2a18",
  },
  cycling: {
    video:
      "https://videos.pexels.com/video-files/6455557/6455557-sd_640_360_25fps.mp4",
    poster:
      "https://images.pexels.com/photos/1149601/pexels-photo-1149601.jpeg?auto=compress&cs=tinysrgb&w=1200",
    tint: "#18202a",
  },
  weightlifting: {
    video:
      "https://videos.pexels.com/video-files/5327468/5327468-sd_640_360_25fps.mp4",
    poster:
      "https://images.pexels.com/photos/1552249/pexels-photo-1552249.jpeg?auto=compress&cs=tinysrgb&w=1200",
    tint: "#2a1c16",
  },
  "functional-fitness": {
    video:
      "https://videos.pexels.com/video-files/8093156/8093156-sd_640_360_25fps.mp4",
    poster:
      "https://images.pexels.com/photos/416778/pexels-photo-416778.jpeg?auto=compress&cs=tinysrgb&w=1200",
    tint: "#241818",
  },
  walking: {
    video:
      "https://videos.pexels.com/video-files/4322002/4322002-sd_640_360_25fps.mp4",
    poster:
      "https://images.pexels.com/photos/1571939/pexels-photo-1571939.jpeg?auto=compress&cs=tinysrgb&w=1200",
    tint: "#1a2418",
  },
  yoga: {
    video:
      "https://videos.pexels.com/video-files/3822145/3822145-sd_640_360_30fps.mp4",
    poster:
      "https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=1200",
    tint: "#1c1828",
  },
  hiit: {
    video:
      "https://videos.pexels.com/video-files/2783703/2783703-sd_640_360_30fps.mp4",
    poster:
      "https://images.pexels.com/photos/2294361/pexels-photo-2294361.jpeg?auto=compress&cs=tinysrgb&w=1200",
    tint: "#2a1614",
  },
  swimming: {
    video:
      "https://videos.pexels.com/video-files/894698/894698-sd_640_360_24fps.mp4",
    poster:
      "https://images.pexels.com/photos/863988/pexels-photo-863988.jpeg?auto=compress&cs=tinysrgb&w=1200",
    tint: "#102028",
  },
  hiking: {
    video:
      "https://videos.pexels.com/video-files/4828054/4828054-sd_640_360_24fps.mp4",
    poster:
      "https://images.pexels.com/photos/1365425/pexels-photo-1365425.jpeg?auto=compress&cs=tinysrgb&w=1200",
    tint: "#1a2216",
  },
  pilates: {
    video:
      "https://videos.pexels.com/video-files/3822145/3822145-sd_640_360_30fps.mp4",
    poster:
      "https://images.pexels.com/photos/4056723/pexels-photo-4056723.jpeg?auto=compress&cs=tinysrgb&w=1200",
    tint: "#221828",
  },
  boxing: {
    video:
      "https://videos.pexels.com/video-files/4754077/4754077-sd_640_360_30fps.mp4",
    poster:
      "https://images.pexels.com/photos/4761792/pexels-photo-4761792.jpeg?auto=compress&cs=tinysrgb&w=1200",
    tint: "#2a1414",
  },
  rowing: {
    video:
      "https://videos.pexels.com/video-files/5752729/5752729-sd_640_360_30fps.mp4",
    poster:
      "https://images.pexels.com/photos/221210/pexels-photo-221210.jpeg?auto=compress&cs=tinysrgb&w=1200",
    tint: "#142028",
  },
};

export function mediaForSport(sportName: string): SportMedia {
  const key = sportName.toLowerCase().replace(/[\s_]+/g, "-");
  return BY_KEY[key] ?? DEFAULT_MEDIA;
}
