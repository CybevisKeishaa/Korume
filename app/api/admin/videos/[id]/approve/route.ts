import { NextResponse } from "next/server";
import { z } from "zod";
import { promoteVideo } from "@/lib/data/admin-videos";
import { promoteVideoSchema } from "@/lib/validation/admin-video";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Body is optional (existing UI POSTs with no body) — read as text first so
  // an empty body doesn't hit request.json()'s "Unexpected end of JSON input".
  const text = await request.text();
  let body: unknown = {};
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const parsed = promoteVideoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = await promoteVideo(params.id, parsed.data.tier);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message =
      result.status === 401
        ? "Unauthorized"
        : result.status === 403
          ? "Forbidden"
          : result.status === 422
            ? "Lesson has no transcript yet"
            : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
