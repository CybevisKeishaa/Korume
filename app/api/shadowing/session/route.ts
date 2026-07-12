import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, listSessions } from "@/lib/data/shadowing";
import { shadowingSessionSchema } from "@/lib/validation/shadowing";

/**
 * POST /api/shadowing/session — multipart upload: `videoId`, `lineId`
 * (strings) + `audio` (file). Body is `multipart/form-data`, not JSON, so
 * shadowing_sessions rows always carry a private storage path, never a raw
 * blob (CLAUDE.md §2 — recordings are the user's own, encrypted at rest).
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const videoId = form.get("videoId");
  const lineId = form.get("lineId");
  const audio = form.get("audio");

  const parsed = shadowingSessionSchema.safeParse({
    videoId: typeof videoId === "string" ? videoId : undefined,
    lineId: typeof lineId === "string" ? lineId : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid fields", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // A missing/malformed file part is a structural request error, distinct
  // from a present-but-invalid file (bad mime/size), which createSession
  // reports as 422 after auth + rate-limit have been checked.
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }

  const result = await createSession({ videoId: parsed.data.videoId, lineId: parsed.data.lineId, audio });
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many recordings, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message =
      result.status === 401
        ? "Unauthorized"
        : result.status === 422
          ? "Invalid audio file"
          : "Could not save recording";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}

/** GET /api/shadowing/session?lineId=<uuid> — the current user's recent recordings for that line. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedLineId = z.string().uuid().safeParse(searchParams.get("lineId"));
  if (!parsedLineId.success) {
    return NextResponse.json({ error: "Invalid lineId" }, { status: 400 });
  }

  const result = await listSessions(parsedLineId.data);
  if (!result.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}
