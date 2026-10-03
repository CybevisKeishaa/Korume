import "server-only";
import { rateLimit } from "@/lib/rate-limit";
import { containsPattern } from "@/lib/data/query-pagination";
import type { createClient } from "@/lib/supabase/server";
import { getLineForLearner } from "@/lib/data/knowledge";
import { korumeGate } from "@/lib/korume/gate";
import { originRouteFor } from "@/lib/korume/route";
import { toMessageView } from "@/lib/korume/messages";
import { runTurn, type TurnDeps, type TurnOutcome } from "@/lib/korume/turn";
import { sqlKorumeStore, type AnchorLine, type KorumeStore, type ReservationState, type ThreadRow } from "@/lib/korume/store";
import type { KorumeMessageView, KorumeThreadDetail, KorumeThreadView, PendingTurn } from "@/lib/korume/types";
import type { CreateThreadBody, PostTurnBody } from "@/lib/validation/korume";

const THREAD_CREATE_LIMIT = { limit: 20, windowMs: 60_000 };
const THREAD_READ_LIMIT = { limit: 120, windowMs: 60_000 };
const TURN_LIMIT = { limit: 20, windowMs: 60_000 };
export const THREAD_PAGE_SIZE = 20;

export interface SmallMemoryResult { title: string | null; lineTextJp: string | null; occurredAt: string }

/** The newest private journal memory that literally mentions an entity in this thread. */
export async function smallMemoryFor(userId: string, entities: { label: string }[], supabase: ReturnType<typeof createClient>): Promise<SmallMemoryResult | null> {
  const labels = [...new Set(entities.map((entity) => entity.label.trim()).filter(Boolean))].slice(0, 4);
  if (!labels.length) return null;
  try {
    const rows = await Promise.all(labels.map(async (label) => {
      const { data, error } = await supabase.from("companion_memories").select("title,line_text_jp,occurred_at")
        .eq("user_id", userId).ilike("line_text_jp", containsPattern(label)).order("occurred_at", { ascending: false }).limit(1);
      if (error) return null;
      const row = data?.[0];
      return row ? { title: row.title, lineTextJp: row.line_text_jp, occurredAt: row.occurred_at } : null;
    }));
    return rows.filter((row): row is SmallMemoryResult => row !== null).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0] ?? null;
  } catch {
    return null;
  }
}

type GateRefusal = { kind: "unauthorized" } | { kind: "disabled" } | { kind: "unavailable" };
type RateLimited = { kind: "rate_limited"; retryAfter: number };

export type CreateThreadResult =
  | GateRefusal | RateLimited
  | { kind: "not_found" } | { kind: "invalid" } | { kind: "conflict" }
  | { kind: "ok"; created: boolean; thread: KorumeThreadView };

export type ListThreadsResult = GateRefusal | RateLimited | { kind: "invalid" }
  | { kind: "ok"; threads: KorumeThreadView[]; nextCursor: string | null };

export type GetThreadResult = GateRefusal | RateLimited | { kind: "not_found" } | { kind: "ok"; detail: KorumeThreadDetail };

interface Deps { store?: KorumeStore }

/**
 * Spec §4.3: one entry per user turn that has no answer. A `held` reservation means the pipeline is still
 * running; anything else (released, reclaimed after expiry, or no reservation at all) is safe to retry.
 */
export function pendingTurnsFor(
  userTurnIds: string[], answered: Set<string>, states: Map<string, ReservationState>,
): PendingTurn[] {
  return userTurnIds.filter((id) => !answered.has(id))
    .map((turnId) => ({ turnId, status: states.get(turnId) === "held" ? "running" : "retryable" }));
}

const sameSpan = (a: ThreadRow["originSpan"], b: CreateThreadBody["span"]) =>
  (a === null && b === undefined) || (a !== null && b !== undefined && a.start === b.start && a.end === b.end);

const sameAnchor = (row: ThreadRow, body: CreateThreadBody) =>
  row.originVideoId === (body.videoId ?? null) && row.originLineId === (body.lineId ?? null) && sameSpan(row.originSpan, body.span);

function threadView(row: ThreadRow, lines: Map<string, AnchorLine>): KorumeThreadView {
  const line = row.originLineId ? lines.get(row.originLineId) : undefined;
  return {
    id: row.id,
    title: row.title,
    // A source the learner can no longer read (deleted, or made private) shows no chip rather than a stale one.
    anchor: line && line.videoId === row.originVideoId ? {
      videoId: line.videoId, videoTitle: line.videoTitle, lineId: line.lineId, lineText: line.lineText,
      translation: line.translation, startTime: line.startTime, span: row.originSpan,
    } : null,
    originRoute: line ? row.originRoute : null,
    updatedAt: row.updatedAt,
  };
}

