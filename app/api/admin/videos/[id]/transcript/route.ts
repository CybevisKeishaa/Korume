import { NextResponse } from "next/server";
import { z } from "zod";
import { replaceVideoTranscript } from "@/lib/data/admin-videos";
import { adminTranscriptSchema } from "@/lib/validation/admin-video";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminTranscriptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid transcript", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await replaceVideoTranscript(params.id, parsed.data);
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
          : result.status === 404
            ? "Video not found"
            : "Could not parse transcript";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
