import { NextResponse } from "next/server";
import { getAdminStats } from "@/lib/data/admin-stats";

export async function GET() {
  const result = await getAdminStats();
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "Forbidden";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