/** POST /api/korume/threads — idempotent by the client's draft id (spec §4.1), anchor proven on the server (§4.2). */
export async function createThread(body: CreateThreadBody, deps: Deps = {}): Promise<CreateThreadResult> {
  const store = deps.store ?? sqlKorumeStore;
  const gate = await korumeGate();
  if (gate.kind !== "ok") return gate;
  const limit = rateLimit(`korume:thread:${gate.userId}`, THREAD_CREATE_LIMIT);
  if (!limit.ok) return { kind: "rate_limited", retryAfter: limit.retryAfter };

  let anchor: { videoId: string; lineId: string; span: { start: number; end: number } | null; route: string } | null = null;
  if (body.lineId && body.videoId) {
    const line = await getLineForLearner(gate.supabase, body.lineId);
    if (!line || line.videoId !== body.videoId) return { kind: "not_found" };
    // UTF-16 code units, the convention of `Utf16Span` — exactly what JS string length counts.
    if (body.span && body.span.end > line.textJp.length) return { kind: "invalid" };
    anchor = { videoId: line.videoId, lineId: line.id, span: body.span ?? null, route: originRouteFor(line.videoId, line.id) };
  }

  const inserted = await store.insertThread({ id: body.threadId, userId: gate.userId, anchor });
  const row = await store.readThreadRow(gate.supabase, body.threadId);
  // Someone else's id, or a scenario session: the same generic 404 as a missing row (spec §4.1).
  if (!row || row.kind !== "ask_korume") return { kind: "not_found" };
  if (inserted === "conflict" && !sameAnchor(row, body)) return { kind: "conflict" };
  const lines = row.originLineId ? await store.readAnchorLines(gate.supabase, [row.originLineId]) : new Map();
  return { kind: "ok", created: inserted === "created", thread: threadView(row, lines) };
}

interface Cursor { updatedAt: string; id: string }

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify([c.updatedAt, c.id]), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!Array.isArray(value) || value.length !== 2) return null;
    const [updatedAt, id] = value;
    if (typeof updatedAt !== "string" || Number.isNaN(Date.parse(updatedAt))) return null;
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
}

/** GET /api/korume/threads?cursor= — the learner's threads, newest activity first. */
export async function listThreads(cursor: string | null, deps: Deps = {}): Promise<ListThreadsResult> {
  const store = deps.store ?? sqlKorumeStore;
  const gate = await korumeGate();
  if (gate.kind !== "ok") return gate;
  const limit = rateLimit(`korume:read:${gate.userId}`, THREAD_READ_LIMIT);
  if (!limit.ok) return { kind: "rate_limited", retryAfter: limit.retryAfter };
  const before = cursor === null ? null : decodeCursor(cursor);
  if (cursor !== null && !before) return { kind: "invalid" };

  const rows = await store.listThreadRows(gate.supabase, THREAD_PAGE_SIZE + 1, before);
  const page = rows.slice(0, THREAD_PAGE_SIZE);
  const lineIds = page.flatMap((r) => (r.originLineId ? [r.originLineId] : []));
  const lines = lineIds.length ? await store.readAnchorLines(gate.supabase, lineIds) : new Map<string, AnchorLine>();
  const last = page.at(-1);
  return {
    kind: "ok",
    threads: page.map((r) => threadView(r, lines)),
    nextCursor: rows.length > THREAD_PAGE_SIZE && last ? encodeCursor({ updatedAt: last.updatedAt, id: last.id }) : null,
  };
}

/** GET /api/korume/threads/[id] — the thread, its messages and the pending-turn projection (spec §4.3). */
export async function getThread(id: string, deps: Deps = {}): Promise<GetThreadResult> {
  const store = deps.store ?? sqlKorumeStore;
  const gate = await korumeGate();
  if (gate.kind !== "ok") return gate;
  const limit = rateLimit(`korume:read:${gate.userId}`, THREAD_READ_LIMIT);
  if (!limit.ok) return { kind: "rate_limited", retryAfter: limit.retryAfter };

  const row = await store.readThreadRow(gate.supabase, id);
  if (!row || row.kind !== "ask_korume") return { kind: "not_found" };
  const [rows, lines] = await Promise.all([
    store.readMessages(gate.supabase, id),
    row.originLineId ? store.readAnchorLines(gate.supabase, [row.originLineId]) : Promise.resolve(new Map<string, AnchorLine>()),
  ]);

  const messages: KorumeMessageView[] = rows.map(toMessageView);

  const answered = new Set(rows.filter((m) => m.role === "ai" && m.turnId).map((m) => m.turnId as string));
  const userTurns = [...new Set(rows.filter((m) => m.role === "user" && m.turnId).map((m) => m.turnId as string))];
  const open = userTurns.filter((t) => !answered.has(t));
  const states = open.length ? await store.reservationStates(open) : new Map<string, ReservationState>();
  return { kind: "ok", detail: { thread: threadView(row, lines), messages, pendingTurns: pendingTurnsFor(userTurns, answered, states) } };
}

export type PostTurnResult = GateRefusal | RateLimited | TurnOutcome | { status: "not_found" };

/**
 * POST /api/korume/threads/[id]/turns — gate first (a disabled learner spends nothing and learns nothing), then
 * the per-learner request rate, then the turn pipeline (spec §4.4, §5).
 */
export async function postTurn(threadId: string, body: PostTurnBody, deps: TurnDeps = {}): Promise<PostTurnResult> {
  const gate = await korumeGate();
  if (gate.kind !== "ok") return gate;
  const limit = rateLimit(`korume:turn:${gate.userId}`, TURN_LIMIT);
  if (!limit.ok) return { kind: "rate_limited", retryAfter: limit.retryAfter };
  return runTurn({ supabase: gate.supabase, userId: gate.userId, threadId, turnId: body.turnId, text: body.text, locale: body.locale }, deps);
}
