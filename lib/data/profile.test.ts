import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, type MockResult, type QueryCall, type RpcResolver } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { getStudyTimezone } from "@/lib/time/study-timezone";
import { getStreak } from "@/lib/data/streak";
import { getStudyTime, getTrackedSince } from "@/lib/data/study-time";
import { readPreferences } from "@/lib/data/preferences";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import { MASTERY_THRESHOLD } from "@/lib/data/difficulty";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/time/study-timezone", () => ({ getStudyTimezone: vi.fn() }));
vi.mock("@/lib/data/streak", () => ({ getStreak: vi.fn() }));
vi.mock("@/lib/data/study-time", () => ({ getStudyTime: vi.fn(), getTrackedSince: vi.fn() }));
vi.mock("@/lib/data/preferences", () => ({ readPreferences: vi.fn() }));
vi.mock("@/lib/profile/avatar-url", () => ({ resolveAvatarUrl: vi.fn() }));

import { getProfile } from "./profile";

const USER = { id: "u1" };
const ok = (data: unknown): MockResult => ({ data, error: null });

const USER_ROW = {
  name: "Keishaa", email: "k@example.com", username: "keishaa", bio: "hi", country: "VN", native_language: "vi",
  target_jlpt_level: "N3", learning_goal: "anime", preferred_practices: ["kanji"], avatar_url: "https://x/a.png",
  avatar_path: null, created_at: "2026-01-01T00:00:00+00:00", daily_minutes: 20, level: "N5",
};

function rig(over: Record<string, RpcResolver> = {}, memoryRow: unknown = { occurred_at: "2026-05-01T00:00:00+00:00" }) {
  const calls: { name: string; args: unknown }[] = [];
  const memoryCalls: QueryCall[][] = [];
  const track = (name: string, result: unknown): RpcResolver => (args) => { calls.push({ name, args }); return ok(result); };
  const rpcs: Record<string, RpcResolver> = {
    first_known_learning_at: track("first_known_learning_at", "2025-03-01T10:00:00+00:00"),
    profile_counts: track("profile_counts", [{ video_lessons_completed: 3 }]),
    current_mastered_count: track("current_mastered_count", 40),
    profile_journey: track("profile_journey", [{ kind: "first_activity", at: "2025-03-01T10:00:00+00:00", label: null }]),
    favorite_lesson_sources: track("favorite_lesson_sources", [{ slug: "anime", lessons: 3 }, { slug: "nhk", lessons: 2 }]),
    todays_memory: track("todays_memory", [{ id: "m1", line_text_jp: "こんにちは", title: null, occurred_at: "2026-04-01T00:00:00+00:00" }]),
    ...over,
  };
  const supabase = createMockSupabase({
    user: USER,
    rpcs,
    tables: {
      users: () => ok(USER_ROW),
      user_stats: () => ok({ xp: 350 }),
      user_badges: () => ok([{ earned_at: "2026-02-01T00:00:00+00:00", badges: { id: "b1", name: "Streak", icon_url: null } }]),
      companion_memories: (c) => { memoryCalls.push(c); return ok(memoryRow); },
    },
  });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return { calls, memoryCalls };
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(resolveAvatarUrl).mockReset();
  vi.mocked(resolveAvatarUrl).mockImplementation(async ({ avatarUrl }) => avatarUrl);
  vi.mocked(getStudyTimezone).mockResolvedValue({ timeZone: "Asia/Tokyo", needsDetection: false });
  vi.mocked(readPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES, companionEnabled: true, readingTranslation: "reveal", readingFurigana: "hidden" });
  vi.mocked(getStreak).mockResolvedValue({ current: 5, longest: 9, lastActiveDate: "2026-10-06" });
  vi.mocked(getStudyTime).mockResolvedValue({ totalSeconds: 7200, days: [] });
  vi.mocked(getTrackedSince).mockResolvedValue("2026-09-01T00:00:00.000Z");
});

