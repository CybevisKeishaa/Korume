import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertPlainSerializableDto } from "@/test/dto";
import { korumeGate } from "@/lib/korume/gate";
import { getLineForLearner } from "@/lib/data/knowledge";
import type { AnchorLine, KorumeStore, MessageRow, NewThread, ReservationState, ThreadRow } from "@/lib/korume/store";
import { rateLimit } from "@/lib/rate-limit";
import { runTurn } from "@/lib/korume/turn";
import { createThread, decodeCursor, encodeCursor, getThread, listThreads, pendingTurnsFor, postTurn, THREAD_PAGE_SIZE } from "./korume";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/korume/gate", () => ({ korumeGate: vi.fn() }));
vi.mock("@/lib/data/knowledge", () => ({ getLineForLearner: vi.fn() }));
vi.mock("@/lib/korume/store", () => ({ sqlKorumeStore: {} }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ ok: true })) }));
vi.mock("@/lib/korume/turn", () => ({ runTurn: vi.fn(async () => ({ status: "pending" })) }));

const ME = "a0000000-0000-4000-8000-000000000001";
const THREAD = "b0000000-0000-4000-8000-000000000001";
const VIDEO = "c0000000-0000-4000-8000-000000000001";
const OTHER_VIDEO = "c0000000-0000-4000-8000-000000000002";
const LINE = "d0000000-0000-4000-8000-000000000001";
const LINE_TEXT = "今日は𠮷野家"; // 𠮷 is two UTF-16 units: length 7
const client = { marker: "learner" };

const line: AnchorLine = { lineId: LINE, lineText: LINE_TEXT, translation: "Today", startTime: 12.5, videoId: VIDEO, videoTitle: "Ep" };

function fakeStore(rows: ThreadRow[] = [], messages: MessageRow[] = [], states = new Map<string, ReservationState>()) {
  const calls: string[] = [];
  const inserted: NewThread[] = [];
  const store: KorumeStore = {
    async insertThread(row) {
      calls.push("insertThread");
      if (rows.some((r) => r.id === row.id)) return "conflict";
      inserted.push(row);
      rows.push({
        id: row.id, userId: row.userId, kind: "ask_korume", title: null, originVideoId: row.anchor?.videoId ?? null,
        originLineId: row.anchor?.lineId ?? null, originSpan: row.anchor?.span ?? null, originRoute: row.anchor?.route ?? null,
        updatedAt: "2026-10-03T00:00:00.000Z",
      });
      return "created";
    },
    async readThreadRow(_s, id) {
      calls.push("readThreadRow");
      return rows.find((r) => r.id === id && r.userId === ME) ?? null; // RLS
    },
    async listThreadRows(_s, limit) { calls.push("listThreadRows"); return rows.filter((r) => r.userId === ME).slice(0, limit); },
    async readMessages() { calls.push("readMessages"); return messages; },
    async readLearnerProfile() { calls.push("readLearnerProfile"); return null; },
    async readAnchorLines(_s, ids) { calls.push("readAnchorLines"); return new Map(ids.includes(LINE) ? [[LINE, line]] : []); },
    async reservationStates() { calls.push("reservationStates"); return states; },
    async insertUserMessage() { calls.push("insertUserMessage"); return "created"; },
    async readableVideoIds() { calls.push("readableVideoIds"); return new Set(); },
    async completeTurn() { calls.push("completeTurn"); return { messageId: "m", charged: true }; },
  };
  return { store, calls, inserted, rows };
}

const thread = (over: Partial<ThreadRow> = {}): ThreadRow => ({
  id: THREAD, userId: ME, kind: "ask_korume", title: null, originVideoId: VIDEO, originLineId: LINE,
  originSpan: null, originRoute: `/shadowing/${VIDEO}?line=${LINE}`, updatedAt: "2026-10-03T00:00:00.000Z", ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(korumeGate).mockResolvedValue({ kind: "ok", supabase: client as never, userId: ME });
  vi.mocked(getLineForLearner).mockResolvedValue({ id: LINE, textJp: LINE_TEXT, videoId: VIDEO, videoTitle: "Ep" });
});

