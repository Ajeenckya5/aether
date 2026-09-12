import { buildDemoDashboard } from "./mock";
import {
  saveWhoopTokens,
  readWhoopSession,
  whoopConfigured,
} from "./session";
import type {
  BodyMeasurement,
  Collection,
  Cycle,
  Dashboard,
  Profile,
  Recovery,
  Sleep,
  Workout,
} from "./types";

const API = "https://api.prod.whoop.com/developer";
const TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

export async function exchangeCode(code: string, redirectUri: string) {
  return requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

async function refreshAccess(refreshToken: string) {
  return requestToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope:
      "offline read:recovery read:cycles read:sleep read:workout read:profile read:body_measurement",
  });
}

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("WHOOP API credentials are not configured.");
  }

  const payload = new URLSearchParams({
    ...body,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WHOOP token error (${res.status}): ${text}`);
  }

  return (await res.json()) as TokenResponse;
}

async function getAccessToken(): Promise<string | null> {
  const session = await readWhoopSession();
  if (session.accessToken && Date.now() < session.expiresAt - 60_000) {
    return session.accessToken;
  }
  if (!session.refreshToken) {
    return session.accessToken;
  }
  try {
    const tokens = await refreshAccess(session.refreshToken);
    await saveWhoopTokens(tokens);
    return tokens.access_token;
  } catch {
    return session.accessToken;
  }
}

async function whoopGet<T>(token: string, path: string, query?: Record<string, string>): Promise<T> {
  const url = new URL(`${API}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WHOOP ${path} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

async function collect<T>(token: string, path: string, pages = 3): Promise<T[]> {
  const records: T[] = [];
  let nextToken: string | undefined;
  for (let i = 0; i < pages; i += 1) {
    const page: Collection<T> = await whoopGet(token, path, {
      limit: "25",
      ...(nextToken ? { nextToken } : {}),
    });
    records.push(...(page.records ?? []));
    if (!page.next_token) break;
    nextToken = page.next_token;
  }
  return records;
}

export async function loadDashboard(): Promise<Dashboard> {
  const demo = buildDemoDashboard();
  demo.configured = whoopConfigured();
  const token = await getAccessToken();
  if (!token) {
    return demo;
  }

  try {
    const [profile, body, recoveries, cycles, sleeps, workouts] = await Promise.all([
      whoopGet<Profile>(token, "/v2/user/profile/basic"),
      whoopGet<BodyMeasurement>(token, "/v2/user/measurement/body"),
      collect<Recovery>(token, "/v2/recovery"),
      collect<Cycle>(token, "/v2/cycle"),
      collect<Sleep>(token, "/v2/activity/sleep"),
      collect<Workout>(token, "/v2/activity/workout"),
    ]);

    return {
      source: "whoop",
      connected: true,
      configured: true,
      profile,
      body,
      recoveries,
      cycles,
      sleeps,
      workouts,
    };
  } catch {
    return {
      ...demo,
      configured: whoopConfigured(),
      connected: false,
    };
  }
}

export async function loadWorkout(id: string): Promise<Workout | null> {
  const dashboard = await loadDashboard();
  const local = dashboard.workouts.find((w) => w.id === id);
  if (local) return local;

  const token = await getAccessToken();
  if (!token) return null;
  try {
    return await whoopGet<Workout>(token, `/v2/activity/workout/${id}`);
  } catch {
    return null;
  }
}

export async function loadSleep(id: string): Promise<Sleep | null> {
  const dashboard = await loadDashboard();
  const local = dashboard.sleeps.find((s) => s.id === id);
  if (local) return local;
  const token = await getAccessToken();
  if (!token) return null;
  try {
    return await whoopGet<Sleep>(token, `/v2/activity/sleep/${id}`);
  } catch {
    return null;
  }
}

export async function revokeWhoopAccess() {
  const token = await getAccessToken();
  if (!token) return;
  await fetch(`${API}/v2/user/access`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}
