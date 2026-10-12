import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { MISSION_TARGETS } from "@/lib/dashboard/missions";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/data/xp-award", () => ({ afterXpAward: vi.fn().mockResolvedValue({ newBadges: [], leveledUp: false }) }));

import { afterXpAward } from "@/lib/data/xp-award";
import { claimActiveMission, ensureDailyMission } from "./missions";

type Result = { data: unknown; error: { message: string } | null };

function install(options: { active?: unknown; ensure?: () => Result; inProgress?: unknown }) {
  const ensureCalls: unknown[] = [];
  vi.mocked(createClient).mockReturnValue(createMockSupabase({
    tables: {
      daily_missions: () => ({ data: options.active ?? null, error: null }),
      learner_videos: () => ({ data: options.inProgress ?? null, error: null }),
      transcript_lines: () => ({ data: [{ id: "l1" }, { id: "l2" }], error: null }),
    },
    rpcs: {
      practice_activity: () => ({ data: [], error: null }),
      current_transcript_id: () => ({ data: "t1", error: null }),
    },
  }) as unknown as ReturnType<typeof createClient>);
  vi.mocked(createServiceClient).mockReturnValue(createMockSupabase({
    tables: {},
    rpcs: { ensure_daily_mission: (args) => { ensureCalls.push(args); return options.ensure?.() ?? { data: "m-new", error: null }; } },
  }) as unknown as ReturnType<typeof createServiceClient>);
  return ensureCalls;
}

beforeEach(() => vi.clearAllMocks());

describe("ensureDailyMission (spec M1/M2)", () => {
  it("returns the active cycle without calling the SQL authority", async () => {
    const ensureCalls = install({ active: { id: "m-active" } });
    await expect(ensureDailyMission("u1")).resolves.toBe("m-active");
    expect(ensureCalls).toEqual([]);
  });

  it("asks SQL with the exposed review decks, the targets and the ranked hints", async () => {
    const ensureCalls = install({ inProgress: { id: "v1" } });
    await expect(ensureDailyMission("u1")).resolves.toBe("m-new");
    expect(ensureCalls).toEqual([{
      p_user: "u1",
      p_review_decks: ["mining", "kanji"],
      p_targets: MISSION_TARGETS,
      p_hints: [
        { type: "finish_lesson", videoId: "v1" },
        { type: "shadow_lines", videoId: "v1" },
        { type: "dictation_lines", videoId: "v1" },
      ],
    }]);
  });

  it("never throws: an RPC error is logged as mission_ensure_failed with its message and returns null", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    install({ ensure: () => ({ data: null, error: { message: "boom" } }) });
    await expect(ensureDailyMission("u1")).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("\"event\":\"mission_ensure_failed\""));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("boom"));
    log.mockRestore();
  });
});

describe("claimActiveMission (spec M4)", () => {
  function installClaims(open: { id: string }[], claim: (args: Record<string, unknown>) => Result) {
    const claims: unknown[] = [];
    vi.mocked(createServiceClient).mockReturnValue(createMockSupabase({
      tables: { daily_missions: () => ({ data: open, error: null }) },
      rpcs: { claim_daily_mission: (args) => { claims.push(args); return claim(args as Record<string, unknown>); } },
    }) as unknown as ReturnType<typeof createServiceClient>);
    return claims;
  }

  it("does nothing when no cycle is open", async () => {
    const claims = installClaims([], () => ({ data: [], error: null }));
    await claimActiveMission("u1");
    expect(claims).toEqual([]);
  });

  it("claims open cycles in window order with 50 XP and runs the award follow-up only for a real award", async () => {
    const claims = installClaims([{ id: "m-old" }, { id: "m-new" }], (args) => ({
      data: [args.p_mission_id === "m-old"
        ? { completed: true, xp_awarded: 50, prev_xp: 100, next_xp: 150 }
        : { completed: false, xp_awarded: 0, prev_xp: null, next_xp: null }],
      error: null,
    }));
    const now = new Date("2026-10-08T12:00:00Z");
    await claimActiveMission("u1", now);
    expect(claims).toEqual([
      { p_user: "u1", p_mission_id: "m-old", p_xp: 50 },
      { p_user: "u1", p_mission_id: "m-new", p_xp: 50 },
    ]);
    expect(afterXpAward).toHaveBeenCalledTimes(1);
    expect(afterXpAward).toHaveBeenCalledWith(expect.anything(), { userId: "u1", prevXp: 100, nextXp: 150, now });
  });

  it("logs mission_claim_failed and never throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    installClaims([{ id: "m1" }], () => ({ data: null, error: { message: "nope" } }));
    await expect(claimActiveMission("u1")).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("mission_claim_failed"));
    log.mockRestore();
  });
});
