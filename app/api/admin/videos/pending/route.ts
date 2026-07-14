import { NextResponse } from "next/server";
import { listPendingVideos } from "@/lib/data/admin-videos";
import { pendingVideosQuerySchema } from "@/lib/validation/admin-video";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = pendingVideosQuerySchema.safeParse({ cursor: searchParams.get("cursor") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  const result = await listPendingVideos(parsed.data.cursor);
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "Forbidden";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
