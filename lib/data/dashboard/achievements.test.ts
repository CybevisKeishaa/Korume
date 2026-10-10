import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { buildBadgeSnapshot } from "@/lib/data/badge-snapshot";
import { getStreakFact } from "./facts";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/badge-snapshot", () => ({ buildBadgeSnapshot: vi.fn() }));
vi.mock("./facts", () => ({ getStreakFact: vi.fn() }));

import { getAchievementSnapshot } from "./achievements";

const context = {
  userId: "u1", name: "Keishaa", avatarUrl: null, timeZone: "Asia/Tokyo",
  now: new Date("2026-10-10T00:00:00Z"), today: "2026-10-10", createdAt: "2026-01-02T00:00:00.000Z",
  scheduleDays: [1, 2, 3, 4, 5] as const, companionEnabled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStreakFact).mockResolvedValue({ current: 4, longest: 9, lastActiveDate: "2026-10-10" });
  vi.mocked(buildBadgeSnapshot).mockResolvedValue({ totalXp: 120, streakCurrent: 4, kanjiLearned: 3, totalOutcomes: 3, outcomeCounts: {}, jlptMockLevelsCompleted: [] });
});

describe("getAchievementSnapshot", () => {
  it("shows newest earned badges first and the three closest meaningful progress badges", async () => {
    const supabase = createMockSupabase({
      tables: {
        user_stats: () => ({ data: { xp: 120 }, error: null }),
        badges: () => ({ data: [
          { id: "earned-old", name: "First", description: null, icon_url: null, criteria: { type: "xp", total: 1 } },
          { id: "earned-new", name: "Second", description: null, icon_url: "icon", criteria: { type: "xp", total: 2 } },
          { id: "near", name: "Five sessions", description: null, icon_url: null, criteria: { type: "sessions", count: 5 } },
          { id: "later", name: "Ten sessions", description: null, icon_url: null, criteria: { type: "sessions", count: 10 } },
          { id: "unsupported", name: "N5", description: null, icon_url: null, criteria: { type: "jlpt_mock", level: "N5" } },
        ], error: null }),
        user_badges: () => ({ data: [
          { badge_id: "earned-old", earned_at: "2026-01-01T00:00:00Z" },
          { badge_id: "earned-new", earned_at: "2026-02-01T00:00:00Z" },
        ], error: null }),
        kanji: () => ({ data: [{ id: "k1" }, { id: "k2" }, { id: "k3" }], error: null }),
      },
    });
    vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);

    await expect(getAchievementSnapshot(context)).resolves.toEqual({
      earned: [
        { id: "earned-new", name: "Second", description: null, iconUrl: "icon", earnedAt: "2026-02-01T00:00:00Z" },
        { id: "earned-old", name: "First", description: null, iconUrl: null, earnedAt: "2026-01-01T00:00:00Z" },
      ],
      inProgress: [
        { id: "near", name: "Five sessions", description: null, iconUrl: null, progress: { current: 3, target: 5, kind: "count" } },
      ],
    });
    expect(buildBadgeSnapshot).toHaveBeenCalledWith(expect.anything(), "u1", 120, 4);
  });
});
