import { NextResponse } from "next/server";
import { submitListeningAttempt } from "@/lib/data/dictation";
import { dictationAttemptSchema } from "@/lib/validation/dictation";

// Every response carries learner data or the line's answer.
const PRIVATE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: PRIVATE });
  }

  const parsed = dictationAttemptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid attempt" }, { status: 400, headers: PRIVATE });
  }

  try {
    const result = await submitListeningAttempt(parsed.data);
    if (result.ok) return NextResponse.json({ data: result.data }, { headers: PRIVATE });
    switch (result.status) {
      case 401: return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE });
      case 400: return NextResponse.json({ error: "Invalid attempt" }, { status: 400, headers: PRIVATE });
      case 409: return NextResponse.json({ error: result.error }, { status: 409, headers: PRIVATE });
      case 429: return NextResponse.json(
        { error: "Too many attempts, slow down" },
        { status: 429, headers: { ...PRIVATE, "Retry-After": String(Math.max(1, Math.ceil(result.retryAfter / 1000))) } },
      );
    }
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
    console.error("[api/dictation/attempt] request failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500, headers: PRIVATE });
  }
}
