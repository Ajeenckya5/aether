import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Leftover OAuth callbacks are ignored. Aether does not store WHOOP tokens. */
export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/settings#bluetooth", request.url));
}
