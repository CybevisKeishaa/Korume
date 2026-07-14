import { NextResponse } from "next/server";
import { z } from "zod";
import { rejectVideo } from "@/lib/data/admin-videos";
import { rejectVideoSchema } from "@/lib/validation/admin-video";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Body is optional (reject with no reason) — read as text first so an
  // empty body doesn't hit request.json()'s "Unexpected end of JSON input".
  const text = await request.text();
  let body: unknown = {};
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const parsed = rejectVideoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await rejectVideo(params.id, parsed.data.reason);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message = result.status === 401 ? "Unauthorized" : result.status === 403 ? "Forbidden" : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
