import { NextResponse } from "next/server";
import { getUserStats } from "@/lib/data/user-stats";

export async function GET() {
  const result = await getUserStats();
  if (!result.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}