describe("pendingTurnsFor", () => {
  it("projects held → running, anything else → retryable, answered → absent (spec §4.3)", () => {
    expect(pendingTurnsFor(["a", "b", "c"], new Set(["c"]), new Map([["a", "held"], ["b", "released"]])))
      .toEqual([{ turnId: "a", status: "running" }, { turnId: "b", status: "retryable" }]);
    expect(pendingTurnsFor(["d"], new Set(), new Map())).toEqual([{ turnId: "d", status: "retryable" }]);
    expect(pendingTurnsFor(["e"], new Set(), new Map([["e", "settled"]]))).toEqual([{ turnId: "e", status: "retryable" }]);
  });
});

describe("createThread", () => {
  it("creates an anchored thread with a server-built route and the client's id", async () => {
    const { store, inserted } = fakeStore();
    const result = await createThread({ threadId: THREAD, videoId: VIDEO, lineId: LINE, span: { start: 0, end: 7 } }, { store });
    expect(result).toMatchObject({ kind: "ok", created: true, thread: { id: THREAD, originRoute: `/shadowing/${VIDEO}?line=${LINE}` } });
    expect(inserted[0]).toEqual({ id: THREAD, userId: ME, anchor: { videoId: VIDEO, lineId: LINE, span: { start: 0, end: 7 }, route: `/shadowing/${VIDEO}?line=${LINE}` } });
    if (result.kind === "ok") assertPlainSerializableDto(result.thread);
  });

  it("creates a free thread with no anchor and no line read", async () => {
    const { store, inserted } = fakeStore();
    await expect(createThread({ threadId: THREAD }, { store })).resolves.toMatchObject({ kind: "ok", created: true, thread: { anchor: null, originRoute: null } });
    expect(inserted[0]?.anchor).toBeNull();
    expect(getLineForLearner).not.toHaveBeenCalled();
  });

  it("refuses an unreadable line and a line of another video as not_found, creating nothing", async () => {
    const { store, calls } = fakeStore();
    vi.mocked(getLineForLearner).mockResolvedValueOnce(null);
    await expect(createThread({ threadId: THREAD, videoId: VIDEO, lineId: LINE }, { store })).resolves.toEqual({ kind: "not_found" });
    await expect(createThread({ threadId: THREAD, videoId: OTHER_VIDEO, lineId: LINE }, { store })).resolves.toEqual({ kind: "not_found" });
    expect(calls).not.toContain("insertThread");
  });

  it("checks the span against the line in UTF-16 units", async () => {
    const { store, calls } = fakeStore();
    await expect(createThread({ threadId: THREAD, videoId: VIDEO, lineId: LINE, span: { start: 0, end: 8 } }, { store })).resolves.toEqual({ kind: "invalid" });
    expect(calls).not.toContain("insertThread");
  });

  it("replays the same id and anchor as 200 and a different anchor as conflict", async () => {
    const { store } = fakeStore([thread()]);
    await expect(createThread({ threadId: THREAD, videoId: VIDEO, lineId: LINE }, { store })).resolves.toMatchObject({ kind: "ok", created: false });
    await expect(createThread({ threadId: THREAD, videoId: VIDEO, lineId: LINE, span: { start: 0, end: 2 } }, { store })).resolves.toEqual({ kind: "conflict" });
    await expect(createThread({ threadId: THREAD }, { store })).resolves.toEqual({ kind: "conflict" });
  });

  it("answers not_found for another learner's id and for a scenario session", async () => {
    const theirs = fakeStore([thread({ userId: "e0000000-0000-4000-8000-000000000009" })]);
    await expect(createThread({ threadId: THREAD }, { store: theirs.store })).resolves.toEqual({ kind: "not_found" });
    const scenario = fakeStore([thread({ kind: "scenario", originVideoId: null, originLineId: null, originRoute: null })]);
    await expect(createThread({ threadId: THREAD }, { store: scenario.store })).resolves.toEqual({ kind: "not_found" });
  });

  it.each(["unauthorized", "disabled", "unavailable"] as const)("stops at the gate (%s) before any store call", async (kind) => {
    vi.mocked(korumeGate).mockResolvedValue({ kind });
    const { store, calls } = fakeStore();
    await expect(createThread({ threadId: THREAD, videoId: VIDEO, lineId: LINE }, { store })).resolves.toEqual({ kind });
    expect(calls).toEqual([]);
    expect(getLineForLearner).not.toHaveBeenCalled();
  });
});

