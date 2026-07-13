import { NextResponse } from "next/server";
import { scorePronunciation } from "@/lib/data/pronunciation";
import { pronunciationScoreFieldsSchema } from "@/lib/validation/pronunciation";

/**
 * POST /api/pronunciation/score — multipart upload: `referenceText`,
 * optional `shadowingSessionId` (strings) + `audio` (file, WAV/PCM). The
 * most quota-sensitive Layer 4 endpoint — 10 req/min/user (CLAUDE.md §6).
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const referenceText = form.get("referenceText");
  const shadowingSessionId = form.get("shadowingSessionId");
  const audio = form.get("audio");

  const parsed = pronunciationScoreFieldsSchema.safeParse({
    referenceText: typeof referenceText === "string" ? referenceText : undefined,
    shadowingSessionId: typeof shadowingSessionId === "string" ? shadowingSessionId : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid fields", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }

  const result = await scorePronunciation({
    audio,
    referenceText: parsed.data.referenceText,
    shadowingSessionId: parsed.data.shadowingSessionId,
  });

  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many pronunciation scoring requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message =
      result.status === 401
        ? "Unauthorized"
        : result.status === 404
          ? "Shadowing session not found"
          : result.status === 422
            ? "Invalid or oversized audio file"
            : result.status === 503
              ? "Pronunciation scoring is not configured"
              : "Pronunciation scoring failed";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
