import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type MockResult, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import {
  captureCompanionMemories,
  captureFirstVideoCompleted,
  captureShadowScoreMemories,
  getAnchorMemories,
  listJournal,
  pinMemory,
  recordDiscoveredMemory,
  recordFirstMeeting,
} from "./companion";
import { PHASE_THRESHOLDS, TARGET_SCORE } from "@/lib/companion";

const USER_ID = "u1";
const SESSION_ID = "s1";
const LINE_ID = "l1";
const VIDEO_ID = "v1";

function hasOp(calls: QueryCall[], op: QueryCall["op"]) {
  return calls.some((c) => c.op === op);
}

/** Point `createServiceClient()` at a mock client (the capture gate always
 * writes with the service role — see `recordDiscoveredMemory`). */
function mockService(tables: Parameters<typeof createMockSupabase>[0]["tables"]) {
  const supabase = createMockSupabase({ tables });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
  return supabase;
}

/** Point `createClient()` at a REQUEST-SCOPED mock client. Used by the
 * auth-aware entry points (`pinMemory`, `recordFirstMeeting`), which resolve
 * the caller via `requireUser` → `supabase.auth.getUser()`; `user: null` is a
 * signed-out caller. */
function mockClient(
  tables: Parameters<typeof createMockSupabase>[0]["tables"],
  user: { id: string } | null = { id: USER_ID },
) {
  const supabase = createMockSupabase({ user, tables });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

/** `companion_memories` resolver that records every upserted row, in order. */
function collectUpserts(into: Record<string, unknown>[]) {
  return (calls: QueryCall[]): MockResult => {
    const upsert = calls.find((c): c is Extract<QueryCall, { op: "upsert" }> => c.op === "upsert");
    if (upsert) {
      into.push(upsert.values as Record<string, unknown>);
      return { data: { id: `m${into.length}` }, error: null };
    }
    return { data: [], error: null };
  };
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createServiceClient).mockReset();
});

