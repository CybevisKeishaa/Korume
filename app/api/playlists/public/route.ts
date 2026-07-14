import { NextResponse } from "next/server";
import { listPublicPlaylists } from "@/lib/data/playlists";
import { listPublicPlaylistsQuerySchema } from "@/lib/validation/playlists";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = listPublicPlaylistsQuerySchema.safeParse({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const data = await listPublicPlaylists(parsed.data);
  return NextResponse.json({ data });
}
