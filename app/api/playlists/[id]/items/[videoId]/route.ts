import { NextResponse } from "next/server";
import { z } from "zod";
import { removePlaylistItem } from "@/lib/data/playlists";

export async function DELETE(request: Request, { params }: { params: { id: string; videoId: string } }) {
  if (!z.string().uuid().safeParse(params.id).success || !z.string().uuid().safeParse(params.videoId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await removePlaylistItem(params.id, params.videoId);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message = result.status === 401 ? "Unauthorized" : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return new NextResponse(null, { status: 204 });
}
