import { NextResponse } from "next/server";
import {
  setOauthState,
  whoopConfigured,
  whoopRedirectUri,
  WHOOP_SCOPES,
} from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!whoopConfigured()) {
    return NextResponse.redirect(new URL("/settings?error=config", request.url));
  }

  const state = crypto.randomUUID();
  await setOauthState(state);

  const url = new URL("https://api.prod.whoop.com/oauth/oauth2/auth");
  url.searchParams.set("client_id", process.env.WHOOP_CLIENT_ID!);
  url.searchParams.set("redirect_uri", whoopRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", WHOOP_SCOPES);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
