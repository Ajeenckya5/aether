import { cookies } from "next/headers";

const ACCESS = "whoop_access";
const REFRESH = "whoop_refresh";
const EXPIRES = "whoop_expires";
const STATE = "whoop_oauth_state";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

export async function saveWhoopTokens(input: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}) {
  const store = await cookies();
  const expiresAt = Date.now() + input.expires_in * 1000;
  store.set(ACCESS, input.access_token, {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 30,
  });
  if (input.refresh_token) {
    store.set(REFRESH, input.refresh_token, {
      ...cookieBase,
      maxAge: 60 * 60 * 24 * 45,
    });
  }
  store.set(EXPIRES, String(expiresAt), {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearWhoopTokens() {
  const store = await cookies();
  store.delete(ACCESS);
  store.delete(REFRESH);
  store.delete(EXPIRES);
  store.delete(STATE);
}

export async function setOauthState(state: string) {
  const store = await cookies();
  store.set(STATE, state, { ...cookieBase, maxAge: 600 });
}

export async function readOauthState(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(STATE)?.value;
}

export async function readWhoopSession(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number;
}> {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS)?.value ?? null,
    refreshToken: store.get(REFRESH)?.value ?? null,
    expiresAt: Number(store.get(EXPIRES)?.value ?? 0),
  };
}

export function whoopConfigured(): boolean {
  return Boolean(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET);
}

export function whoopRedirectUri(): string {
  return (
    process.env.WHOOP_REDIRECT_URI ??
    "http://localhost:3000/api/auth/callback"
  );
}

export const WHOOP_SCOPES = [
  "read:recovery",
  "read:cycles",
  "read:sleep",
  "read:workout",
  "read:profile",
  "read:body_measurement",
  "offline",
].join(" ");
