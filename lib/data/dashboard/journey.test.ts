import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), cache: (fn: unknown) => fn }));

import { getCurriculumJourney, getCurriculumPlacement } from "./journey";

beforeEach(() => vi.clearAllMocks());

function mockClient() {
  const supabase = createMockSupabase({
    tables: {},
    rpcs: {
      curriculum_journey: () => ({
        data: [
          {
            level: "N5",
            collection_title: "N5 Foundations",
            core_total: 2,
            core_completed: 1,
            next_video_id: "video-1",
            next_title: "First lesson",
            next_position: 2,
            plus_total: 3,
            plus_accessible: 1,
          },
        ],
        error: null,
      }),
      curriculum_membership: (args) => ({
        data: args.p_video_id === "video-1" ? [{ collection_title: "N5 Foundations", lesson_position: 2 }] : [],
        error: null,
      }),
    },
  });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

describe("dashboard curriculum journey loader", () => {
  it("calls curriculum_journey and maps its snake_case RPC row", async () => {
    const supabase = mockClient();

    await expect(getCurriculumJourney()).resolves.toEqual({
      kind: "active",
      current: "N5",
      next: { videoId: "video-1", title: "First lesson" },
      remaining: 1,
      plus: { total: 3, accessible: 1 },
      nodes: [
        { level: "N5", state: "current", percent: 50 },
        { level: "N4", state: "unavailable", percent: null },
        { level: "N3", state: "unavailable", percent: null },
      ],
    });
    expect(supabase.rpcCalls?.map((call) => call.name)).toEqual(["curriculum_journey"]);
  });

  it("calls curriculum_membership with the video id and returns null without a curriculum row", async () => {
    const supabase = mockClient();

    await expect(getCurriculumPlacement("video-1")).resolves.toEqual({ title: "N5 Foundations", position: 2 });
    await expect(getCurriculumPlacement("outside-curriculum")).resolves.toBeNull();
    expect(supabase.rpcCalls).toEqual([
      { name: "curriculum_membership", args: { p_video_id: "video-1" } },
      { name: "curriculum_membership", args: { p_video_id: "outside-curriculum" } },
    ]);
  });
});
