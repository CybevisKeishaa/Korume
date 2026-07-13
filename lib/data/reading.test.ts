import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { toFurigana } from "@/lib/japanese";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/japanese", () => ({ toFurigana: vi.fn() }));

import { getReadingPassageDetail, listReadingPassages, submitReadingQuiz } from "./reading";
import type { ReadingSubmitInput } from "@/lib/validation/reading";

const PASSAGE_ID = "b0000000-0000-0000-0000-000000000001";
const Q1 = "b0000000-0000-0000-0001-000000000001";
const Q2 = "b0000000-0000-0000-0001-000000000002";
const USER = { id: "u1" };

function mockClient(tables: Parameters<typeof createMockSupabase>[0]["tables"], user: { id: string } | null = USER) {
  const supabase = createMockSupabase({ user, tables });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

function mockService(tables: Parameters<typeof createMockSupabase>[0]["tables"]) {
  const supabase = createMockSupabase({ tables });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
  return supabase;
}

const PASSAGE_LIST_ROW = { id: PASSAGE_ID, title: "わたしの一日", jlpt_level: "N5", word_count: 34, created_at: "2026-01-01T00:00:00Z" };

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createServiceClient).mockReset();
  vi.mocked(toFurigana).mockReset();
});

describe("listReadingPassages", () => {
  it("lists all passages when no level filter is given", async () => {
    mockClient({ reading_passages: () => ({ data: [PASSAGE_LIST_ROW], error: null }) });
    expect(await listReadingPassages()).toEqual([PASSAGE_LIST_ROW]);
  });

  it("filters by level when given", async () => {
    mockClient({
      reading_passages: (calls: QueryCall[]) => {
        expect(eqValue(calls, "jlpt_level")).toBe("N4");
        return { data: [], error: null };
      },
    });
    await listReadingPassages("N4");
  });

  it("throws on a query error", async () => {
    mockClient({ reading_passages: () => ({ data: null, error: { message: "boom" } }) });
    await expect(listReadingPassages()).rejects.toBeTruthy();
  });
});