describe("getProfile", () => {
  it("returns 401 when signed out", async () => {
    vi.mocked(createClient).mockReturnValue(
      createMockSupabase({ user: null, tables: {} }) as unknown as ReturnType<typeof createClient>,
    );
    expect(await getProfile()).toEqual({ ok: false, status: 401 });
  });

  it("calls every RPC with the right arguments", async () => {
    const { calls } = rig();
    const result = await getProfile();
    expect(result.ok).toBe(true);
    const args = (name: string) => calls.find((c) => c.name === name)?.args;
    expect(args("profile_counts")).toEqual({ p_mastery: MASTERY_THRESHOLD });
    expect(args("current_mastered_count")).toEqual({ p_mastery: MASTERY_THRESHOLD });
    expect(args("profile_journey")).toEqual({ p_limit: 20, p_include_companion: true });
    expect(args("favorite_lesson_sources")).toEqual({ p_min_total: 3, p_min_per_source: 2, p_limit: 6 });
    expect(args("todays_memory")).toEqual({ p_tz: "Asia/Tokyo" });
    expect(getStudyTime).toHaveBeenCalledWith(new Date(0), expect.any(Date));
  });

  it("maps identity and stats; level comes from XP, never from users.level", async () => {
    rig();
    const result = await getProfile();
    if (!result.ok) throw new Error("expected ok");
    const { identity, stats, achievements, favoriteSources, korumeship, todaysMemory } = result.data;
    expect(identity).toMatchObject({
      displayName: "Keishaa", username: "keishaa", timeZone: "Asia/Tokyo", avatarUrl: "https://x/a.png",
      hasUploadedAvatar: false, accountCreatedAt: "2026-01-01T00:00:00.000Z", firstKnownLearningAt: "2025-03-01T10:00:00.000Z",
      subtitle: { translation: "reveal", furigana: "hidden" }, dailyMinutes: 20, companionEnabled: true,
    });
    expect(stats).toEqual({
      streakCurrent: 5, level: 3, totalXp: 350, videoLessonsCompleted: 3, wordsLearned: 40,
      studySeconds: 7200, trackedSince: "2026-09-01T00:00:00.000Z",
    });
    expect(achievements).toEqual([{ id: "b1", name: "Streak", iconUrl: null, earnedAt: "2026-02-01T00:00:00.000Z" }]);
    expect(favoriteSources).toEqual(["anime", "nhk"]);
    expect(korumeship).toEqual({ since: "2026-05-01T00:00:00.000Z" });
    expect(todaysMemory).toEqual({ id: "m1", lineTextJp: "こんにちは", title: null, occurredAt: "2026-04-01T00:00:00.000Z" });
  });

  it("identity.avatarUrl is whatever the resolver returns for the stored path and OAuth picture", async () => {
    vi.mocked(resolveAvatarUrl).mockResolvedValue("https://signed/me.webp");
    rig();
    const result = await getProfile();
    if (!result.ok) throw new Error("expected ok");
    expect(resolveAvatarUrl).toHaveBeenCalledWith({ avatarPath: null, avatarUrl: "https://x/a.png" });
    expect(result.data.identity.avatarUrl).toBe("https://signed/me.webp");
  });

  it("favoriteSources is null when the RPC returns no rows", async () => {
    rig({ favorite_lesson_sources: () => ok([]) });
    const result = await getProfile();
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.favoriteSources).toBeNull();
  });

  it("korumeship.since is null when there is no first_meeting memory", async () => {
    rig({}, null);
    const result = await getProfile();
    if (!result.ok) throw new Error("expected ok");
    expect(result.data.korumeship).toEqual({ since: null });
  });

  it("scopes the first_meeting read to the caller", async () => {
    const { memoryCalls } = rig();
    await getProfile();
    expect(memoryCalls).toHaveLength(1);
    expect(eqValue(memoryCalls[0] ?? [], "user_id")).toBe("u1");
    expect(eqValue(memoryCalls[0] ?? [], "memory_type")).toBe("first_meeting");
  });

  it("with Korume off: no todays_memory call, no korumeship, no companion journey, no todaysMemory", async () => {
    vi.mocked(readPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES, companionEnabled: false });
    const { calls } = rig();
    const result = await getProfile();
    if (!result.ok) throw new Error("expected ok");
    expect(calls.some((c) => c.name === "todays_memory")).toBe(false);
    expect(calls.find((c) => c.name === "profile_journey")?.args).toEqual({ p_limit: 20, p_include_companion: false });
    expect(result.data.korumeship).toBeNull();
    expect(result.data.todaysMemory).toBeNull();
  });

  it("survives a JSON round-trip unchanged (RSC props are plain data)", async () => {
    rig();
    const result = await getProfile();
    if (!result.ok) throw new Error("expected ok");
    expect(JSON.parse(JSON.stringify(result.data))).toEqual(result.data);
    expect(() => structuredClone(result.data)).not.toThrow();
  });
});