describe("recordDiscoveredMemory", () => {
  it("returns true when a new row is inserted", async () => {
    const supabase = createMockSupabase({
      tables: {
        companion_memories: (calls) =>
          hasOp(calls, "upsert") ? { data: { id: "m1" }, error: null } : { data: [], error: null },
      },
    });
    const created = await recordDiscoveredMemory(supabase as never, {
      userId: USER_ID,
      memoryType: "first_shadow",
      transcriptLineId: "L1",
      lineTextJp: "逃げろ",
      isAnchor: true,
    });
    expect(created).toBe(true);
  });

  it("returns false when the dedupe key already exists", async () => {
    const supabase = createMockSupabase({
      tables: { companion_memories: () => ({ data: null, error: null }) },
    });
    const created = await recordDiscoveredMemory(supabase as never, {
      userId: USER_ID,
      memoryType: "first_shadow",
    });
    expect(created).toBe(false);
  });

  it("upserts insert-or-ignore on (user_id, dedupe_key) — the idempotency contract", async () => {
    // These two options together are what make every producer idempotent:
    // `onConflict` names the natural key, `ignoreDuplicates` makes the FIRST
    // write win so a later repeat is a true no-op. Drop or flip either one and
    // a once-in-a-lifetime anchor like `first_shadow` would silently re-date
    // itself (fresh occurred_at, overwritten pointers) on every later score.
    let upsertCall: Extract<QueryCall, { op: "upsert" }> | undefined;
    const supabase = createMockSupabase({
      tables: {
        companion_memories: (calls) => {
          upsertCall = calls.find((c): c is Extract<QueryCall, { op: "upsert" }> => c.op === "upsert");
          return upsertCall ? { data: { id: "m1" }, error: null } : { data: [], error: null };
        },
      },
    });
    await recordDiscoveredMemory(supabase as never, {
      userId: USER_ID,
      memoryType: "first_shadow",
      isAnchor: true,
    });
    expect(upsertCall?.options).toEqual({ onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
  });
});

/** One stored journal row, as Postgres returns it. */
const JOURNAL_ROW = {
  id: "m1",
  kind: "discovered",
  memory_type: "jlpt_passed",
  title: null,
  video_id: null,
  transcript_line_id: "L1",
  timestamp_seconds: null,
  line_text_jp: "逃げろ",
  note: null,
  is_anchor: true,
  occurred_at: "2026-07-16T00:00:00Z",
  dedupe_key: "jlpt_passed:N4",
};

describe("listJournal", () => {
  it("maps rows to CompanionMemory and is ordered by occurred_at", async () => {
    let orderCall: QueryCall | undefined;
    const supabase = createMockSupabase({
      tables: {
        companion_memories: (calls) => {
          orderCall = calls.find((c) => c.op === "order");
          return { data: [JOURNAL_ROW], error: null };
        },
      },
    });
    const journal = await listJournal(supabase as never, USER_ID);
    expect(journal[0]).toMatchObject({ id: "m1", memoryType: "jlpt_passed", isAnchor: true });
    expect(orderCall).toMatchObject({ column: "occurred_at", ascending: false });
  });

  it("selects dedupe_key and exposes it as dedupeKey — the read-time source for title ICU values", async () => {
    // Discovered rows persist NO ref: the JLPT level / phase a title needs
    // survives ONLY inside the dedupe key (see refFromDedupeKey). Drop the
    // column from the select and the field silently reads `undefined`, so the
    // Journal would render "You passed !" — hence asserting the SELECT too,
    // not just the mapping.
    let selectedColumns: string | undefined;
    const supabase = createMockSupabase({
      tables: {
        companion_memories: (calls) => {
          selectedColumns = calls.find(
            (c): c is Extract<QueryCall, { op: "select" }> => c.op === "select",
          )?.columns;
          return { data: [JOURNAL_ROW], error: null };
        },
      },
    });
    const journal = await listJournal(supabase as never, USER_ID);
    expect(selectedColumns).toContain("dedupe_key");
    expect(journal[0]?.dedupeKey).toBe("jlpt_passed:N4");
  });
});

describe("getAnchorMemories", () => {
  it("filters to anchors only", async () => {
    let filtered = false;
    const supabase = createMockSupabase({
      tables: {
        companion_memories: (calls) => {
          filtered = calls.some((c) => c.op === "eq" && c.column === "is_anchor" && c.value === true);
          return { data: [], error: null };
        },
      },
    });
    await getAnchorMemories(supabase as never, USER_ID);
    expect(filtered).toBe(true);
  });
});

describe("captureCompanionMemories", () => {
  it("records companion_grew as an anchor when XP crosses a phase threshold", async () => {
    let inserted: Record<string, unknown> | undefined;
    const supabase = createMockSupabase({
      tables: {
        companion_memories: (calls) => {
          const upsert = calls.find((c) => c.op === "upsert");
          if (upsert) {
            inserted = upsert.values as Record<string, unknown>;
            return { data: { id: "m1" }, error: null };
          }
          return { data: [], error: null };
        },
      },
    });
    await captureCompanionMemories(supabase as never, {
      userId: USER_ID,
      source: "srs_review",
      parts: { itemType: "kanji", itemId: "k1" },
      prevXp: PHASE_THRESHOLDS[1] - 10,
      nextXp: PHASE_THRESHOLDS[1] + 10, // crosses into phase 2
    });
    expect(inserted).toMatchObject({
      memory_type: "companion_grew",
      dedupe_key: "companion_grew:2",
      is_anchor: true,
      kind: "discovered",
    });
  });

  it("records nothing when XP stays inside the same phase", async () => {
    let touched = false;
    const supabase = createMockSupabase({
      tables: {
        companion_memories: (calls) => {
          if (calls.some((c) => c.op === "upsert")) touched = true;
          return { data: [], error: null };
        },
      },
    });
    await captureCompanionMemories(supabase as never, {
      userId: USER_ID,
      source: "srs_review",
      parts: { itemType: "kanji", itemId: "k1" },
      prevXp: 10,
      nextXp: 20,
    });
    expect(touched).toBe(false);
  });

  it("never throws — a DB error is swallowed (failure isolation §6.5)", async () => {
    const supabase = createMockSupabase({
      tables: { companion_memories: () => ({ data: null, error: { message: "boom" } }) },
    });
    await expect(
      captureCompanionMemories(supabase as never, {
        userId: USER_ID,
        source: "srs_review",
        parts: {},
        prevXp: PHASE_THRESHOLDS[1] - 1,
        nextXp: PHASE_THRESHOLDS[1] + 1,
      }),
    ).resolves.toBeUndefined();
  });

  it("records nothing on a shadowing outcome (first_shadow deferred to Plan 2)", async () => {
    let touched = false;
    const supabase = createMockSupabase({
      tables: {
        companion_memories: (calls) => {
          if (calls.some((c) => c.op === "upsert")) touched = true;
          return { data: [], error: null };
        },
      },
    });
    await captureCompanionMemories(supabase as never, {
      userId: USER_ID,
      source: "shadowing",
      parts: { lineId: "L1" },
      prevXp: 10,
      nextXp: 20,
    });
    expect(touched).toBe(false);
  });

  it("records mining_saved with the card pointer on a mining_review outcome", async () => {
    let inserted: Record<string, unknown> | undefined;
    const supabase = createMockSupabase({
      tables: {
        sentence_mining_cards: () => ({
          data: { transcript_line_id: "L2", sentence_jp: "待って", start_time: 12.5, video_id: "V2" },
          error: null,
        }),
        companion_memories: (calls) => {
          const upsert = calls.find((c) => c.op === "upsert");
          if (upsert) {
            inserted = upsert.values as Record<string, unknown>;
            return { data: { id: "m1" }, error: null };
          }
          return { data: [], error: null };
        },
      },
    });
    await captureCompanionMemories(supabase as never, {
      userId: USER_ID,
      source: "mining_review",
      parts: { cardId: "C1" },
      prevXp: 10,
      nextXp: 20,
    });
    expect(inserted).toMatchObject({
      memory_type: "mining_saved",
      dedupe_key: "mining_saved:C1",
      transcript_line_id: "L2",
      line_text_jp: "待って",
      video_id: "V2",
      is_anchor: false,
    });
  });

  it("records jlpt_passed as an anchor on a genuinely passed jlpt_submit outcome", async () => {
    let inserted: Record<string, unknown> | undefined;
    const supabase = createMockSupabase({
      tables: {
        jlpt_tests: () => ({ data: { level: "N4" }, error: null }),
        companion_memories: (calls) => {
          const upsert = calls.find((c) => c.op === "upsert");
          if (upsert) {
            inserted = upsert.values as Record<string, unknown>;
            return { data: { id: "m1" }, error: null };
          }
          return { data: [], error: null };
        },
      },
    });
    await captureCompanionMemories(supabase as never, {
      userId: USER_ID,
      source: "jlpt_submit",
      parts: { testId: "T9" },
      prevXp: 10,
      nextXp: 20,
      passed: true,
    });
    expect(inserted).toMatchObject({
      memory_type: "jlpt_passed",
      dedupe_key: "jlpt_passed:N4",
      is_anchor: true,
    });
  });

  it("records nothing on a failed jlpt_submit outcome", async () => {
    let touched = false;
    const supabase = createMockSupabase({
      tables: {
        jlpt_tests: () => ({ data: { level: "N4" }, error: null }),
        companion_memories: (calls) => {
          if (calls.some((c) => c.op === "upsert")) touched = true;
          return { data: [], error: null };
        },
      },
    });
    await captureCompanionMemories(supabase as never, {
      userId: USER_ID,
      source: "jlpt_submit",
      parts: { testId: "T9" },
      prevXp: 10,
      nextXp: 20,
      passed: false,
    });
    expect(touched).toBe(false);
  });
});

describe("captureShadowScoreMemories", () => {
  it("does nothing below TARGET_SCORE", async () => {
    // No tables registered: any `.from()` on the mock throws loudly, so the
    // guard has to short-circuit BEFORE the service client is even created.
    mockService({});
    await expect(
      captureShadowScoreMemories({
        userId: USER_ID,
        sessionId: SESSION_ID,
        videoId: VIDEO_ID,
        transcriptLineId: LINE_ID,
        pronunciationScore: TARGET_SCORE - 1,
      }),
    ).resolves.toBeUndefined();
    expect(vi.mocked(createServiceClient)).not.toHaveBeenCalled();
  });

  it("records first_shadow (anchor) with line pointers when the score reaches target", async () => {
    const upserts: Record<string, unknown>[] = [];
    let lineCalls: QueryCall[] = [];
    mockService({
      transcript_lines: (calls) => {
        lineCalls = calls;
        return { data: { text_jp: "こんにちは", start_time: 12.5 }, error: null };
      },
      // No earlier scored attempts on this line.
      shadowing_sessions: () => ({ data: [], error: null }),
      companion_memories: collectUpserts(upserts),
    });

    await captureShadowScoreMemories({
      userId: USER_ID,
      sessionId: SESSION_ID,
      videoId: VIDEO_ID,
      transcriptLineId: LINE_ID,
      pronunciationScore: TARGET_SCORE + 5,
    });

    // The line pointers come from the transcript line the session is on.
    expect(lineCalls).toEqual(
      expect.arrayContaining([{ op: "eq", column: "id", value: LINE_ID } as QueryCall]),
    );
    // A first-try success is `first_shadow` only — never also `line_mastered`.
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      user_id: USER_ID,
      kind: "discovered",
      memory_type: "first_shadow",
      dedupe_key: "first_shadow",
      is_anchor: true,
      video_id: VIDEO_ID,
      transcript_line_id: LINE_ID,
      line_text_jp: "こんにちは",
      timestamp_seconds: 12.5,
      title: null,
    });
  });

  it("records line_mastered when the line finally reaches target after falling short", async () => {
    const upserts: Record<string, unknown>[] = [];
    let historyCalls: QueryCall[] = [];
    mockService({
      transcript_lines: () => ({ data: { text_jp: "こんにちは", start_time: 12.5 }, error: null }),
      shadowing_sessions: (calls) => {
        historyCalls = calls;
        // Two earlier scored attempts, both short of target → the struggle rule holds.
        return { data: [{ pronunciation_score: 60 }, { pronunciation_score: 75 }], error: null };
      },
      companion_memories: collectUpserts(upserts),
    });

    await captureShadowScoreMemories({
      userId: USER_ID,
      sessionId: SESSION_ID,
      videoId: VIDEO_ID,
      transcriptLineId: LINE_ID,
      pronunciationScore: TARGET_SCORE + 5,
    });

    // History is this learner's OTHER scored attempts on this same line.
    expect(historyCalls).toEqual(
      expect.arrayContaining([
        { op: "eq", column: "user_id", value: USER_ID },
        { op: "eq", column: "transcript_line_id", value: LINE_ID },
        { op: "neq", column: "id", value: SESSION_ID },
      ] as QueryCall[]),
    );
    expect(upserts).toHaveLength(2);
    expect(upserts[1]).toMatchObject({
      user_id: USER_ID,
      kind: "discovered",
      memory_type: "line_mastered",
      dedupe_key: `line_mastered:${LINE_ID}`,
      is_anchor: false,
      video_id: VIDEO_ID,
      transcript_line_id: LINE_ID,
      line_text_jp: "こんにちは",
      timestamp_seconds: 12.5,
    });
  });

  it("does not record line_mastered when no earlier attempt fell short", async () => {
    const upserts: Record<string, unknown>[] = [];
    mockService({
      transcript_lines: () => ({ data: { text_jp: "こんにちは", start_time: 12.5 }, error: null }),
      // Both earlier attempts already hit target — nothing was ever a struggle.
      shadowing_sessions: () => ({ data: [{ pronunciation_score: 90 }, { pronunciation_score: 85 }], error: null }),
      companion_memories: collectUpserts(upserts),
    });

    await captureShadowScoreMemories({
      userId: USER_ID,
      sessionId: SESSION_ID,
      videoId: VIDEO_ID,
      transcriptLineId: LINE_ID,
      pronunciationScore: TARGET_SCORE + 5,
    });

    expect(upserts.map((row) => row.memory_type)).toEqual(["first_shadow"]);
  });

  it("records first_shadow with null line pointers when the session has no linked line", async () => {
    const upserts: Record<string, unknown>[] = [];
    // Only `companion_memories` is registered: touching `transcript_lines` or
    // `shadowing_sessions` would throw, proving neither lookup runs.
    mockService({ companion_memories: collectUpserts(upserts) });

    await captureShadowScoreMemories({
      userId: USER_ID,
      sessionId: SESSION_ID,
      videoId: VIDEO_ID,
      transcriptLineId: null,
      pronunciationScore: TARGET_SCORE,
    });

    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      memory_type: "first_shadow",
      is_anchor: true,
      transcript_line_id: null,
      line_text_jp: null,
      timestamp_seconds: null,
      video_id: VIDEO_ID,
    });
  });

  it("never throws — a failing insert only console.errors (failure isolation §6.5)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockService({
      transcript_lines: () => ({ data: { text_jp: "こんにちは", start_time: 12.5 }, error: null }),
      shadowing_sessions: () => ({ data: [], error: null }),
      companion_memories: () => ({ data: null, error: { message: "boom" } }),
    });

    await expect(
      captureShadowScoreMemories({
        userId: USER_ID,
        sessionId: SESSION_ID,
        videoId: VIDEO_ID,
        transcriptLineId: LINE_ID,
        pronunciationScore: TARGET_SCORE + 5,
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      "[companion] captureShadowScoreMemories first_shadow failed:",
      expect.objectContaining({ message: "boom" }),
    );
    errorSpy.mockRestore();
  });

  it("abandons the capture when the line lookup errors — never freezes a pointer-less anchor", async () => {
    // `first_shadow`'s dedupe key is a constant and duplicates are ignored, so
    // an anchor written with null pointers because the lookup blipped would be
    // frozen FOREVER. A missed memory is recoverable on the next at-target
    // score; a frozen degraded one is not. So: no upsert at all.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const upserts: Record<string, unknown>[] = [];
    mockService({
      transcript_lines: () => ({ data: null, error: { message: "lookup boom" } }),
      shadowing_sessions: () => ({ data: [], error: null }),
      companion_memories: collectUpserts(upserts),
    });

    await expect(
      captureShadowScoreMemories({
        userId: USER_ID,
        sessionId: SESSION_ID,
        videoId: VIDEO_ID,
        transcriptLineId: LINE_ID,
        pronunciationScore: TARGET_SCORE + 5,
      }),
    ).resolves.toBeUndefined();

    expect(upserts).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      "[companion] captureShadowScoreMemories line lookup failed:",
      expect.objectContaining({ message: "lookup boom" }),
    );
    errorSpy.mockRestore();
  });

  it("still evaluates line_mastered when the first_shadow upsert fails (per-producer isolation)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const upserts: Record<string, unknown>[] = [];
    mockService({
      transcript_lines: () => ({ data: { text_jp: "こんにちは", start_time: 12.5 }, error: null }),
      // Two earlier attempts, both short of target → the struggle rule holds,
      // so `line_mastered` genuinely qualifies on this score.
      shadowing_sessions: () => ({ data: [{ pronunciation_score: 60 }, { pronunciation_score: 75 }], error: null }),
      companion_memories: (calls) => {
        const upsert = calls.find((c): c is Extract<QueryCall, { op: "upsert" }> => c.op === "upsert");
        if (!upsert) return { data: [], error: null };
        const values = upsert.values as Record<string, unknown>;
        if (values.memory_type === "first_shadow") return { data: null, error: { message: "first_shadow boom" } };
        upserts.push(values);
        return { data: { id: `m${upserts.length}` }, error: null };
      },
    });

    await expect(
      captureShadowScoreMemories({
        userId: USER_ID,
        sessionId: SESSION_ID,
        videoId: VIDEO_ID,
        transcriptLineId: LINE_ID,
        pronunciationScore: TARGET_SCORE + 5,
      }),
    ).resolves.toBeUndefined();

    // The failing anchor must not swallow the other producer's evaluation.
    expect(upserts.map((row) => row.memory_type)).toEqual(["line_mastered"]);
    expect(upserts[0]).toMatchObject({
      user_id: USER_ID,
      dedupe_key: `line_mastered:${LINE_ID}`,
      transcript_line_id: LINE_ID,
      line_text_jp: "こんにちは",
      timestamp_seconds: 12.5,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "[companion] captureShadowScoreMemories first_shadow failed:",
      expect.objectContaining({ message: "first_shadow boom" }),
    );
    errorSpy.mockRestore();
  });
});

