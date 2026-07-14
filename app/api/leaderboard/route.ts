import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/data/leaderboard";

export async function GET() {
  const result = await getLeaderboard();
  if (!result.ok) return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
