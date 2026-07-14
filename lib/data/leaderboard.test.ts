import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import { getLeaderboard, setLeaderboardOptIn } from "./leaderboard";

const USER = { id: "u1" };
const OTHER_A = { id: "u2" };
const OTHER_B = { id: "u3" };
const NOW = new Date("2026-01-07T10:00:00.000Z"); // a Wednesday, VN-local

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

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createServiceClient).mockReset();
});

describe("getLeaderboard", () => {
  it("returns 401 when signed out", async () => {
    mockClient({}, null);
    expect(await getLeaderboard(NOW)).toEqual({ ok: false, status: 401 });
  });

  it("filters xp_events by the VN-local Monday week start", async () => {
    mockClient({});
    let gteValue: unknown;
    mockService({
      xp_events: (calls: QueryCall[]) => {
        gteValue = calls.find((c): c is Extract<QueryCall, { op: "gte" }> => c.op === "gte")?.value;
        return { data: [], error: null };
      },
      users: () => ({ data: [], error: null }),
    });

    await getLeaderboard(NOW);
    expect(gteValue).toBe("2026-01-04T17:00:00.000Z"); // Monday 2026-01-05 00:00 VN-local
  });

  it("ranks opted-in users by summed weekly XP, caps at 20, and flags isMe", async () => {
    mockClient({});
    mockService({
      xp_events: () => ({
        data: [
          { user_id: USER.id, xp: 10 },
          { user_id: USER.id, xp: 5 },
          { user_id: OTHER_A.id, xp: 50 },
          { user_id: OTHER_B.id, xp: 1 },
        ],
        error: null,
      }),
      users: () => ({
        data: [
          { id: USER.id, name: "Me", avatar_url: null },
          { id: OTHER_A.id, name: "Top", avatar_url: null },
          { id: OTHER_B.id, name: "Low", avatar_url: null },
        ],
        error: null,
      }),
    });

    const result = await getLeaderboard(NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.leaderboard).toEqual([
      { rank: 1, name: "Top", avatarUrl: null, weeklyXp: 50, isMe: false },
      { rank: 2, name: "Me", avatarUrl: null, weeklyXp: 15, isMe: true },
      { rank: 3, name: "Low", avatarUrl: null, weeklyXp: 1, isMe: false },
    ]);
    expect(result.data.callerWeeklyXp).toBe(15);
    expect(result.data.callerRank).toBe(2);
  });

  it("gives the caller their own weekly XP even when not opted in, with a null rank", async () => {
    mockClient({});
    mockService({
      xp_events: () => ({ data: [{ user_id: USER.id, xp: 30 }, { user_id: OTHER_A.id, xp: 5 }], error: null }),
      // Caller is NOT in the opted-in set.
      users: () => ({ data: [{ id: OTHER_A.id, name: "Top", avatar_url: null }], error: null }),
    });

    const result = await getLeaderboard(NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.callerWeeklyXp).toBe(30);
    expect(result.data.callerRank).toBeNull();
    expect(result.data.leaderboard.every((e) => !e.isMe)).toBe(true);
  });

  it("caps the returned leaderboard at 20 entries", async () => {
    const xpRows = Array.from({ length: 25 }, (_, i) => ({ user_id: `user-${i}`, xp: 25 - i }));
    const userRows = xpRows.map((r) => ({ id: r.user_id, name: r.user_id, avatar_url: null }));
    mockClient({}, { id: "someone-else" });
    mockService({
      xp_events: () => ({ data: xpRows, error: null }),
      users: () => ({ data: userRows, error: null }),
    });

    const result = await getLeaderboard(NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.leaderboard).toHaveLength(20);
    expect(result.data.leaderboard[0]?.weeklyXp).toBe(25);
  });
});

describe("setLeaderboardOptIn", () => {
  it("returns 401 when signed out", async () => {
    mockClient({}, null);
    expect(await setLeaderboardOptIn({ optIn: true })).toEqual({ ok: false, status: 401 });
  });

  it("updates leaderboard_opt_in scoped to the caller", async () => {
    mockClient({
      users: (calls: QueryCall[]) => {
        expect(calls.some((c) => c.op === "eq" && c.column === "id" && c.value === USER.id)).toBe(true);
        const updateCall = calls.find((c): c is Extract<QueryCall, { op: "update" }> => c.op === "update");
        expect(updateCall?.values).toEqual({ leaderboard_opt_in: true });
        return { data: null, error: null };
      },
    });
    const result = await setLeaderboardOptIn({ optIn: true });
    expect(result).toEqual({ ok: true, data: { optIn: true } });
  });

  it("returns 429 when over the rate limit", async () => {
    mockClient({ users: () => ({ data: null, error: null }) });
    const key = `leaderboard:opt-in:${USER.id}`;
    const { rateLimit } = await import("@/lib/rate-limit");
    for (let i = 0; i < 50; i++) rateLimit(key, { limit: 10, windowMs: 60_000 });

    const result = await setLeaderboardOptIn({ optIn: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(429);
  });
});
