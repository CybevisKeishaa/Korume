import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { readPreferences } from "@/lib/data/preferences";
import { REVIEW_FREQUENCY_MULTIPLIER, reviewItem } from "@/lib/srs";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/preferences", () => ({ readPreferences: vi.fn() }));
vi.mock("@/lib/data/gamification", () => ({ recordActivity: vi.fn().mockResolvedValue(undefined) }));
// Spread the real module so INITIAL_STATE and REVIEW_FREQUENCY_MULTIPLIER stay the
// ones in sm2.ts. Restating them here would make the assertion below check the mock
// against itself.
vi.mock("@/lib/srs", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/srs")>()),
  reviewItem: vi.fn(() => ({
    repetitions: 3,
    intervalDays: 35,
    easeFactor: 2.5,
    nextReviewAt: new Date("2026-09-23T00:00:00Z"),
    lastReviewedAt: new Date("2026-09-22T00:00:00Z"),
  })),
}));

import { submitReview } from "./srs";

const PREFERENCES = { ...DEFAULT_PREFERENCES, reviewFrequency: "relaxed" as const };

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(readPreferences).mockResolvedValue(PREFERENCES);
  vi.mocked(reviewItem).mockClear();
});

describe("submitReview preferences", () => {
  it("passes the relaxed interval multiplier to the shared SRS engine", async () => {
    const supabase = createMockSupabase({
      user: { id: "u1" },
      tables: { user_kanji_progress: () => ({ data: { srs_stage: 2, interval_days: 10, ease_factor: 2.5 }, error: null }) },
    });
    vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);

    await submitReview({ itemType: "kanji", itemId: "k1", quality: 4 }, new Date("2026-09-22T00:00:00Z"));

    expect(reviewItem).toHaveBeenCalledWith(expect.anything(), 4, expect.any(Date), REVIEW_FREQUENCY_MULTIPLIER.relaxed);
  });
});
