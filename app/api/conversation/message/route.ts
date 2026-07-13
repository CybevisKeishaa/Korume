import { NextResponse } from "next/server";
import { postConversationMessage } from "@/lib/data/conversation";
import { postConversationMessageSchema } from "@/lib/validation/conversation";

/** Default backoff hint when the failure is Anthropic's own rate limit
 * (no locally-computed retryAfter is available for that case). */
const FALLBACK_RETRY_AFTER_MS = 60_000;

const STATUS_MESSAGES: Record<number, string> = {
  401: "Unauthorized",
  400: "This conversation session has already ended",
  404: "Conversation session not found",
  500: "Conversation is misconfigured",
  502: "Conversation reply failed, please try again",
  503: "Conversation is not configured",
};

/**
 * POST /api/conversation/message {sessionId, message, level?} — one turn of
 * scenario conversation. `level` is optional; falls back to the user's
 * profile level when omitted (conversation_sessions has no level column).
 * Rate-limited (20 req/min/user, CLAUDE.md §6).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postConversationMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid message", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await postConversationMessage(parsed.data);
  if (!result.ok) {
    if (result.status === 429) {
      const retryAfterMs = result.retryAfter ?? FALLBACK_RETRY_AFTER_MS;
      return NextResponse.json(
        { error: "Too many messages, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
      );
    }
    const message = STATUS_MESSAGES[result.status] ?? "Could not send message";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
