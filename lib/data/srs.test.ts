import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { readPreferences } from "@/lib/data/preferences";
import { reviewItem } from "@/lib/srs";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/preferences", () => ({ readPreferences: vi.fn() }));
vi.mock("@/lib/data/gamification", () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/dictionary/snapshot", () => ({ getActiveSnapshotId: vi.fn().mockResolvedValue("snap-1") }));
vi.mock("@/lib/data/missions", () => ({ ensureDailyMission: vi.fn().mockResolvedValue(null), claimActiveMission: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/srs", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/srs")>()),
  reviewItem: vi.fn(),
}));

import { recordActivity } from "@/lib/data/gamification";
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
async function review(
  table: string,
  itemType: "vocab" | "kanji",
  existing: Record<string, unknown> | null,
  { quality = 4, inDictionary = true }: { quality?: number; inDictionary?: boolean } = {},
) {
  let seen: QueryCall[] = [];
  let lookup: QueryCall[] = [];
  const supabase = createMockSupabase({
    user: { id: "u1" },
    tables: {
      vocab: () => ({ data: { id: "i1" }, error: null }),
      dict_kanji: (calls) => {
        lookup = calls;
        return { data: inDictionary ? { literal: "日" } : null, error: null };
      },
      [table]: (calls) => {
        seen = calls;
        return { data: calls.some((c) => c.op === "upsert") ? null : existing, error: null };
      },
    },
  });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  const result = await submitReview({ itemType, itemId: itemType === "kanji" ? "日" : "i1", quality }, NOW);
  const upsert = seen.find((c): c is Extract<QueryCall, { op: "upsert" }> => c.op === "upsert");
  return { result, lookup, upsert, row: upsert?.values as Record<string, unknown> };
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(readPreferences).mockResolvedValue(DEFAULT_PREFERENCES);
  vi.mocked(reviewItem).mockReset();
  vi.mocked(recordActivity).mockClear();
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

  it("does not invent a date for a row already at the threshold that never had one (not a first crossing)", async () => {
    stage(3);
    const { row } = await review("user_vocab_progress", "vocab", prior(2, null));
    expect(row.mastered_at).toBeNull();
  });

  it("sends no mastered_at key for kanji (no such column)", async () => {
    stage(3);
    const { row } = await review("user_kanji_progress", "kanji", { srs_stage: 2, interval_days: 3, ease_factor: 2.5 });
    expect(row).not.toHaveProperty("mastered_at");
  });
});

describe("submitReview kanji keyed by literal", () => {
  const prior = { srs_stage: 2, interval_days: 3, ease_factor: 2.5, reviews: 7, lapses: 2 };

  it("400s with no write when the literal is not in the active snapshot's dict_kanji", async () => {
    stage(1);
    const { result, lookup, upsert } = await review("user_kanji_progress", "kanji", prior, { inDictionary: false });
    expect(result).toEqual({ ok: false, status: 400 });
    expect(lookup).toEqual(expect.arrayContaining([
      { op: "eq", column: "snapshot_id", value: "snap-1" },
      { op: "eq", column: "literal", value: "日" },
    ]));
    expect(upsert).toBeUndefined();
    expect(recordActivity).not.toHaveBeenCalled();
  });

  it("upserts on user_id,literal, counts the review, and records the literal as the item", async () => {
    stage(3);
    const { upsert, row } = await review("user_kanji_progress", "kanji", prior);
    expect(upsert?.options).toEqual({ onConflict: "user_id,literal" });
    expect(row).toMatchObject({ user_id: "u1", literal: "日", reviews: 8, lapses: 2 });
    expect(row).not.toHaveProperty("kanji_id");
    expect(recordActivity).toHaveBeenCalledWith(expect.objectContaining({ parts: { itemType: "kanji", itemId: "日" } }));
  });

  it("counts a lapse only for Again (quality 1)", async () => {
    stage(0);
    expect((await review("user_kanji_progress", "kanji", prior, { quality: 1 })).row).toMatchObject({ reviews: 8, lapses: 3 });
    for (const quality of [3, 4, 5]) {
      stage(3);
      expect((await review("user_kanji_progress", "kanji", prior, { quality })).row).toMatchObject({ reviews: 8, lapses: 2 });
    }
  });

  it("starts the counters at 1/0 on a first review", async () => {
    stage(1);
    expect((await review("user_kanji_progress", "kanji", null)).row).toMatchObject({ reviews: 1, lapses: 0 });
  });
});
