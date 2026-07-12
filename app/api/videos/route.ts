import { NextResponse } from "next/server";
import { listVideos } from "@/lib/data/videos";

export async function GET() {
  const result = await listVideos();
  if (!result.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}
