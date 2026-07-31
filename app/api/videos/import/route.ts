import { NextResponse } from "next/server";
import { createLesson } from "@/lib/data/lesson-creation";
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

  const result = await createLesson({ youtubeUrl: parsed.data.youtubeUrl });
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many imports, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    if (result.status === 403) {
      return NextResponse.json({ error: "Monthly lesson quota reached" }, { status: 403 });
    }
    const message =
      result.status === 401
        ? "Unauthorized"
        : result.status === 422
          ? "Could not fetch video metadata"
          : "Invalid video";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json(
    { data: result.data, alreadyInLibrary: result.alreadyInLibrary, transcriptStatus: result.transcriptStatus },
    { status: 201 },
  );
}
