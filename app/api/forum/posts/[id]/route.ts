import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteForumPost, getForumPost, updateForumPost } from "@/lib/data/forum";
import { updateForumPostSchema } from "@/lib/validation/forum";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const data = await getForumPost(params.id);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data });
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

  const parsed = updateForumPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await updateForumPost(params.id, parsed.data);
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

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await deleteForumPost(params.id);
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
