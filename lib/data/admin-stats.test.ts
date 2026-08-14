import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin/guard";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: vi.fn() }));

// Imported after the mocks above are registered.
import { getAdminStats } from "./admin-stats";

const ADMIN = { id: "admin-1", email: "admin@example.com" };
const NOW = new Date("2026-07-14T00:00:00Z");

function daysAgoIso(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function mockService(tables: Parameters<typeof createMockSupabase>[0]["tables"]) {
  const supabase = createMockSupabase({ tables });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
  return supabase;
}

beforeEach(() => {
  vi.mocked(createServiceClient).mockReset();
  vi.mocked(requireAdmin).mockReset();
  vi.mocked(requireAdmin).mockResolvedValue({ ok: true, user: ADMIN });
});

describe("getAdminStats", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const result = await getAdminStats(NOW);
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("computes user/content/activity/retention stats from the underlying tables", async () => {
    const allUsers = [{ id: "u1" }, { id: "u2" }, { id: "u3" }, { id: "u4" }];
    const cohortUser = { id: "u-cohort", created_at: daysAgoIso(45) };

    mockService({
      users: (calls: QueryCall[]) => {
        const gte = calls.find((c): c is Extract<QueryCall, { op: "gte" }> => c.op === "gte");
        const lt = calls.find((c): c is Extract<QueryCall, { op: "lt" }> => c.op === "lt");
        if (gte && lt) {
          // 30-60 day cohort query.
          return { data: [cohortUser], error: null };
        }
        if (gte && gte.value === daysAgoIso(7)) {
          return { data: [allUsers[0]], error: null }; // newUsers7d
        }
        if (gte && gte.value === daysAgoIso(30)) {
          return { data: [allUsers[0], allUsers[1]], error: null }; // newUsers30d
        }
        return { data: allUsers, error: null }; // totalUsers
      },
      xp_events: (calls: QueryCall[]) => {
        const gte = calls.find((c): c is Extract<QueryCall, { op: "gte" }> => c.op === "gte");
        const inCall = calls.find((c): c is Extract<QueryCall, { op: "in" }> => c.op === "in");
        const selectCall = calls.find((c): c is Extract<QueryCall, { op: "select" }> => c.op === "select");
        if (inCall) {
          // retention cohort activity check
          return { data: [{ user_id: "u-cohort" }], error: null };
        }
        if (selectCall?.columns === "source_type") {
          return {
            data: [{ source_type: "shadowing" }, { source_type: "shadowing" }, { source_type: "srs_review" }],
            error: null,
          };
        }
        if (gte && gte.value === daysAgoIso(7)) {
          return { data: [{ user_id: "u1" }, { user_id: "u2" }], error: null }; // activeUsers7d
        }
        return { data: [{ user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }], error: null }; // activeUsers30d
      },
      videos: () => ({
        data: [
          { library_access: "PRIVATE" },
          { library_access: "FREE" },
          { library_access: "PLUS" },
        ],
        error: null,
      }),
      kanji: () => ({ data: [{ id: "k1" }], error: null }),
      vocab: () => ({ data: [{ id: "v1" }, { id: "v2" }], error: null }),
      grammar_points: () => ({ data: [], error: null }),
      certification_tests: () => ({ data: [{ id: "t1" }], error: null }),
      reading_passages: () => ({ data: [{ id: "p1" }], error: null }),
    });

    const result = await getAdminStats(NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.totalUsers).toBe(4);
    expect(result.data.newUsers7d).toBe(1);
    expect(result.data.newUsers30d).toBe(2);
    expect(result.data.activeUsers7d).toBe(2);
    expect(result.data.activeUsers30d).toBe(3);
    expect(result.data.retention).toEqual({
      cohortSize: 1,
      activeCount: 1,
      retentionPercent: 100,
      methodology:
        "Users whose account was created 30-60 days ago; percent with at least one xp_event in the last 7 days.",
    });
    expect(result.data.contentCounts).toEqual({
      videosPending: 1,
      videosApproved: 2,
      kanji: 1,
      vocab: 2,
      grammar: 0,
      jlptTests: 1,
      readingPassages: 1,
    });
    expect(result.data.topActivity).toEqual([
      { sourceType: "shadowing", count: 2 },
      { sourceType: "srs_review", count: 1 },
    ]);
    expect(result.data.generatedAt).toBe(NOW.toISOString());
  });

  it("returns retentionPercent: null when the 30-60d cohort is empty", async () => {
    mockService({
      users: () => ({ data: [], error: null }),
      xp_events: (calls: QueryCall[]) => {
        const selectCall = calls.find((c): c is Extract<QueryCall, { op: "select" }> => c.op === "select");
        if (selectCall?.columns === "source_type") return { data: [], error: null };
        return { data: [], error: null };
      },
      videos: () => ({ data: [], error: null }),
      kanji: () => ({ data: [], error: null }),
      vocab: () => ({ data: [], error: null }),
      grammar_points: () => ({ data: [], error: null }),
      certification_tests: () => ({ data: [], error: null }),
      reading_passages: () => ({ data: [], error: null }),
    });

    const result = await getAdminStats(NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.retention.cohortSize).toBe(0);
    expect(result.data.retention.retentionPercent).toBeNull();
  });
});