describe("captureFirstVideoCompleted", () => {
  it("records the anchor memory via the service client with the video pointer", async () => {
    const upserts: Record<string, unknown>[] = [];
    mockService({ companion_memories: collectUpserts(upserts) });

    await captureFirstVideoCompleted(USER_ID, VIDEO_ID);

    expect(vi.mocked(createServiceClient)).toHaveBeenCalledTimes(1);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      user_id: USER_ID,
      kind: "discovered",
      memory_type: "first_video_completed",
      // Constant key — "first EVER completed video" is enforced by the
      // (user_id, dedupe_key) unique upsert, not by a pre-check.
      dedupe_key: "first_video_completed",
      is_anchor: true,
      video_id: VIDEO_ID,
      transcript_line_id: null,
      line_text_jp: null,
      timestamp_seconds: null,
      title: null,
    });
  });

  it("upserts insert-or-ignore so a later completion never re-dates the anchor", async () => {
    let upsertCall: Extract<QueryCall, { op: "upsert" }> | undefined;
    mockService({
      companion_memories: (calls) => {
        upsertCall = calls.find((c): c is Extract<QueryCall, { op: "upsert" }> => c.op === "upsert");
        // `null` data = the dedupe key already existed and the write was ignored.
        return { data: null, error: null };
      },
    });

    await captureFirstVideoCompleted(USER_ID, VIDEO_ID);

    expect(upsertCall?.options).toEqual({ onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
  });

  it("never throws when the write fails (failure isolation §6.5)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockService({ companion_memories: () => ({ data: null, error: { message: "boom" } }) });

    await expect(captureFirstVideoCompleted(USER_ID, VIDEO_ID)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      "[companion] captureFirstVideoCompleted failed:",
      expect.objectContaining({ message: "boom" }),
    );
    errorSpy.mockRestore();
  });
});

