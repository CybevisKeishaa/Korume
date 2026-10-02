import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, hasCall, type QueryCall } from "@/test/supabase-mock";
import { assertPlainSerializableDto } from "@/test/dto";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { deleteLessonNote, deleteSentenceNote, listMyLessonNotes, setLessonNote, setSentenceNote } from "./notes";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ ok: true })) }));

const USER = { id: "u-notes" };
const LINE_ID = "a0000000-0000-0000-0000-000000000001";
const VIDEO_ID = "c0000000-0000-0000-0000-000000000001";
const TRANSCRIPT_ID = "b0000000-0000-0000-0000-000000000001";

function useTables(tables: Parameters<typeof createMockSupabase>[0]["tables"], user: { id: string } | null = USER) {
  vi.mocked(createClient).mockReturnValue(createMockSupabase({ user, tables }) as ReturnType<typeof createClient>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 0 });
});

describe("note writes", () => {
  it("returns 401 for an anonymous write and never touches a table", async () => {
    useTables({}, null);
    await expect(setSentenceNote(LINE_ID, "memo")).resolves.toEqual({ ok: false, status: 401 });
    await expect(deleteLessonNote(VIDEO_ID)).resolves.toEqual({ ok: false, status: 401 });
  });

  it("rate-limits every note write under one user key", async () => {
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 5_000 });
    useTables({ sentence_notes: () => { throw new Error("must not write"); }, lesson_notes: () => { throw new Error("must not write"); } });
    await expect(setSentenceNote(LINE_ID, "memo")).resolves.toEqual({ ok: false, status: 429, retryAfter: 5_000 });
    await expect(setLessonNote(VIDEO_ID, "memo")).resolves.toEqual({ ok: false, status: 429, retryAfter: 5_000 });
    expect(rateLimit).toHaveBeenCalledWith("note-write:u-notes", { limit: 60, windowMs: 60_000 });
  });

  it.each([
    ["sentence", () => setSentenceNote(LINE_ID, "覚える"), "sentence_notes", { user_id: USER.id, transcript_line_id: LINE_ID, body: "覚える" }, "user_id,transcript_line_id"],
    ["lesson", () => setLessonNote(VIDEO_ID, "覚える"), "lesson_notes", { user_id: USER.id, video_id: VIDEO_ID, body: "覚える" }, "user_id,video_id"],
  ] as const)("upserts the %s note on its primary key, leaving updated_at to the database", async (_kind, write, table, values, onConflict) => {
    useTables({ [table]: (calls: QueryCall[]) => {
      expect(calls).toContainEqual({ op: "upsert", values, options: { onConflict } });
      return { data: null, error: null };
    } });
    await expect(write()).resolves.toEqual({ ok: true });
  });

  it.each([
    [{ code: "42501", message: "refused" }, { ok: false, status: 404 }],
    [{ code: "23503", message: "missing" }, { ok: false, status: 404 }],
  ])("maps an RLS or FK refusal %# to a generic 404", async (error, expected) => {
    useTables({ sentence_notes: () => ({ data: null, error }), lesson_notes: () => ({ data: null, error }) });
    await expect(setSentenceNote(LINE_ID, "memo")).resolves.toEqual(expected);
    await expect(setLessonNote(VIDEO_ID, "memo")).resolves.toEqual(expected);
  });

  it("turns an empty body into a delete of only the caller's note", async () => {
    useTables({
      sentence_notes: (calls) => {
        expect(hasCall(calls, "upsert")).toBe(false);
        expect(calls).toContainEqual({ op: "delete" });
        expect(eqValue(calls, "user_id")).toBe(USER.id);
        expect(eqValue(calls, "transcript_line_id")).toBe(LINE_ID);
        return { data: null, error: null };
      },
      lesson_notes: (calls) => {
        expect(calls).toContainEqual({ op: "delete" });
        expect(eqValue(calls, "user_id")).toBe(USER.id);
        expect(eqValue(calls, "video_id")).toBe(VIDEO_ID);
        return { data: null, error: null };
      },
    });
    await expect(setSentenceNote(LINE_ID, "")).resolves.toEqual({ ok: true });
    await expect(deleteSentenceNote(LINE_ID)).resolves.toEqual({ ok: true });
    await expect(setLessonNote(VIDEO_ID, "")).resolves.toEqual({ ok: true });
  });

  it("throws any other error instead of reporting success", async () => {
    useTables({ sentence_notes: () => ({ data: null, error: { code: "XX000", message: "boom" } }) });
    await expect(setSentenceNote(LINE_ID, "memo")).rejects.toMatchObject({ code: "XX000" });
    await expect(deleteSentenceNote(LINE_ID)).rejects.toMatchObject({ code: "XX000" });
  });
});

describe("listMyLessonNotes", () => {
  it("returns nothing for an anonymous reader", async () => {
    useTables({}, null);
    await expect(listMyLessonNotes(VIDEO_ID, TRANSCRIPT_ID)).resolves.toEqual({ lessonNote: null, sentenceNotes: [] });
  });

  it("pages the caller's sentence notes for one transcript under a total order, as a plain DTO", async () => {
    const rows = Array.from({ length: 1_200 }, (_, index) => ({
      transcript_line_id: `a0000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
      body: `note ${index}`,
      updated_at: "2026-10-02T00:00:00+00:00",
      transcript_lines: { transcript_id: TRANSCRIPT_ID },
    }));
    const queries: QueryCall[][] = [];
    vi.mocked(createClient).mockReturnValue(createMockSupabase({
      user: USER,
      enforcePostgrestCap: true,
      tables: {
        sentence_notes: (calls) => { queries.push(calls); return { data: rows, error: null }; },
        lesson_notes: (calls) => {
          expect(eqValue(calls, "user_id")).toBe(USER.id);
          expect(eqValue(calls, "video_id")).toBe(VIDEO_ID);
          expect(hasCall(calls, "maybeSingle")).toBe(true);
          return { data: { body: "lesson memo", updated_at: "2026-10-01T00:00:00+00:00" }, error: null };
        },
      },
    }) as ReturnType<typeof createClient>);

    const result = await listMyLessonNotes(VIDEO_ID, TRANSCRIPT_ID);
    assertPlainSerializableDto(result);
    expect(result.lessonNote).toEqual({
      key: `lesson:${VIDEO_ID}`, lineId: null, videoId: VIDEO_ID, body: "lesson memo", updatedAt: "2026-10-01T00:00:00+00:00",
    });
    expect(result.sentenceNotes).toHaveLength(1_200);
    expect(result.sentenceNotes[0]).toEqual({
      key: "sentence:a0000000-0000-0000-0000-000000000000", lineId: "a0000000-0000-0000-0000-000000000000", videoId: VIDEO_ID,
      body: "note 0", updatedAt: "2026-10-02T00:00:00+00:00",
    });
    expect(queries).toHaveLength(2);
    expect(queries[0]).toContainEqual({ op: "select", columns: "transcript_line_id, body, updated_at, transcript_lines!inner(transcript_id)" });
    expect(queries[0]).toContainEqual({ op: "eq", column: "user_id", value: USER.id });
    expect(queries[0]).toContainEqual({ op: "eq", column: "transcript_lines.transcript_id", value: TRANSCRIPT_ID });
    expect((queries[0] ?? []).filter((call) => call.op === "order")).toEqual([
      { op: "order", column: "updated_at", ascending: true },
      { op: "order", column: "transcript_line_id", ascending: true },
    ]);
  });
});
