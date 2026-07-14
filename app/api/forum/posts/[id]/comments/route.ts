import { NextResponse } from "next/server";
import { z } from "zod";
import { createForumComment } from "@/lib/data/forum";
import { createForumCommentSchema } from "@/lib/validation/forum";

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

  const parsed = createForumCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid comment", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await createForumComment(params.id, parsed.data);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many comments, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message = result.status === 401 ? "Unauthorized" : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}
