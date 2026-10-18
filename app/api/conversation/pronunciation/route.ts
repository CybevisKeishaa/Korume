import { NextResponse } from "next/server";
import { scoreConversationPronunciation } from "@/lib/data/pronunciation";
import { conversationPronunciationSchema } from "@/lib/validation/pronunciation";
const PRIVATE = { "Cache-Control": "private, no-store" };

/** Ephemeral voice-message scoring, with no shadowing-session write path. */
export async function POST(request: Request) {
  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400, headers: PRIVATE }); }
  const entries = [...form.entries()];
  const duplicate = new Set(entries.map(([key]) => key)).size !== entries.length;
  const fields = Object.fromEntries(entries);
  const { audio, ...textFields } = fields;
  const parsed = conversationPronunciationSchema.safeParse(textFields);
  if (duplicate || !parsed.success || !(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Invalid fields or audio" }, { status: 400, headers: PRIVATE });
  }
  try {
    const result = await scoreConversationPronunciation({ audio, referenceText: parsed.data.referenceText });
    if (result.ok) return NextResponse.json({ data: result.data }, { headers: PRIVATE });
    const headers: Record<string, string> = { ...PRIVATE };
    if (result.status === 429 && result.retryAfter !== null) headers["Retry-After"] = String(Math.ceil(result.retryAfter / 1000));
    const error = result.status === 401 ? "Unauthorized"
      : result.status === 422 ? "Invalid or oversized audio file"
      : result.status === 429 ? "Too many pronunciation scoring requests, slow down"
      : result.status === 503 ? "Pronunciation scoring is not configured" : "Pronunciation scoring failed";
    return NextResponse.json({ error }, { status: result.status, headers });
  } catch {
    return NextResponse.json({ error: "Pronunciation scoring failed" }, { status: 500, headers: PRIVATE });
  }
}
