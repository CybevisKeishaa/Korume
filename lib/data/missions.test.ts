import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { MISSION_TARGETS } from "@/lib/dashboard/missions";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import { ensureDailyMission } from "./missions";

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
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    install({ ensure: () => ({ data: null, error: { message: "boom" } }) });
    await expect(ensureDailyMission("u1")).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("\"event\":\"mission_ensure_failed\""));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("boom"));
    log.mockRestore();
  });
});