describe("recordFirstMeeting", () => {
  it("records the anchor memory for the signed-in user", async () => {
    const upserts: Record<string, unknown>[] = [];
    // Auth resolves off the REQUEST-scoped client; the write still goes
    // through the service role (discovered memories are gifted-only under RLS).
    // No tables on the request client: touching one would throw.
    mockClient({});
    mockService({ companion_memories: collectUpserts(upserts) });

    await recordFirstMeeting();

    expect(vi.mocked(createServiceClient)).toHaveBeenCalledTimes(1);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      user_id: USER_ID,
      kind: "discovered",
      memory_type: "first_meeting",
      // Constant key — "the first time the learner ever opened the Journal" is
      // enforced by the (user_id, dedupe_key) unique upsert, so every later
      // open is an ignored duplicate that preserves the original occurred_at.
      dedupe_key: "first_meeting",
      is_anchor: true,
      video_id: null,
      transcript_line_id: null,
      line_text_jp: null,
      timestamp_seconds: null,
      title: null,
    });
  });

  it("upserts insert-or-ignore so a later Journal open never re-dates the anchor", async () => {
    let upsertCall: Extract<QueryCall, { op: "upsert" }> | undefined;
    mockClient({});
    mockService({
      companion_memories: (calls) => {
        upsertCall = calls.find((c): c is Extract<QueryCall, { op: "upsert" }> => c.op === "upsert");
        // `null` data = the dedupe key already existed and the write was ignored.
        return { data: null, error: null };
      },
    });

    await recordFirstMeeting();

    expect(upsertCall?.options).toEqual({ onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
  });

  it("is a silent no-op when signed out", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockClient({}, null);

    await expect(recordFirstMeeting()).resolves.toBeUndefined();

    // No anonymous memory, and no noise in the logs — signing out is not an error.
    expect(vi.mocked(createServiceClient)).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("never throws when the write fails (failure isolation §6.5)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockClient({});
    mockService({ companion_memories: () => ({ data: null, error: { message: "boom" } }) });

    await expect(recordFirstMeeting()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      "[companion] recordFirstMeeting failed:",
      expect.objectContaining({ message: "boom" }),
    );
    errorSpy.mockRestore();
  });

  it("never throws when resolving the caller itself fails", async () => {
    // Every awaited call must sit inside the guard, not just the final write:
    // the Journal's server render calls this before reading the journal, so a
    // throw here would blank the page the memory is meant to appear on.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(createClient).mockImplementation(() => {
      throw new Error("no cookies");
    });

    await expect(recordFirstMeeting()).resolves.toBeUndefined();

    expect(vi.mocked(createServiceClient)).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      "[companion] recordFirstMeeting failed:",
      expect.objectContaining({ message: "no cookies" }),
    );
    errorSpy.mockRestore();
  });
});

