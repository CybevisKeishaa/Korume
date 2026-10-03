import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { originRouteFor } from "@/lib/korume/route";

/** Copy the browser asserts on: the answer text and the two grounded entities. */
export const SEEDED_ANSWER = "Seeded answer: は marks the topic here.";
export const SEEDED_QUESTION = "Why は and not が?";
export const RETRY_QUESTION = "A question whose turn was released.";
export const ENT = { id: "ent:2028920", label: "は", seenCount: 3 } as const;
export const TOK = { id: "tok:勉強", label: "勉強", seenCount: 2 } as const;

export interface KorumeData {
  /** The completed thread, anchored to `lineIds[3]`. */
  threadId: string;
  /** A thread with one user message, no answer and a released reservation: retryable on load (spec §4.3). */
  retryThreadId: string;
  cleanup(): Promise<void>;
}

/**
 * Seeds two Ask Korume threads for one learner with the SERVICE ROLE — exactly what the turn pipeline persists
 * (spec §2.2): a user message, then an `ai` message whose `content_json` is a valid `AnswerV1` and whose
 * `grounding_json` holds one dictionary (`ent:`) and one token (`tok:`) entity with exposure. Nothing calls an AI.
 */
export async function seedKorumeData(admin: SupabaseClient, { userId, videoId, lineIds }: { userId: string; videoId: string; lineIds: string[] }): Promise<KorumeData> {
  const threadId = randomUUID();
  const retryThreadId = randomUUID();
  const lineId = lineIds[3]!;
  const sessions = await admin.from("conversation_sessions").insert([
    { id: threadId, user_id: userId, kind: "ask_korume", title: "Topic particle は", origin_video_id: videoId, origin_line_id: lineId, origin_route: originRouteFor(videoId, lineId) },
    { id: retryThreadId, user_id: userId, kind: "ask_korume", title: "A released turn" },
  ]);
  if (sessions.error) throw sessions.error;

  const turnId = randomUUID();
  const retryTurnId = randomUUID();
  const answer = {
    blocks: [
      { type: "paragraph", runs: [{ text: SEEDED_ANSWER }] },
      { type: "context_card", entityRef: ENT.id },
      { type: "followups", chips: ["Give another example"] },
    ],
  };
  const grounding = [
    { id: ENT.id, label: ENT.label, kind: "particle", jlpt: "N5", seenCount: ENT.seenCount, lessonLink: { videoId, lineId } },
    { id: TOK.id, label: TOK.label, kind: "vocabulary", seenCount: TOK.seenCount },
  ];
  const messages = await admin.from("conversation_messages").insert([
    { session_id: threadId, role: "user", content: SEEDED_QUESTION, turn_id: turnId, created_at: "2026-10-01T08:00:00.000Z" },
    { session_id: threadId, role: "ai", content: SEEDED_ANSWER, turn_id: turnId, content_json: answer, content_schema_version: 1, grounding_json: grounding, grounding_schema_version: 1, created_at: "2026-10-01T08:00:10.000Z" },
    { session_id: retryThreadId, role: "user", content: RETRY_QUESTION, turn_id: retryTurnId, created_at: "2026-10-01T08:01:00.000Z" },
  ]);
  if (messages.error) throw messages.error;

  // Fixed instants, never the clock (test/e2e-registration-emails.test.ts): a released, long-expired hold.
  const released = await admin.from("ai_reservations").insert({
    requested_by_user_id: userId, billing_scope: "learner", entitlement_kind: "korume_free_turn", turn_id: retryTurnId,
    fingerprint: `e2e-korume-${retryTurnId}`, reserved_usd: 0, status: "released", expires_at: "2026-10-01T08:04:00.000Z", closed_at: "2026-10-01T08:04:00.000Z",
    period_day: "2026-10-01", period_month: "2026-10-01",
  });
  if (released.error) throw released.error;

  return {
    threadId,
    retryThreadId,
    async cleanup() {
      await admin.from("ai_reservations").delete().eq("turn_id", retryTurnId);
      await admin.from("conversation_sessions").delete().in("id", [threadId, retryThreadId]);
    },
  };
}

/** Korume off for this learner (spec §2.3): the server gate reads `user_preferences.companion_enabled`. */
export async function setCompanionEnabled(admin: SupabaseClient, userId: string, enabled: boolean): Promise<void> {
  const result = await admin.from("user_preferences").upsert({ user_id: userId, companion_enabled: enabled }, { onConflict: "user_id" });
  if (result.error) throw result.error;
}
