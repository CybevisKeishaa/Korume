import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, type MockResult, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { addKanjiToReview, getKanjiLearnerState, listKanjiFavorites, setKanjiFavorite } from "./kanji-learner";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ ok: true, retryAfter: 0 })) }));

const SNAPSHOT = "s0000000-0000-0000-0000-000000000001";
const FIXED_NOW = new Date("2026-11-06T10:00:00.000Z");

function use(options: { user?: { id: string } | null; known?: boolean; tables?: Record<string, (calls: QueryCall[]) => MockResult> } = {}) {
  const { user = { id: "u1" }, known = true, tables = {} } = options;
  vi.mocked(createClient).mockReturnValue(
    createMockSupabase({
      user,
      rpcs: { dict_active_snapshot_id: () => ({ data: SNAPSHOT, error: null }) },
      tables: {
        dict_kanji: (calls) => {
          expect(eqValue(calls, "snapshot_id")).toBe(SNAPSHOT);
          return { data: known ? { literal: "緑" } : null, error: null };
        },
        ...tables,
      },
    }) as unknown as ReturnType<typeof createClient>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

describe("guards (shared by both actions)", () => {
  it.each([
    ["favorite", () => setKanjiFavorite("緑", true)],
    ["review", () => addKanjiToReview("緑")],
  ])("%s: 401 signed out, 400 for a non-kanji, 429 over the limit, 404 for a literal outside the snapshot", async (name, act) => {
    use({ user: null });
    await expect(act()).resolves.toEqual({ ok: false, status: 401 });

    use();
    const bad = name === "favorite" ? setKanjiFavorite("abc", true) : addKanjiToReview("abc");
    await expect(bad).resolves.toEqual({ ok: false, status: 400 });

    vi.mocked(rateLimit).mockReturnValueOnce({ ok: false, retryAfter: 3_000 });
    await expect(act()).resolves.toEqual({ ok: false, status: 429, retryAfter: 3_000 });

    use({ known: false });
    await expect(act()).resolves.toEqual({ ok: false, status: 404 });
  });

  it("rate-limits per user per action", async () => {
    use({ tables: { user_kanji_favorites: () => ({ data: null, error: null }), user_kanji_progress: () => ({ data: null, error: null }) } });
    await setKanjiFavorite("緑", true);
    await addKanjiToReview("緑");
    expect(rateLimit).toHaveBeenCalledWith("kanji-favorite:u1", { limit: 60, windowMs: 60_000 });
    expect(rateLimit).toHaveBeenCalledWith("kanji-review:u1", { limit: 60, windowMs: 60_000 });
  });
});

describe("setKanjiFavorite", () => {
  it("favoriting upserts with ignoreDuplicates, so repeating it is a no-op", async () => {
    const seen: QueryCall[][] = [];
    use({ tables: { user_kanji_favorites: (calls) => (seen.push(calls), { data: null, error: null }) } });
    await expect(setKanjiFavorite("𠮟", true)).resolves.toEqual({ ok: true });
    await expect(setKanjiFavorite("𠮟", true)).resolves.toEqual({ ok: true });
    expect(seen[0]).toContainEqual({
      op: "upsert",
      values: { user_id: "u1", literal: "𠮟" },
      options: { onConflict: "user_id,literal", ignoreDuplicates: true },
    });
  });

  it("unfavoriting deletes only the caller row and succeeds when there is none", async () => {
    const seen: QueryCall[][] = [];
    use({ tables: { user_kanji_favorites: (calls) => (seen.push(calls), { data: null, error: null }) } });
    await expect(setKanjiFavorite("緑", false)).resolves.toEqual({ ok: true });
    expect(seen[0]).toContainEqual({ op: "delete" });
    expect(eqValue(seen[0] ?? [], "user_id")).toBe("u1");
    expect(eqValue(seen[0] ?? [], "literal")).toBe("緑");
  });

  it("throws a database error rather than reporting success", async () => {
    use({ tables: { user_kanji_favorites: () => ({ data: null, error: { message: "boom" } }) } });
    await expect(setKanjiFavorite("緑", true)).rejects.toMatchObject({ message: "boom" });
  });
});

describe("addKanjiToReview", () => {
  it("inserts a fresh card due now and never overwrites an existing row (ignoreDuplicates)", async () => {
    const seen: QueryCall[][] = [];
    use({ tables: { user_kanji_progress: (calls) => (seen.push(calls), { data: null, error: null }) } });
    await expect(addKanjiToReview("緑")).resolves.toEqual({ ok: true });
    expect(seen[0]).toContainEqual({
      op: "upsert",
      values: { user_id: "u1", literal: "緑", srs_stage: 0, next_review_at: FIXED_NOW.toISOString(), reviews: 0 },
      options: { onConflict: "user_id,literal", ignoreDuplicates: true },
    });
  });
});

describe("getKanjiLearnerState", () => {
  it("is empty for a signed-out caller", async () => {
    use({ user: null });
    await expect(getKanjiLearnerState("緑")).resolves.toEqual({ favorite: false, progress: null });
  });

  it("reflects the favorite and the progress row", async () => {
    use({
      tables: {
        user_kanji_favorites: () => ({ data: { literal: "緑" }, error: null }),
        user_kanji_progress: (calls) => {
          expect(eqValue(calls, "user_id")).toBe("u1");
          return { data: { srs_stage: 2, reviews: 5, lapses: 1, next_review_at: "2026-11-07T00:00:00.000Z" }, error: null };
        },
      },
    });
    await expect(getKanjiLearnerState("緑")).resolves.toEqual({
      favorite: true,
      progress: { stage: 2, reviews: 5, lapses: 1, nextReviewAt: "2026-11-07T00:00:00.000Z" },
    });
  });

  it("is not-favorite with no progress when the learner has neither", async () => {
    use({ tables: { user_kanji_favorites: () => ({ data: null, error: null }), user_kanji_progress: () => ({ data: null, error: null }) } });
    await expect(getKanjiLearnerState("緑")).resolves.toEqual({ favorite: false, progress: null });
  });
});

describe("listKanjiFavorites", () => {
  it("lists newest first with Han-Viet readings from the active snapshot", async () => {
    const seen: QueryCall[][] = [];
    use({
      tables: {
        user_kanji_favorites: (calls) => (seen.push(calls), { data: [{ literal: "緑" }, { literal: "𠮟" }], error: null }),
        dict_kanji: (calls) => {
          expect(eqValue(calls, "snapshot_id")).toBe(SNAPSHOT);
          return { data: [{ literal: "緑", vi_readings: ["Lục"] }], error: null };
        },
      },
    });
    await expect(listKanjiFavorites()).resolves.toEqual([
      { literal: "緑", hanViet: ["Lục"] },
      { literal: "𠮟", hanViet: [] },
    ]);
    expect(seen[0]).toContainEqual({ op: "order", column: "created_at", ascending: false });
    expect(eqValue(seen[0] ?? [], "user_id")).toBe("u1");
  });

  it("is empty when signed out or with no favorites", async () => {
    use({ user: null });
    await expect(listKanjiFavorites()).resolves.toEqual([]);
    use({ tables: { user_kanji_favorites: () => ({ data: [], error: null }) } });
    await expect(listKanjiFavorites()).resolves.toEqual([]);
  });
});
