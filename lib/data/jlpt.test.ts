import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
// Gamification is a separate, already-unit-tested concern
// (lib/data/gamification.test.ts) — mock it here so this file only exercises
// jlpt scoring/persistence, not the award pipeline's own table reads/writes.
vi.mock("@/lib/data/gamification", () => ({
  recordActivity: vi.fn().mockResolvedValue({ ok: true, xpAwarded: 0, newBadges: [], leveledUp: false }),
}));

// Imported after the mocks above are registered.
import { getJlptTestDetail, listJlptAttempts, listJlptTests, submitJlptTest } from "./jlpt";
import type { JlptSubmitInput } from "@/lib/validation/jlpt";

const TEST_ID = "a0000000-0000-0000-0000-000000000000";
const Q1 = "a0000000-0000-0000-0001-000000000001";
const Q2 = "a0000000-0000-0000-0001-000000000002";
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

const TEST_ROW = {
  id: TEST_ID,
  level: "N5",
  title: "Đề luyện N5 #1",
  section_config: { sections: [{ section: "vocab", question_count: 12, time_limit_minutes: 20 }] },
};

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createServiceClient).mockReset();
});

describe("listJlptTests", () => {
  it("lists all tests when no level filter is given", async () => {
    mockClient({
      jlpt_tests: () => ({ data: [TEST_ROW], error: null }),
    });
    const result = await listJlptTests();
    expect(result).toEqual([TEST_ROW]);
  });

  it("filters by level when given", async () => {
    mockClient({
      jlpt_tests: (calls: QueryCall[]) => {
        expect(eqValue(calls, "level")).toBe("N5");
        return { data: [TEST_ROW], error: null };
      },
    });
    const result = await listJlptTests("N5");
    expect(result).toEqual([TEST_ROW]);
  });

  it("returns an empty array when there is no data", async () => {
    mockClient({ jlpt_tests: () => ({ data: null, error: null }) });
    expect(await listJlptTests()).toEqual([]);
  });

  it("throws on a query error", async () => {
    mockClient({ jlpt_tests: () => ({ data: null, error: { message: "boom" } }) });
    await expect(listJlptTests()).rejects.toBeTruthy();
  });
});

describe("getJlptTestDetail", () => {
  it("returns null when the test does not exist", async () => {
    mockClient({ jlpt_tests: () => ({ data: null, error: null }) });
    expect(await getJlptTestDetail(TEST_ID)).toBeNull();
  });

  it("returns the test with its questions stripped to the public shape", async () => {
    mockClient({
      jlpt_tests: () => ({ data: TEST_ROW, error: null }),
      jlpt_questions: () => ({
        data: [
          {
            id: Q1,
            section: "vocab",
            question_type: "kanji-reading",
            order_index: 1,
            question_data: { stem: "「今日」の読み方はどれですか。", choices: ["きょう", "きのう", "あした", "まいにち"] },
          },
          {
            id: Q2,
            section: "reading",
            question_type: "short-passage",
            order_index: 2,
            question_data: {
              stem: "何時に おきますか。",
              passage: "わたしは 六時に おきます。",
              choices: ["六時", "七時", "八時", "九時"],
            },
          },
        ],
        error: null,
      }),
    });

    const result = await getJlptTestDetail(TEST_ID);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(TEST_ID);
    expect(result?.questions).toHaveLength(2);
    expect(result?.questions[0]).toEqual({
      id: Q1,
      section: "vocab",
      question_type: "kanji-reading",
      order_index: 1,
      question_data: { stem: "「今日」の読み方はどれですか。", choices: ["きょう", "きのう", "あした", "まいにち"] },
    });
    expect(result?.questions[1]?.question_data).toEqual({
      stem: "何時に おきますか。",
      passage: "わたしは 六時に おきます。",
      choices: ["六時", "七時", "八時", "九時"],
    });
  });

  it("never leaks correct_answer/explanation even if present on the raw row", async () => {
    mockClient({
      jlpt_tests: () => ({ data: TEST_ROW, error: null }),
      jlpt_questions: () => ({
        data: [
          {
            id: Q1,
            section: "vocab",
            question_type: "kanji-reading",
            order_index: 1,
            // Simulates a leaky upstream select(*) — the mapper must still
            // strip to the public shape regardless of what's in the row.
            question_data: { stem: "s", choices: ["a", "b", "c", "d"] },
            correct_answer: "0",
            explanation: "should never appear",
          },
        ],
        error: null,
      }),
    });

    const result = await getJlptTestDetail(TEST_ID);
    const question = result?.questions[0] as unknown as Record<string, unknown>;
    expect(question.correct_answer).toBeUndefined();
    expect(question.explanation).toBeUndefined();
    expect(Object.keys(question.question_data as object)).toEqual(["stem", "choices"]);
  });
});

