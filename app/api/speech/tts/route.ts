import { NextResponse } from "next/server";
import { synthesizeSpeechForUser } from "@/lib/data/speech";
import { contentTypeForFormat, ttsRequestSchema } from "@/lib/validation/speech";

const STATUS_MESSAGES: Record<number, string> = {
  401: "Unauthorized",
  502: "Speech synthesis failed, please try again",
  503: "Speech synthesis is not configured",
};

/**
 * POST /api/speech/tts {text, voice?, format?} — synthesizes Japanese speech
 * via Azure Speech and returns the audio bytes directly (binary response,
 * not JSON). `format: "riff-16khz-16bit-mono-pcm"` returns 16kHz mono PCM
 * WAV for the client-side pitch pipeline; the default returns mp3.
 * Rate-limited (20 req/min/user).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ttsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await synthesizeSpeechForUser(parsed.data);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many speech requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message = STATUS_MESSAGES[result.status] ?? "Speech synthesis failed";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return new NextResponse(result.data, {
    status: 200,
    headers: { "Content-Type": contentTypeForFormat(parsed.data.format) },
  });
}
