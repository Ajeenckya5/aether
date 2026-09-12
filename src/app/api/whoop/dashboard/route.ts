import { NextResponse } from "next/server";
import { NO_STORE } from "@/lib/privacy";
import { loadDashboard } from "@/lib/whoop";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await loadDashboard();
  return NextResponse.json(data, {
    headers: { "Cache-Control": NO_STORE },
  });
}
