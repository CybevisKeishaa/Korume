import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import {
  AiError,
  conversationReply,
  isAiConfigured,
  sessionCorrections,
  type ConversationTurn,
  type JlptLevel,
  type ScenarioId,
} from "@/lib/ai";
import { aiErrorStatus } from "@/lib/http-status";
import { capHistory } from "@/lib/validation/conversation";

const SESSION_CREATE_LIMIT = { limit: 30, windowMs: 60_000 };
const MESSAGE_LIMIT = { limit: 20, windowMs: 60_000 };
const END_LIMIT = { limit: 5, windowMs: 60_000 };

const DEFAULT_LEVEL: JlptLevel = "N5";

export interface ConversationSessionRow {
  id: string;
  scenario_type: string | null;
  started_at: string;
  ended_at: string | null;
}

export type CreateConversationSessionResult =
  | { ok: true; data: ConversationSessionRow }
  | { ok: false; status: 401 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Start a scenario conversation session. `level` is validated by the route
 * but NOT persisted — `conversation_sessions` has no level column (Layer 4
 * migration's grants audit found no schema change needed). Callers resend
 * `level` on each `/api/conversation/message` call; it falls back to the
 * user's own profile level (`users.level`) when omitted — see
 * `resolveLevel`.
 */
export async function createConversationSession(
  scenario: ScenarioId,
): Promise<CreateConversationSessionResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`conversation:session:${user.id}`, SESSION_CREATE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data, error } = await supabase
    .from("conversation_sessions")
    .insert({ user_id: user.id, scenario_type: scenario })
    .select("id, scenario_type, started_at, ended_at")
    .single();
  if (error) throw error;

  return { ok: true, data: data as ConversationSessionRow };
}

export type ListConversationSessionsResult =
  | { ok: true; data: ConversationSessionRow[] }
  | { ok: false; status: 401 };

/** The current user's conversation sessions, most recently started first. */
export async function listConversationSessions(): Promise<ListConversationSessionsResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const { data, error } = await supabase
    .from("conversation_sessions")
    .select("id, scenario_type, started_at, ended_at")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false });
  if (error) throw error;

  return { ok: true, data: (data as ConversationSessionRow[]) ?? [] };
}

export interface ConversationMessageRow {
  id: string;
  role: "user" | "ai";
  content: string;
  pronunciation_score: number | null;
  created_at: string;
}

export type GetConversationMessagesResult =
  | { ok: true; data: ConversationMessageRow[] }
  | { ok: false; status: 401 | 404 };

/** Loads one owned session's full message history, oldest first. */
export async function getConversationMessages(
  sessionId: string,
): Promise<GetConversationMessagesResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const session = await loadOwnedSession(supabase, sessionId, user.id);
  if (!session) return { ok: false, status: 404 };

  const { data, error } = await supabase
    .from("conversation_messages")
    .select("id, role, content, pronunciation_score, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return { ok: true, data: (data as ConversationMessageRow[]) ?? [] };
}

