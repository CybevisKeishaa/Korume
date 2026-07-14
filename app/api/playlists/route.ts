import { NextResponse } from "next/server";
import { createPlaylist, listPlaylists } from "@/lib/data/playlists";
import { createPlaylistSchema } from "@/lib/validation/playlists";

export async function GET() {
  const result = await listPlaylists();
  if (!result.ok) return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  return NextResponse.json({ data: result.data });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createPlaylistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid playlist", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await createPlaylist(parsed.data);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many playlists, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}
