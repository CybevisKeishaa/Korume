import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, hasCall, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { listNotifications, markNotificationsRead } from "./notifications";

const USER = { id: "u1" };

function mockClient(tables: Parameters<typeof createMockSupabase>[0]["tables"], user: { id: string } | null = USER) {
  const supabase = createMockSupabase({ user, tables });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

const ROW_1 = {
  id: "n1",
  type: "badge_earned",
  payload: { badgeId: "b1", badgeName: "First Steps" },
  read_at: null,
  created_at: "2026-07-14T00:00:00Z",
};
const ROW_2 = {
  id: "n2",
  type: "level_up",
  payload: { level: 3 },
  read_at: "2026-07-13T00:00:00Z",
  created_at: "2026-07-13T00:00:00Z",
};

beforeEach(() => {
  vi.mocked(createClient).mockReset();
});

describe("listNotifications", () => {
  it("returns 401 when signed out", async () => {
    mockClient({}, null);
    const result = await listNotifications({ limit: 20 });
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("lists notifications newest first, camelCased, plus unreadCount", async () => {
    mockClient({
      notifications: (calls: QueryCall[]) => {
        expect(eqValue(calls, "user_id")).toBe(USER.id);
        // Branch on whether this call is the unread-count scan (filters
        // read_at is null) or the paged list (has a limit).
        if (hasCall(calls, "is")) {
          return { data: [{ id: "n1" }], error: null };
        }
        expect(hasCall(calls, "limit")).toBe(true);
        return { data: [ROW_1, ROW_2], error: null };
      },
    });

    const result = await listNotifications({ limit: 20 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.notifications).toEqual([
      { id: "n1", type: "badge_earned", payload: { badgeId: "b1", badgeName: "First Steps" }, readAt: null, createdAt: "2026-07-14T00:00:00Z" },
      { id: "n2", type: "level_up", payload: { level: 3 }, readAt: "2026-07-13T00:00:00Z", createdAt: "2026-07-13T00:00:00Z" },
    ]);
    expect(result.data.unreadCount).toBe(1);
  });

  it("passes the requested limit through to the query", async () => {
    let sawLimit: number | undefined;
    mockClient({
      notifications: (calls: QueryCall[]) => {
        if (hasCall(calls, "is")) return { data: [], error: null };
        const limitCall = calls.find((c): c is Extract<QueryCall, { op: "limit" }> => c.op === "limit");
        sawLimit = limitCall?.count;
        return { data: [], error: null };
      },
    });

    await listNotifications({ limit: 5 });
    expect(sawLimit).toBe(5);
  });
});

describe("markNotificationsRead", () => {
  it("returns 401 when signed out", async () => {
    mockClient({}, null);
    const result = await markNotificationsRead({ all: true });
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("marks all unread notifications read when { all: true }", async () => {
    mockClient({
      notifications: (calls: QueryCall[]) => {
        expect(eqValue(calls, "user_id")).toBe(USER.id);
        expect(hasCall(calls, "is")).toBe(true);
        expect(hasCall(calls, "in")).toBe(false);
        return { data: [{ id: "n1" }, { id: "n2" }], error: null };
      },
    });

    const result = await markNotificationsRead({ all: true });
    expect(result).toEqual({ ok: true, data: { updated: 2 } });
  });

  it("marks only the given ids read", async () => {
    mockClient({
      notifications: (calls: QueryCall[]) => {
        expect(eqValue(calls, "user_id")).toBe(USER.id);
        const inCall = calls.find((c): c is Extract<QueryCall, { op: "in" }> => c.op === "in");
        expect(inCall?.values).toEqual(["n1"]);
        return { data: [{ id: "n1" }], error: null };
      },
    });

    const result = await markNotificationsRead({ ids: ["n1"] });
    expect(result).toEqual({ ok: true, data: { updated: 1 } });
  });

  it("returns 400 on a write error", async () => {
    mockClient({
      notifications: () => ({ data: null, error: { message: "boom" } }),
    });

    const result = await markNotificationsRead({ all: true });
    expect(result).toEqual({ ok: false, status: 400 });
  });

  it("returns 429 when the caller is over the rate limit", async () => {
    mockClient({
      notifications: () => ({ data: [], error: null }),
    });
    const key = `notifications:mark-read:${USER.id}`;
    const { rateLimit } = await import("@/lib/rate-limit");
    for (let i = 0; i < 100; i++) rateLimit(key, { limit: 30, windowMs: 60_000 });

    const result = await markNotificationsRead({ all: true });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(429);
  });
});
