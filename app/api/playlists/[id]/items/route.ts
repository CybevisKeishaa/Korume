import { NextResponse } from "next/server";
import { z } from "zod";
import { addPlaylistItem, reorderPlaylistItem } from "@/lib/data/playlists";
import { addPlaylistItemSchema, reorderPlaylistItemSchema } from "@/lib/validation/playlists";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = addPlaylistItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid item", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await addPlaylistItem(params.id, parsed.data);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    if (result.status === 409) {
      return NextResponse.json({ error: "Video already in playlist" }, { status: 409 });
    }
    const message = result.status === 401 ? "Unauthorized" : result.status === 404 ? "Playlist not found" : "Invalid video";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = reorderPlaylistItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reorder", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await reorderPlaylistItem(params.id, parsed.data);
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

  return NextResponse.json({ data: result.data });
}
