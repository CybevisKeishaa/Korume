import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { ensureDailyMission, claimActiveMission } from "@/lib/data/missions";
import { getReviewSummary } from "./review";

type CachedFunction = (...args: never[]) => unknown;
let entries = new WeakMap<CachedFunction, Map<unknown, unknown>>();
const noArguments = Symbol("no arguments");

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/missions", () => ({ ensureDailyMission: vi.fn(), claimActiveMission: vi.fn() }));
vi.mock("./review", () => ({ getReviewSummary: vi.fn() }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T): T => ((...args: never[]) => {
      const key = args[0] ?? noArguments;
      const calls = entries.get(fn as CachedFunction) ?? new Map<unknown, unknown>();
      entries.set(fn as CachedFunction, calls);
      if (!calls.has(key)) calls.set(key, fn(...args));
      return calls.get(key);
    }) as T,
  };
});
vi.mock("./context", () => ({ getDashboardContext: vi.fn().mockResolvedValue({ userId: "u1" }) }));

import { getDailyMission } from "./mission";

beforeEach(() => { entries = new WeakMap(); vi.clearAllMocks(); });

describe("getDailyMission", () => {
  it("sweeps then maps ordered progress with lesson titles", async () => {
    vi.mocked(ensureDailyMission).mockResolvedValue("m1");
    vi.mocked(claimActiveMission).mockResolvedValue();
    vi.mocked(getReviewSummary).mockResolvedValue({ href: "/mining/review", due: 2 });
    const rpc = vi.fn().mockResolvedValue({ data: [
        { item_id: "i1", slot: 1, type: "review", video_id: null, target: 3, current: 1 },
        { item_id: "i2", slot: 2, type: "finish_lesson", video_id: "v1", target: 1, current: 0 },
        { item_id: "i3", slot: 3, type: "dictation_lines", video_id: "v1", target: 5, current: 1 },
      ], error: null });
    const from = vi.fn((table: string) => table === "daily_missions"
        ? { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { rewarded_at: null }, error: null }) }) }) }
        : { select: () => ({ in: () => Promise.resolve({ data: [{ id: "v1", title: "Café", duration_seconds: 300, last_watched_position: 240 }], error: null }) }) });
    vi.mocked(createClient).mockReturnValue({ rpc, from } as never);

    const expected = { kind: "ok", data: { rewarded: false, items: [
      { type: "review", current: 1, target: 3, title: null, href: "/mining/review", playbackPercent: null },
      { type: "finish_lesson", current: 0, target: 1, title: "Café", href: "/shadowing/v1", playbackPercent: 80 },
      { type: "dictation_lines", current: 1, target: 5, title: "Café", href: "/shadowing/v1/dictation", playbackPercent: null },
    ] } };
    await expect(Promise.all([getDailyMission(), getDailyMission()])).resolves.toEqual([expected, expected]);
    expect(ensureDailyMission).toHaveBeenCalledOnce();
    expect(claimActiveMission).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("returns unavailable when the mission cycle cannot be created", async () => {
    vi.mocked(ensureDailyMission).mockResolvedValue(null);

    await expect(getDailyMission()).resolves.toEqual({ kind: "unavailable" });
    expect(claimActiveMission).not.toHaveBeenCalled();
  });
});
