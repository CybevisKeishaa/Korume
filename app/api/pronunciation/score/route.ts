import { NextResponse } from "next/server";
import { scoreSession } from "@/lib/data/pronunciation";
import { scoreSessionSchema } from "@/lib/validation/pronunciation";
const PRIVATE = { "Cache-Control": "private, no-store" };

/** Score an already saved take; client-supplied text or audio is rejected. */
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: PRIVATE }); }
  const parsed = scoreSessionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid fields" }, { status: 400, headers: PRIVATE });
  try {
    const result = await scoreSession(parsed.data.sessionId);
    if (result.ok) return NextResponse.json({ data: result.data }, { headers: PRIVATE });
    const headers: Record<string, string> = { ...PRIVATE };
    if (result.status === 429 && result.retryAfter !== null) headers["Retry-After"] = String(Math.ceil(result.retryAfter / 1000));
    if (result.status === 409) return NextResponse.json({ error: "Recording cannot be scored", reason: result.reason }, { status: 409, headers });
    const error = result.status === 401 ? "Unauthorized"
      : result.status === 422 ? "Invalid or oversized audio file"
      : result.status === 429 ? "Too many pronunciation scoring requests, slow down"
      : result.status === 503 ? "Pronunciation scoring is not configured" : "Pronunciation scoring failed";
    return NextResponse.json({ error }, { status: result.status, headers });
  } catch {
    return NextResponse.json({ error: "Pronunciation scoring failed" }, { status: 500, headers: PRIVATE });
  }
}
