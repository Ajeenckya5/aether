import { NextResponse } from "next/server";
import { isSameOriginRequest, NO_STORE } from "@/lib/privacy";
import { clearWhoopTokens } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await clearWhoopTokens();
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": NO_STORE } },
  );
}