describe("pinMemory statuses (carried Core cleanup #4)", () => {
  const PIN_INPUT = { transcriptLineId: LINE_ID, videoId: VIDEO_ID, lineTextJp: "逃げろ" };

  it("returns 401 when signed out", async () => {
    // No tables registered: a signed-out caller must never reach the DB.
    mockClient({}, null);

    await expect(pinMemory(PIN_INPUT)).resolves.toEqual({ ok: false, status: 401 });
  });

  it("returns 429 with retryAfter when the pin rate limit trips", async () => {
    // Its own user id so the exhausted bucket can't leak into another test —
    // `rateLimit` state is module-level and keyed per user.
    const user = { id: "u-pin-limit" };
    mockClient({}, user);
    const { rateLimit } = await import("@/lib/rate-limit");
    // Burn the whole PIN_LIMIT budget (60/min) on this user's key first.
    for (let i = 0; i < 100; i++) rateLimit(`companion:pin:${user.id}`, { limit: 60, windowMs: 60_000 });

    const result = await pinMemory(PIN_INPUT);

    expect(result).toEqual({ ok: false, status: 429, retryAfter: expect.any(Number) });
  });

  it("returns 400 for a transcript line that does not resolve", async () => {
    // RLS confines the lookup to lines the caller can see, so "no row" covers
    // both a bad id and one the caller isn't allowed to pin — a 400, not a 500.
    // Only `transcript_lines` is registered: reaching the insert would throw.
    mockClient({ transcript_lines: () => ({ data: null, error: null }) }, { id: "u-pin-400" });

    await expect(pinMemory(PIN_INPUT)).resolves.toEqual({ ok: false, status: 400 });
  });
});
