import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { readPreferences } from "@/lib/data/preferences";
import { reviewItem } from "@/lib/srs";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/preferences", () => ({ readPreferences: vi.fn() }));
vi.mock("@/lib/data/gamification", () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/srs", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/srs")>()),
  reviewItem: vi.fn(),
}));

import { submitReview } from "./srs";

const NOW = new Date("2026-10-07T03:00:00Z");
const FIRST = "2026-09-01T10:00:00.000Z";

function stage(repetitions: number) {
  vi.mocked(reviewItem).mockReturnValue({
    repetitions,
    intervalDays: 5,
    easeFactor: 2.5,
    nextReviewAt: new Date("2026-10-08T00:00:00Z"),
    lastReviewedAt: NOW,
  });
}

/** Runs one review against a mocked progress table and returns the upserted row and the select columns. */
async function review(table: string, itemType: "vocab" | "kanji", existing: Record<string, unknown> | null) {
  let seen: QueryCall[] = [];
  const supabase = createMockSupabase({
    user: { id: "u1" },
    tables: {
      [table]: (calls) => {
        seen = calls;
        return { data: calls.some((c) => c.op === "upsert") ? null : existing, error: null };
      },
    },
  });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  await submitReview({ itemType, itemId: "i1", quality: 4 }, NOW);
  const upsert = seen.find((c): c is Extract<QueryCall, { op: "upsert" }> => c.op === "upsert");
  return { row: upsert?.values as Record<string, unknown> };
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(readPreferences).mockResolvedValue(DEFAULT_PREFERENCES);
  vi.mocked(reviewItem).mockReset();
});

describe("submitReview mastered_at (first transition)", () => {
  const prior = (srs_stage: number, mastered_at: string | null) => ({
    srs_stage, interval_days: 3, ease_factor: 2.5, mastered_at,
  });

  it("stamps now when a vocab word first reaches the mastery threshold", async () => {
    stage(2);
    const { row } = await review("user_vocab_progress", "vocab", prior(1, null));
    expect(row.mastered_at).toBe(NOW.toISOString());
  });

  it("keeps the existing instant on a later pass above the threshold", async () => {
    stage(3);
    const { row } = await review("user_vocab_progress", "vocab", prior(2, FIRST));
    expect(row.mastered_at).toBe(FIRST);
  });

  it("keeps the existing instant when the stage drops back to 0", async () => {
    stage(0);
    const { row } = await review("user_vocab_progress", "vocab", prior(3, FIRST));
    expect(row.mastered_at).toBe(FIRST);
  });

  it("sends null while a word has not reached the threshold", async () => {
    stage(1);
    const { row } = await review("user_vocab_progress", "vocab", prior(0, null));
    expect(row.mastered_at).toBeNull();
  });

  it("sends no mastered_at key for kanji (no such column)", async () => {
    stage(3);
    const { row } = await review("user_kanji_progress", "kanji", { srs_stage: 2, interval_days: 3, ease_factor: 2.5 });
    expect(row).not.toHaveProperty("mastered_at");
  });
});
