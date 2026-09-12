import { NextResponse } from "next/server";
import { buildDemoDashboard } from "@/lib/mock";
import { NO_STORE } from "@/lib/privacy";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = buildDemoDashboard();
  data.configured = false;
  data.connected = false;
  data.source = "demo";
  return NextResponse.json(data, {
    headers: { "Cache-Control": NO_STORE },
  });
}