async function loadOwnedSession(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  userId: string,
): Promise<{ id: string; scenario_type: string | null; ended_at: string | null } | null> {
  const { data, error } = await supabase
    .from("conversation_sessions")
    .select("id, scenario_type, ended_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; scenario_type: string | null; ended_at: string | null } | null;
}

/** Looks up the caller's own profile level (`users.level`), defaulting to N5
 * if the row is somehow missing. */
async function resolveLevel(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  explicit: JlptLevel | undefined,
): Promise<JlptLevel> {
  if (explicit) return explicit;
  const { data, error } = await supabase.from("users").select("level").eq("id", userId).maybeSingle();
  if (error) throw error;
  return ((data as { level: JlptLevel } | null)?.level ?? DEFAULT_LEVEL) as JlptLevel;
}

export interface PostConversationMessageInput {
  sessionId: string;
  message: string;
  level?: JlptLevel;
}

export type PostConversationMessageResult =
  | { ok: true; data: { reply: string; truncated: boolean; model: string } }
  | { ok: false; status: 401 | 400 | 404 }
  // Our own limiter (retryAfter always set) OR a mapped AiError status
  // (503/500/502/429 from Anthropic's own quota — retryAfter unset there).
  // Merged into one generic variant (rather than a separate literal-429
  // member) so `status === 429` narrows unambiguously in the route.
  | { ok: false; status: number; retryAfter?: number };

/**
 * One turn of scenario conversation: verifies session ownership + that it
 * hasn't ended, inserts the learner's message, calls Claude with the capped
 * prior history, then inserts the reply. If the AI call fails, the learner's
 * message is still kept (it's valid data on its own) but no reply is
 * inserted.
 */
export async function postConversationMessage(
  input: PostConversationMessageInput,
): Promise<PostConversationMessageResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`conversation:message:${user.id}`, MESSAGE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const session = await loadOwnedSession(supabase, input.sessionId, user.id);
  if (!session) return { ok: false, status: 404 };
  if (session.ended_at) return { ok: false, status: 400 };

  if (!isAiConfigured()) return { ok: false, status: 503 };

  const { data: priorRows, error: priorError } = await supabase
    .from("conversation_messages")
    .select("role, content")
    .eq("session_id", input.sessionId)
    .order("created_at", { ascending: true });
  if (priorError) throw priorError;

  const prior = ((priorRows as { role: "user" | "ai"; content: string }[]) ?? []).map(
    (row): ConversationTurn => ({ role: row.role, content: row.content }),
  );

  const { error: insertUserError } = await supabase
    .from("conversation_messages")
    .insert({ session_id: input.sessionId, role: "user", content: input.message });
  if (insertUserError) throw insertUserError;

  const turns = capHistory<ConversationTurn>([
    ...prior,
    { role: "user", content: input.message },
  ]);
  const level = await resolveLevel(supabase, user.id, input.level);
  const scenario = (session.scenario_type ?? "free-talk") as ScenarioId;

  let reply: { reply: string; truncated: boolean; model: string };
  try {
    reply = await conversationReply({ scenario, level, messages: turns });
  } catch (err) {
    if (err instanceof AiError) return { ok: false, status: aiErrorStatus(err.kind) };
    throw err;
  }

  const { error: insertAiError } = await supabase
    .from("conversation_messages")
    .insert({ session_id: input.sessionId, role: "ai", content: reply.reply });
  if (insertAiError) throw insertAiError;

  return { ok: true, data: reply };
}

export type EndConversationSessionResult =
  | {
      ok: true;
      data: { corrections: { original: string; corrected: string; explanation: string }[]; encouragement: string; model: string };
    }
  | { ok: false; status: 401 | 400 | 404 }
  // See PostConversationMessageResult for why this is one merged variant.
  | { ok: false; status: number; retryAfter?: number };

/**
 * Ends a session and returns Claude's corrections over the learner's own
 * utterances. `ended_at` is only set on success, so a failed AI call (e.g.
 * not configured) can be retried later without the session being stuck in a
 * half-ended state. Corrections are NOT persisted (task brief: keep it
 * simple) — this is a one-time read, not a stored artifact.
 */
export async function endConversationSession(
  sessionId: string,
): Promise<EndConversationSessionResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`conversation:end:${user.id}`, END_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const session = await loadOwnedSession(supabase, sessionId, user.id);
  if (!session) return { ok: false, status: 404 };
  if (session.ended_at) return { ok: false, status: 400 };

  if (!isAiConfigured()) return { ok: false, status: 503 };

  const { data: rows, error: messagesError } = await supabase
    .from("conversation_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (messagesError) throw messagesError;

  const turns = ((rows as { role: "user" | "ai"; content: string }[]) ?? []).map(
    (row): ConversationTurn => ({ role: row.role, content: row.content }),
  );

  let result: { corrections: { original: string; corrected: string; explanation: string }[]; encouragement: string; model: string };
  try {
    result = await sessionCorrections(turns);
  } catch (err) {
    if (err instanceof AiError) return { ok: false, status: aiErrorStatus(err.kind) };
    throw err;
  }

  const { error: updateError } = await supabase
    .from("conversation_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", user.id);
  if (updateError) throw updateError;

  return { ok: true, data: result };
}
