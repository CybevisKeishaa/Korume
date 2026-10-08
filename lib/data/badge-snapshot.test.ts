import { describe, expect, it } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { buildBadgeSnapshot } from "./badge-snapshot";

describe("buildBadgeSnapshot (plan P1)", () => {
  it("never counts the daily mission reward as a learning outcome", async () => {
    const xpCalls: QueryCall[][] = [];
    const supabase = createMockSupabase({
      tables: {
        user_kanji_progress: () => ({ data: [], error: null }),
        xp_events: (calls) => { xpCalls.push(calls); return { data: [{ source_type: "srs_review" }], error: null }; },
        user_test_attempts: () => ({ data: [], error: null }),
      },
    });
    const snapshot = await buildBadgeSnapshot(supabase as never, "u1", 100, 2);
    expect(xpCalls[0]).toEqual(expect.arrayContaining([{ op: "neq", column: "source_type", value: "daily_mission_complete" }]));
    expect(snapshot).toMatchObject({ totalOutcomes: 1, outcomeCounts: { srs_review: 1 } });
  });
});
