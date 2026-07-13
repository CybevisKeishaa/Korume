import { NextResponse } from "next/server";
import { createConversationSession, listConversationSessions } from "@/lib/data/conversation";
import { createConversationSessionSchema } from "@/lib/validation/conversation";

/** GET /api/conversation/session — the current user's sessions, most recently started first. */
export async function GET() {
  const result = await listConversationSessions();
  if (!result.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}

/**
 * POST /api/conversation/session {scenario, level?} — starts a scenario
 * conversation session. `level` is validated but not persisted (no column on
 * `conversation_sessions`); resend it on `/api/conversation/message` calls,
 * or it falls back to the user's own profile level.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createConversationSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid session", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await createConversationSession(parsed.data.scenario);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many sessions created, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
  }

  return NextResponse.json({ data: result.data }, { status: 201 });
}