describe("submitJlptTest", () => {
  const answers: JlptSubmitInput["answers"] = { [Q1]: "0", [Q2]: "1" };

  it("returns 401 when signed out", async () => {
    mockClient({}, null);
    const result = await submitJlptTest(TEST_ID, { answers, mode: "full" });
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("returns 404 when the test does not exist", async () => {
    mockClient({ jlpt_tests: () => ({ data: null, error: null }) });
    const result = await submitJlptTest(TEST_ID, { answers, mode: "full" });
    expect(result).toEqual({ ok: false, status: 404 });
  });

  it("returns 400 when the (test, section) combination has no questions", async () => {
    mockClient({ jlpt_tests: () => ({ data: { id: TEST_ID, level: "N5" }, error: null }) });
    mockService({ jlpt_questions: () => ({ data: [], error: null }) });
    const result = await submitJlptTest(TEST_ID, { answers, mode: "full" });
    expect(result).toEqual({ ok: false, status: 400 });
  });

  it("scores a section-mode submission, stores the section percent as score, and returns per-question review", async () => {
    let insertedRow: unknown;
    mockClient(
      {
        jlpt_tests: () => ({ data: { id: TEST_ID, level: "N5" }, error: null }),
        user_test_attempts: (calls: QueryCall[]) => {
          const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
          insertedRow = insertCall?.values;
          return { data: { id: "attempt-1" }, error: null };
        },
      },
      USER,
    );
    mockService({
      jlpt_questions: () => ({
        data: [
          { id: Q1, section: "vocab", question_type: "kanji-reading", correct_answer: "0", explanation: "e1", order_index: 1 },
          { id: Q2, section: "vocab", question_type: "kanji-reading", correct_answer: "2", explanation: "e2", order_index: 2 },
        ],
        error: null,
      }),
    });

    const result = await submitJlptTest(TEST_ID, { answers, mode: "section", section: "vocab" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.result.mode).toBe("section");
    expect(result.data.result.totalCorrect).toBe(1); // Q1 correct, Q2 wrong
    expect(result.data.result.totalPercent).toBe(50);
    expect(result.data.perQuestion).toEqual(
      expect.arrayContaining([
        { id: Q1, correct: true, correctAnswer: "0", explanation: "e1" },
        { id: Q2, correct: false, correctAnswer: "2", explanation: "e2" },
      ]),
    );
    expect(result.data.attemptId).toBe("attempt-1");

    // Documented score convention: section mode stores the raw section percent.
    const row = insertedRow as Record<string, unknown>;
    expect(row.score).toBe(50);
    expect(row.mode).toBe("section");
    expect(row.section).toBe("vocab");
    expect(row.user_id).toBe(USER.id);
  });

  it("stores the scaled total (nullable) as score for full-mode submissions", async () => {
    let insertedRow: unknown;
    mockClient(
      {
        jlpt_tests: () => ({ data: { id: TEST_ID, level: "N5" }, error: null }),
        user_test_attempts: (calls: QueryCall[]) => {
          const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
          insertedRow = insertCall?.values;
          return { data: { id: "attempt-2" }, error: null };
        },
      },
      USER,
    );
    // Only vocab questions supplied (no grammar/reading/listening) => the
    // pillar structure can't be completed, so scaledTotal/passed are null.
    mockService({
      jlpt_questions: () => ({
        data: [
          { id: Q1, section: "vocab", question_type: "kanji-reading", correct_answer: "0", explanation: null, order_index: 1 },
        ],
        error: null,
      }),
    });

    const result = await submitJlptTest(TEST_ID, { answers: { [Q1]: "0" }, mode: "full" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.result.scaledTotal).toBeNull();

    const row = insertedRow as Record<string, unknown>;
    expect(row.score).toBeNull();
    expect(row.mode).toBe("full");
    expect(row.section).toBeNull();
  });

  it("returns 429 when the caller is over the rate limit", async () => {
    mockClient({ jlpt_tests: () => ({ data: { id: TEST_ID, level: "N5" }, error: null }) });
    const key = `jlpt:submit:${USER.id}`;
    const { rateLimit } = await import("@/lib/rate-limit");
    for (let i = 0; i < 200; i++) rateLimit(key, { limit: 20, windowMs: 60_000 });

    const result = await submitJlptTest(TEST_ID, { answers, mode: "full" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(429);
  });
});

describe("listJlptAttempts", () => {
  it("returns 401 when signed out", async () => {
    mockClient({}, null);
    const result = await listJlptAttempts();
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("scopes to the current user and optionally filters by testId", async () => {
    mockClient(
      {
        user_test_attempts: (calls: QueryCall[]) => {
          expect(eqValue(calls, "user_id")).toBe(USER.id);
          expect(eqValue(calls, "test_id")).toBe(TEST_ID);
          return { data: [{ id: "attempt-1", test_id: TEST_ID, score: 80 }], error: null };
        },
      },
      USER,
    );
    const result = await listJlptAttempts(TEST_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([{ id: "attempt-1", test_id: TEST_ID, score: 80 }]);
  });
});