describe("getThread", () => {
  const msg = (over: Partial<MessageRow>): MessageRow => ({
    id: "m", turnId: "t1", role: "user", content: "なぜ?", contentJson: null, contentSchemaVersion: null,
    groundingJson: null, groundingSchemaVersion: null, createdAt: "2026-10-03T00:00:01.000Z", ...over,
  });

  it("returns a plain DTO with mapped roles, the anchor view and the pending projection", async () => {
    const { store } = fakeStore([thread()], [
      msg({ id: "m1", turnId: "t1" }),
      msg({ id: "m2", turnId: "t1", role: "ai", content: "Because…", contentJson: { blocks: [] }, contentSchemaVersion: 1 }),
      msg({ id: "m3", turnId: "t2" }),
      msg({ id: "m4", turnId: "t3" }),
    ], new Map([["t2", "held"], ["t3", "released"]]));
    const result = await getThread(THREAD, { store });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    assertPlainSerializableDto(result.detail);
    expect(result.detail.messages.map((m) => [m.id, m.role])).toEqual([["m1", "user"], ["m2", "assistant"], ["m3", "user"], ["m4", "user"]]);
    // Unvalidated structured content never leaves the server before Task 7's schema.
    expect(result.detail.messages[1]).toMatchObject({ answer: null, grounding: null, text: "Because…" });
    expect(result.detail.pendingTurns).toEqual([{ turnId: "t2", status: "running" }, { turnId: "t3", status: "retryable" }]);
    expect(result.detail.thread.anchor).toEqual({
      videoId: VIDEO, videoTitle: "Ep", lineId: LINE, lineText: LINE_TEXT, translation: "Today", startTime: 12.5, span: null,
    });
  });

  it("drops the chip and the route when the anchored line is gone (Review Focus 5)", async () => {
    const { store } = fakeStore([thread({ originLineId: "d0000000-0000-4000-8000-00000000dead" })]);
    const result = await getThread(THREAD, { store });
    expect(result).toMatchObject({ kind: "ok", detail: { thread: { anchor: null, originRoute: null } } });
  });

  it("answers not_found for another learner's thread and a scenario session", async () => {
    const theirs = fakeStore([thread({ userId: "e0000000-0000-4000-8000-000000000009" })]);
    await expect(getThread(THREAD, { store: theirs.store })).resolves.toEqual({ kind: "not_found" });
    const scenario = fakeStore([thread({ kind: "scenario" })]);
    await expect(getThread(THREAD, { store: scenario.store })).resolves.toEqual({ kind: "not_found" });
  });
});

describe("listThreads", () => {
  it("pages by an opaque keyset cursor and rejects a forged one", async () => {
    const rows = Array.from({ length: THREAD_PAGE_SIZE + 1 }, (_, i) =>
      thread({ id: `b0000000-0000-4000-8000-${String(i).padStart(12, "0")}`, originLineId: null, originVideoId: null, originRoute: null }));
    const { store } = fakeStore(rows);
    const result = await listThreads(null, { store });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    assertPlainSerializableDto(result);
    expect(result.threads).toHaveLength(THREAD_PAGE_SIZE);
    expect(decodeCursor(result.nextCursor as string)).toEqual({ updatedAt: rows[THREAD_PAGE_SIZE - 1]!.updatedAt, id: rows[THREAD_PAGE_SIZE - 1]!.id });
    await expect(listThreads("not-a-cursor", { store })).resolves.toEqual({ kind: "invalid" });
    await expect(listThreads(encodeCursor({ updatedAt: "x", id: THREAD }), { store })).resolves.toEqual({ kind: "invalid" });
  });
});

describe("postTurn", () => {
  const body = { turnId: "e0000000-0000-4000-8000-000000000001", text: "Why?", locale: "en" as const };

  it("checks the gate before the rate limit and the rate limit before the pipeline", async () => {
    vi.mocked(korumeGate).mockResolvedValueOnce({ kind: "disabled" });
    await expect(postTurn(THREAD, body)).resolves.toEqual({ kind: "disabled" });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(runTurn).not.toHaveBeenCalled();

    vi.mocked(rateLimit).mockReturnValueOnce({ ok: false, retryAfter: 900 } as never);
    await expect(postTurn(THREAD, body)).resolves.toEqual({ kind: "rate_limited", retryAfter: 900 });
    expect(runTurn).not.toHaveBeenCalled();

    await expect(postTurn(THREAD, body)).resolves.toEqual({ status: "pending" });
    expect(runTurn).toHaveBeenCalledWith(
      { supabase: client, userId: ME, threadId: THREAD, turnId: body.turnId, text: "Why?", locale: "en" }, {},
    );
  });
});
