import { NextResponse } from "next/server";
import { transcribeSpeechForUser } from "@/lib/data/speech";

const STATUS_MESSAGES: Record<number, string> = {
  401: "Unauthorized",
  422: "Invalid or oversized audio file",
  502: "Speech recognition failed, please try again",
  503: "Speech recognition is not configured",
};

/**
 * POST /api/speech/stt — multipart upload: `audio` (file, WAV/PCM, capped at
 * 2MB). Returns `{text, confidence}` — AI-generated, label "may be wrong" at
 * the UI. Rate-limited (10 req/min/user).
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }

  const result = await transcribeSpeechForUser(audio);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many speech requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message = STATUS_MESSAGES[result.status] ?? "Speech recognition failed";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
