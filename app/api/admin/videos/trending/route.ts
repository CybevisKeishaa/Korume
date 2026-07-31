import { NextResponse } from "next/server";
import { listTrendingLessons } from "@/lib/data/admin-videos";

export async function GET() {
  const result = await listTrendingLessons();
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "Forbidden";
    return NextResponse.json({ error: message }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}
