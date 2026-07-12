import { NextResponse } from "next/server";
import { importVideo } from "@/lib/data/videos";
import { importVideoSchema } from "@/lib/validation/video";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = importVideoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid video URL", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await importVideo(parsed.data);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many imports, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message =
      result.status === 401
        ? "Unauthorized"
        : result.status === 422
          ? "Could not fetch video metadata"
          : "Invalid video";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}
