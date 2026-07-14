import { NextResponse } from "next/server";
import { createShare } from "@/lib/data/peer-review";
import { createShareSchema } from "@/lib/validation/peer-review";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createShareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid share", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await createShare(parsed.data);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    if (result.status === 409) {
      return NextResponse.json({ error: "This session has already been shared" }, { status: 409 });
    }
    const message = result.status === 401 ? "Unauthorized" : result.status === 404 ? "Session not found" : "Session cannot be shared (no recording or no linked line)";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}
