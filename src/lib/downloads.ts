export type DownloadUrls = {
  owner: string;
  repo: string;
  branch: string;
  repoUrl: string;
  zipUrl: string;
  cloneUrl: string;
  releasesUrl: string;
  playStoreUrl: string;
  appStoreUrl: string;
};

export const GITHUB_OWNER = "Ajeenckya5";
export const GITHUB_REPO = "aether";
export const GITHUB_BRANCH = "master";

export function buildDownloadUrls(input: {
  owner?: string;
  repo?: string;
  branch?: string;
  playStoreUrl?: string;
  appStoreUrl?: string;
} = {}): DownloadUrls {
  const owner = nonempty(input.owner) ?? GITHUB_OWNER;
  const repo = nonempty(input.repo) ?? GITHUB_REPO;
  const branch = nonempty(input.branch) ?? GITHUB_BRANCH;
  const repoUrl = `https://github.com/${owner}/${repo}`;
  return {
    owner,
    repo,
    branch,
    repoUrl,
    zipUrl: `${repoUrl}/archive/refs/heads/${branch}.zip`,
    cloneUrl: `${repoUrl}.git`,
    releasesUrl: `${repoUrl}/releases`,
    playStoreUrl: nonempty(input.playStoreUrl) ?? "",
    appStoreUrl: nonempty(input.appStoreUrl) ?? "",
  };
}

/** Client-safe: only NEXT_PUBLIC_* values. */
export function publicDownloadUrls(): DownloadUrls {
  return buildDownloadUrls({
    owner: process.env.NEXT_PUBLIC_GITHUB_OWNER,
    repo: process.env.NEXT_PUBLIC_GITHUB_REPO,
    branch: process.env.NEXT_PUBLIC_GITHUB_BRANCH,
    playStoreUrl: process.env.NEXT_PUBLIC_PLAY_STORE_URL,
    appStoreUrl: process.env.NEXT_PUBLIC_APP_STORE_URL,
  });
}

export function installHref(
  platform: "github" | "android" | "ios",
  urls: DownloadUrls,
): string {
  if (platform === "github") return urls.repoUrl;
  if (platform === "android") return urls.playStoreUrl || urls.repoUrl;
  return urls.appStoreUrl || urls.repoUrl;
}

export function storeListed(
  platform: "android" | "ios",
  urls: DownloadUrls,
): boolean {
  return platform === "android" ? Boolean(urls.playStoreUrl) : Boolean(urls.appStoreUrl);
}

function nonempty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
