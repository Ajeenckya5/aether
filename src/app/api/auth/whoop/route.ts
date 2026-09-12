import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Aether does not start WHOOP cloud OAuth. Connection is Bluetooth only. */
export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/settings#bluetooth", request.url));
}
