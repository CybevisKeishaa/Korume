import { NextResponse } from "next/server";
import { createForumPost, listForumPosts } from "@/lib/data/forum";
import { createForumPostSchema, listForumPostsQuerySchema } from "@/lib/validation/forum";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = listForumPostsQuerySchema.safeParse({
    topic: searchParams.get("topic") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const data = await listForumPosts(parsed.data);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createForumPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid post", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await createForumPost(parsed.data);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many posts, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}
