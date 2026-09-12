import { NextResponse } from "next/server";
import { loadDashboard } from "@/lib/whoop";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await loadDashboard();
  return NextResponse.json(data);
}
