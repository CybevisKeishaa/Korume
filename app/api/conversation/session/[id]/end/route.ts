import { NextResponse } from "next/server";
import { z } from "zod";
import { endConversationSession } from "@/lib/data/conversation";

const FALLBACK_RETRY_AFTER_MS = 60_000;

const STATUS_MESSAGES: Record<number, string> = {
  401: "Unauthorized",
  400: "This conversation session has already ended",
  404: "Conversation session not found",
  500: "Conversation is misconfigured",
  502: "Could not generate corrections, please try again",
  503: "Conversation is not configured",
};

/**
 * POST /api/conversation/session/[id]/end — ends the session and returns
 * Claude's corrections over the learner's own utterances. Corrections are
 * NOT persisted. Rate-limited (5 req/min/user — same budget as summary/
 * examples, a comparably heavy structured-output call).
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await endConversationSession(params.id);
  if (!result.ok) {
    if (result.status === 429) {
      const retryAfterMs = result.retryAfter ?? FALLBACK_RETRY_AFTER_MS;
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
      );
    }
    const message = STATUS_MESSAGES[result.status] ?? "Could not end session";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
