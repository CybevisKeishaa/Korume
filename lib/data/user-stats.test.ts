import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
// getReviewQueue has its own dependencies (kanji/vocab lists + progress) and
// its own tests (lib/data/srs.test.ts) — mock it here so this file only
// exercises the stats/badge aggregation, matching the isolation precedent in
// lib/data/jlpt.test.ts (which mocks recordActivity for the same reason).
vi.mock("@/lib/data/srs", () => ({ getReviewQueue: vi.fn() }));

import { getUserStats } from "./user-stats";
import { getReviewQueue } from "@/lib/data/srs";
import type { ReviewItem } from "@/lib/learning-types";

const USER = { id: "u1" };

function mockClient(tables: Parameters<typeof createMockSupabase>[0]["tables"], user: { id: string } | null = USER) {
  const supabase = createMockSupabase({ user, tables });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

const item = (id: string): ReviewItem => ({ id, front: id, back: id });

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(getReviewQueue).mockReset();
});

describe("getUserStats", () => {
  it("returns 401 when signed out", async () => {
    mockClient({}, null);
    const result = await getUserStats();
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("returns zeroed stats when the user has no user_stats row yet", async () => {
    mockClient({
      user_stats: () => ({ data: null, error: null }),
      badges: () => ({ data: [], error: null }),
      user_badges: () => ({ data: [], error: null }),
    });
    vi.mocked(getReviewQueue).mockResolvedValue([]);

    const result = await getUserStats();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.xp).toBe(0);
    expect(result.data.level.level).toBe(1);
    expect(result.data.streakCurrent).toBe(0);
    expect(result.data.streakLongest).toBe(0);
    expect(result.data.lastActiveDate).toBeNull();
    expect(result.data.badges).toEqual([]);
    expect(result.data.srsDueCount).toBe(0);
  });

  it("computes level from xp and returns streak fields", async () => {
    mockClient({
      user_stats: () => ({
        data: { xp: 350, streak_current: 5, streak_longest: 9, last_active_date: "2026-07-10" },
        error: null,
      }),
      badges: () => ({ data: [], error: null }),
      user_badges: () => ({ data: [], error: null }),
    });
    vi.mocked(getReviewQueue).mockResolvedValue([]);

    const result = await getUserStats();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.xp).toBe(350);
    expect(result.data.level.level).toBe(3); // thresholdForLevel(3) === 300
    expect(result.data.streakCurrent).toBe(5);
    expect(result.data.streakLongest).toBe(9);
    expect(result.data.lastActiveDate).toBe("2026-07-10");
  });

  it("joins the badge catalog with earned state, earned first then alphabetical", async () => {
    mockClient({
      user_stats: () => ({
        data: { xp: 0, streak_current: 0, streak_longest: 0, last_active_date: null },
        error: null,
      }),
      badges: () => ({
        data: [
          { id: "b-zeta", name: "zeta", description: "Z badge", icon_url: null },
          { id: "b-alpha", name: "alpha", description: "A badge", icon_url: "icon.png" },
          { id: "b-mid", name: "mid", description: null, icon_url: null },
        ],
        error: null,
      }),
      user_badges: () => ({ data: [{ badge_id: "b-mid", earned_at: "2026-07-01T00:00:00Z" }], error: null }),
    });
    vi.mocked(getReviewQueue).mockResolvedValue([]);

    const result = await getUserStats();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.badges.map((b) => b.id)).toEqual(["b-mid", "b-alpha", "b-zeta"]);
    expect(result.data.badges[0]).toEqual({
      id: "b-mid",
      name: "mid",
      description: null,
      iconUrl: null,
      earnedAt: "2026-07-01T00:00:00Z",
    });
    expect(result.data.badges[1]?.earnedAt).toBeNull();
  });

  it("sums the vocab and kanji due-queue lengths for srsDueCount", async () => {
    mockClient({
      user_stats: () => ({
        data: { xp: 0, streak_current: 0, streak_longest: 0, last_active_date: null },
        error: null,
      }),
      badges: () => ({ data: [], error: null }),
      user_badges: () => ({ data: [], error: null }),
    });
    vi.mocked(getReviewQueue).mockImplementation(async (itemType: string) =>
      itemType === "vocab" ? [item("v1"), item("v2")] : [item("k1")],
    );

    const result = await getUserStats();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.srsDueCount).toBe(3);
  });
});
