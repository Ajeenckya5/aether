import { NextResponse } from "next/server";
import { clearWhoopTokens } from "@/lib/session";
import { revokeWhoopAccess } from "@/lib/whoop";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await revokeWhoopAccess();
  } catch {
    // Still clear local cookies if WHOOP revoke fails.
  }
  await clearWhoopTokens();
  return NextResponse.json({ ok: true });
}