describe("getReadingPassageDetail", () => {
  it("returns null when the passage does not exist", async () => {
    mockClient({ reading_passages: () => ({ data: null, error: null }) });
    expect(await getReadingPassageDetail(PASSAGE_ID)).toBeNull();
  });

  it("returns the passage with its questions ordered, and no correct_answer/explanation", async () => {
    // furigana_json is already populated here so this test stays focused on
    // question shape/ordering — the null/generation path is covered below.
    mockClient({
      reading_passages: () => ({
        data: {
          id: PASSAGE_ID,
          title: "わたしの一日",
          jlpt_level: "N5",
          body_jp: "わたしは まいあさ 六時半に おきます。",
          body_translation: "I wake up at 6:30 every morning.",
          furigana_json: [{ text: "わたし" }],
          word_count: 34,
          created_at: "2026-01-01T00:00:00Z",
        },
        error: null,
      }),
      reading_questions: () => ({
        data: [
          { id: Q1, question: "わたしは 何時に おきますか。", options: ["六時半", "六時", "七時", "七時半"], order_index: 1 },
          { id: Q2, question: "わたしは 何時に かいしゃに いきますか。", options: ["八時", "九時", "十時", "七時"], order_index: 2 },
        ],
        error: null,
      }),
    });

    const result = await getReadingPassageDetail(PASSAGE_ID);
    expect(result).not.toBeNull();
    expect(result?.body_jp).toBe("わたしは まいあさ 六時半に おきます。");
    expect(result?.furigana_json).toEqual([{ text: "わたし" }]);
    expect(result?.questions).toHaveLength(2);
    expect(result?.questions[0]).toEqual({
      id: Q1,
      question: "わたしは 何時に おきますか。",
      options: ["六時半", "六時", "七時", "七時半"],
      order_index: 1,
    });
  });

  describe("furigana generate-on-first-read", () => {
    const BODY_JP = "わたしは まいあさ 六時半に おきます。";
    const GENERATED = [{ text: "わたし" }, { text: "六時半", reading: "ろくじはん" }];

    function passageRow(furiganaJson: unknown) {
      return {
        id: PASSAGE_ID,
        title: "わたしの一日",
        jlpt_level: "N5",
        body_jp: BODY_JP,
        body_translation: null,
        furigana_json: furiganaJson,
        word_count: 34,
        created_at: "2026-01-01T00:00:00Z",
      };
    }

    it("generates and caches furigana when furigana_json is null, and returns it", async () => {
      vi.mocked(toFurigana).mockResolvedValue(GENERATED);
      mockClient({
        reading_passages: () => ({ data: passageRow(null), error: null }),
        reading_questions: () => ({ data: [], error: null }),
      });
      let updatedRow: unknown;
      mockService({
        reading_passages: (calls: QueryCall[]) => {
          const updateCall = calls.find((c): c is Extract<QueryCall, { op: "update" }> => c.op === "update");
          updatedRow = updateCall?.values;
          expect(eqValue(calls, "id")).toBe(PASSAGE_ID);
          return { data: null, error: null };
        },
      });

      const result = await getReadingPassageDetail(PASSAGE_ID);
      expect(toFurigana).toHaveBeenCalledWith(BODY_JP);
      expect(result?.furigana_json).toEqual(GENERATED);
      expect((updatedRow as Record<string, unknown>).furigana_json).toEqual(GENERATED);
    });

    it("returns furigana_json as-is without calling the generator when already populated", async () => {
      const existing = [{ text: "既存" }];
      mockClient({
        reading_passages: () => ({ data: passageRow(existing), error: null }),
        reading_questions: () => ({ data: [], error: null }),
      });
      // No mockService registered — a call to createServiceClient().from(...)
      // would throw "no resolver registered", proving generation is skipped.

      const result = await getReadingPassageDetail(PASSAGE_ID);
      expect(toFurigana).not.toHaveBeenCalled();
      expect(result?.furigana_json).toEqual(existing);
    });

    it("returns furigana_json: null (and still returns the passage) when the generator throws", async () => {
      vi.mocked(toFurigana).mockRejectedValue(new Error("kuromoji dictionary load failed"));
      mockClient({
        reading_passages: () => ({ data: passageRow(null), error: null }),
        reading_questions: () => ({ data: [], error: null }),
      });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const result = await getReadingPassageDetail(PASSAGE_ID);
      expect(result).not.toBeNull();
      expect(result?.furigana_json).toBeNull();
      expect(result?.body_jp).toBe(BODY_JP);
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });
});

describe("submitReadingQuiz", () => {
  const answers: ReadingSubmitInput["answers"] = { [Q1]: "0", [Q2]: "3" };

  it("returns 401 when signed out", async () => {
    mockClient({}, null);
    const result = await submitReadingQuiz(PASSAGE_ID, { answers });
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("returns 404 when the passage does not exist", async () => {
    mockClient({ reading_passages: () => ({ data: null, error: null }) });
    const result = await submitReadingQuiz(PASSAGE_ID, { answers });
    expect(result).toEqual({ ok: false, status: 404 });
  });

  it("returns 400 when the passage has no questions", async () => {
    mockClient({ reading_passages: () => ({ data: { id: PASSAGE_ID }, error: null }) });
    mockService({ reading_questions: () => ({ data: [], error: null }) });
    const result = await submitReadingQuiz(PASSAGE_ID, { answers });
    expect(result).toEqual({ ok: false, status: 400 });
  });

  it("scores the quiz, stores the percent, and returns per-question review with explanations", async () => {
    let insertedRow: unknown;
    mockClient(
      {
        reading_passages: () => ({ data: { id: PASSAGE_ID }, error: null }),
        user_reading_attempts: (calls: QueryCall[]) => {
          const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
          insertedRow = insertCall?.values;
          return { data: { id: "attempt-1" }, error: null };
        },
      },
      USER,
    );
    mockService({
      reading_questions: () => ({
        data: [
          { id: Q1, correct_answer: "0", explanation: "exp1" },
          { id: Q2, correct_answer: "1", explanation: "exp2" },
        ],
        error: null,
      }),
    });

    const result = await submitReadingQuiz(PASSAGE_ID, { answers });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.result.correct).toBe(1); // Q1 correct, Q2 wrong (chose 3, correct 1)
    expect(result.data.result.total).toBe(2);
    expect(result.data.result.percent).toBe(50);
    expect(result.data.perQuestion).toEqual(
      expect.arrayContaining([
        { id: Q1, correct: true, correctAnswer: "0", explanation: "exp1" },
        { id: Q2, correct: false, correctAnswer: "1", explanation: "exp2" },
      ]),
    );
    expect(result.data.attemptId).toBe("attempt-1");

    const row = insertedRow as Record<string, unknown>;
    expect(row.score).toBe(50);
    expect(row.user_id).toBe(USER.id);
    expect(row.passage_id).toBe(PASSAGE_ID);
    expect(row.answers).toEqual(answers);
  });

  it("returns 429 when the caller is over the rate limit", async () => {
    mockClient({ reading_passages: () => ({ data: { id: PASSAGE_ID }, error: null }) });
    const key = `reading:submit:${USER.id}`;
    const { rateLimit } = await import("@/lib/rate-limit");
    for (let i = 0; i < 200; i++) rateLimit(key, { limit: 20, windowMs: 60_000 });

    const result = await submitReadingQuiz(PASSAGE_ID, { answers });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(429);
  });
});
