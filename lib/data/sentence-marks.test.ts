import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { listMySentenceMarks, setSentenceMark } from "./sentence-marks";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ ok: true })) }));

const USER = { id: "u-marks" };
const LINE_ID = "a0000000-0000-0000-0000-000000000001";
const TRANSCRIPT_ID = "b0000000-0000-0000-0000-000000000001";

function useTables(tables: Parameters<typeof createMockSupabase>[0]["tables"], user: { id: string } | null = USER) {
  vi.mocked(createClient).mockReturnValue(createMockSupabase({ user, tables }) as ReturnType<typeof createClient>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 0 });
});

describe("sentence marks", () => {
  it("returns 401 for an anonymous write", async () => {
    useTables({}, null);
    await expect(setSentenceMark(LINE_ID, "bookmark", true)).resolves.toEqual({ ok: false, status: 401 });
  });

  it("rate-limits with the sentence-mark user key", async () => {
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 5_000 });
    useTables({ sentence_marks: () => { throw new Error("must not write"); } });
    await expect(setSentenceMark(LINE_ID, "bookmark", true)).resolves.toEqual({ ok: false, status: 429, retryAfter: 5_000 });
    expect(rateLimit).toHaveBeenCalledWith("sentence-mark:u-marks", { limit: 30, windowMs: 60_000 });
  });

  it.each([
    [null, { ok: true }],
    [{ code: "23505", message: "duplicate" }, { ok: true }],
    [{ code: "42501", message: "refused" }, { ok: false, status: 404 }],
    [{ code: "23503", message: "missing" }, { ok: false, status: 404 }],
  ])("maps insert result %#", async (error, expected) => {
    useTables({ sentence_marks: (calls) => {
      expect(calls).toContainEqual({ op: "insert", values: { user_id: USER.id, transcript_line_id: LINE_ID, kind: "bookmark" } });
      return { data: null, error };
    } });
    await expect(setSentenceMark(LINE_ID, "bookmark", true)).resolves.toEqual(expected);
  });

  it("deletes only the caller's requested mark and remains idempotent", async () => {
    useTables({ sentence_marks: (calls) => {
      expect(calls).toContainEqual({ op: "delete" });
      expect(eqValue(calls, "user_id")).toBe(USER.id);
      expect(eqValue(calls, "transcript_line_id")).toBe(LINE_ID);
      expect(eqValue(calls, "kind")).toBe("difficult");
      return { data: null, error: null };
    } });
    await expect(setSentenceMark(LINE_ID, "difficult", false)).resolves.toEqual({ ok: true });
  });

  it("throws any other insert or delete error instead of reporting success", async () => {
    useTables({ sentence_marks: () => ({ data: null, error: { code: "XX000", message: "boom" } }) });
    await expect(setSentenceMark(LINE_ID, "bookmark", true)).rejects.toMatchObject({ code: "XX000" });
    await expect(setSentenceMark(LINE_ID, "bookmark", false)).rejects.toMatchObject({ code: "XX000" });
  });

  it("pages only the caller's marks for the requested transcript", async () => {
    const marks = Array.from({ length: 1_200 }, (_, index) => ({
      transcript_line_id: `a0000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
      kind: index % 2 ? "difficult" : "bookmark",
      transcript_lines: { transcript_id: TRANSCRIPT_ID },
    }));
    const queries: QueryCall[][] = [];
    vi.mocked(createClient).mockReturnValue(createMockSupabase({
      user: USER,
      enforcePostgrestCap: true,
      tables: { sentence_marks: (calls) => { queries.push(calls); return { data: marks, error: null }; } },
    }) as ReturnType<typeof createClient>);

    await expect(listMySentenceMarks(TRANSCRIPT_ID)).resolves.toEqual(
      marks.map(({ transcript_line_id, kind }) => ({ lineId: transcript_line_id, kind })),
    );
    expect(queries).toHaveLength(2);
    // `!inner` turns the embedded filter into a row filter; without it every transcript's marks come back.
    expect(queries[0]).toContainEqual({ op: "select", columns: "transcript_line_id, kind, transcript_lines!inner(transcript_id)" });
    expect(queries[0]).toContainEqual({ op: "eq", column: "user_id", value: USER.id });
    expect(queries[0]).toContainEqual({ op: "eq", column: "transcript_lines.transcript_id", value: TRANSCRIPT_ID });
    expect(queries[0]).toContainEqual({ op: "order", column: "transcript_line_id", ascending: true });
    expect(queries[0]).toContainEqual({ op: "order", column: "kind", ascending: true });
  });
});
