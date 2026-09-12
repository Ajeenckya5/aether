import { NextResponse } from "next/server";
import {
  readOauthState,
  saveWhoopTokens,
  whoopRedirectUri,
} from "@/lib/session";
import { exchangeCode } from "@/lib/whoop";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const expected = await readOauthState();

  if (error || !code || !state || !expected || state !== expected) {
    return NextResponse.redirect(new URL("/settings?error=oauth", request.url));
  }

  try {
    const tokens = await exchangeCode(code, whoopRedirectUri());
    await saveWhoopTokens(tokens);
    return NextResponse.redirect(new URL("/", request.url));
  } catch {
    return NextResponse.redirect(new URL("/settings?error=token", request.url));
  }
}
