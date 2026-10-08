/**
 * TEST SUPPORT ONLY — imported by `*.test.ts` and nothing else.
 *
 * The KorumeStore contract in memory, over the Knowledge memory store, so the turn pipeline can be tested for
 * idempotency, concurrency and money without a database. Every rule mirrors the SQL it stands in for: RLS on
 * reads (a thread of someone else is null), the `(session, turn, role)` unique index on messages, and
 * `korume_complete_turn` (insert-or-return the answer, settle only on the first insert). The SQL itself is proven
 * by `verify:db:korume`.
 */
import { randomUUID } from "node:crypto";
import type { MemoryKnowledgeStore } from "@/lib/knowledge/memory-store";
import type { LearnerProfileContext } from "./prompts";
import type { AnchorLine, KorumeStore, MessageRow, ThreadRow } from "./store";

export interface MemoryKorumeStore extends KorumeStore {
  threads: ThreadRow[];
  messages: (MessageRow & { sessionId: string })[];
  lines: AnchorLine[];
  readable: Set<string>;
  /** The viewer's own profile row, as `readLearnerProfile` returns it. */
  profile: LearnerProfileContext | null;
  /** Every method call in order: the "no write before the gate" proofs read this. */
  calls: string[];
}

/** `viewer` stands in for `auth.uid()`: the reads below return only that learner's rows, as RLS does. */
export function createMemoryKorumeStore(knowledge: MemoryKnowledgeStore, viewer: string): MemoryKorumeStore {
  const threads: ThreadRow[] = [];
  const messages: (MessageRow & { sessionId: string })[] = [];
  const lines: AnchorLine[] = [];
  const readable = new Set<string>();
  const calls: string[] = [];
  const self = { profile: null as LearnerProfileContext | null };
  let tick = 0;
  const now = () => new Date(Date.UTC(2026, 9, 3, 0, 0, tick++)).toISOString();
  const mine = (sessionId: string) => threads.some((t) => t.id === sessionId && t.userId === viewer);

  return {
    threads, messages, lines, readable, calls,
    get profile() { return self.profile; },
    set profile(value) { self.profile = value; },

    async readLearnerProfile() {
      calls.push("readLearnerProfile");
      return self.profile;
    },

    async insertThread(row) {
      calls.push("insertThread");
      if (threads.some((t) => t.id === row.id)) return "conflict";
      threads.push({
        id: row.id, userId: row.userId, kind: "ask_korume", title: null, originVideoId: row.anchor?.videoId ?? null,
        originLineId: row.anchor?.lineId ?? null, originSpan: row.anchor?.span ?? null, originRoute: row.anchor?.route ?? null,
        updatedAt: now(),
      });
      return "created";
    },
    async readThreadRow(_s, id) {
      calls.push("readThreadRow");
      return threads.find((t) => t.id === id && t.userId === viewer) ?? null;
    },
    async listThreadRows(_s, limit) {
      calls.push("listThreadRows");
      return threads.filter((t) => t.userId === viewer && t.kind === "ask_korume").slice(0, limit);
    },
    async readMessages(_s, sessionId) {
      calls.push("readMessages");
      return mine(sessionId) ? messages.filter((m) => m.sessionId === sessionId).map(({ sessionId: _x, ...m }) => ({ ...m })) : [];
    },
    async readAnchorLines(_s, ids) {
      calls.push("readAnchorLines");
      return new Map(lines.filter((l) => ids.includes(l.lineId)).map((l) => [l.lineId, l]));
    },
    async reservationStates(turnIds) {
      calls.push("reservationStates");
      const states = new Map<string, "held" | "settled" | "released">();
      for (const r of [...knowledge.reservations].reverse()) {
        if (r.turnId && turnIds.includes(r.turnId) && !states.has(r.turnId)) states.set(r.turnId, r.status);
      }
      return states;
    },
    async insertUserMessage(sessionId, turnId, text) {
      calls.push("insertUserMessage");
      if (messages.some((m) => m.sessionId === sessionId && m.turnId === turnId && m.role === "user")) return "exists";
      messages.push({
        sessionId, id: randomUUID(), turnId, role: "user", content: text, contentJson: null, contentSchemaVersion: null,
        groundingJson: null, groundingSchemaVersion: null, createdAt: now(),
      });
      return "created";
    },
    async readableVideoIds(_s, ids) {
      calls.push("readableVideoIds");
      return new Set(ids.filter((id) => readable.has(id)));
    },
    async completeTurn(args) {
      calls.push("completeTurn");
      const existing = messages.find((m) => m.sessionId === args.sessionId && m.turnId === args.turnId && m.role === "ai");
      if (existing) return { messageId: existing.id, charged: false };
      const id = randomUUID();
      messages.push({
        sessionId: args.sessionId, id, turnId: args.turnId, role: "ai", content: args.content,
        contentJson: args.contentJson, contentSchemaVersion: 1, groundingJson: args.groundingJson, groundingSchemaVersion: 1,
        createdAt: now(),
      });
      const charged = await knowledge.store.settle(args.reservationId, args.generationId, args.credits, args.usd);
      const thread = threads.find((t) => t.id === args.sessionId && t.kind === "ask_korume");
      if (thread) { thread.updatedAt = now(); thread.title ??= args.title; }
      return { messageId: id, charged };
    },
  };
}
