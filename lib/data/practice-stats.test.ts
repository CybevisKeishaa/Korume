import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { REVIEW_DICTATION_BELOW, REVIEW_PRONUNCIATION_BELOW } from "@/lib/summary/thresholds";
import { loadPracticeStats } from "./practice-stats";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const VIDEO = "11111111-1111-4111-8111-111111111111";
const getUser = vi.fn();
const rpc = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "learner" } }, error: null });
  vi.mocked(createClient).mockReturnValue({ auth: { getUser }, rpc } as unknown as ReturnType<typeof createClient>);
});

describe("loadPracticeStats", () => {
  it("authenticates before the single aggregate RPC and maps numeric strings to rounded line scores", async () => {
    rpc.mockResolvedValue({ data: {
      lineCount: "194", scoredLines: "2", mean: "70.5",
      lines: [
        { lineId: "line-a", state: "scored", score: "84.5" },
        { lineId: "line-b", state: "needs_review", score: "56.4" },
        { lineId: "line-c", state: "unscored", score: null },
        { lineId: "line-d", state: "unscored", score: "84.5" },
      ],
    }, error: null });

    await expect(loadPracticeStats(VIDEO, "pronunciation")).resolves.toEqual({ ok: true, data: {
      lineCount: 194, scoredLines: 2, mean: 71,
      lines: {
        "line-a": { state: "scored", score: 85 },
        "line-b": { state: "needs_review", score: 56 },
        "line-c": { state: "unscored", score: null },
        "line-d": { state: "unscored", score: 85 },
      },
    } });
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("practice_stats", {
      p_video: VIDEO, p_mode: "pronunciation", p_review_below: REVIEW_PRONUNCIATION_BELOW,
    });
    expect(getUser.mock.invocationCallOrder[0] ?? Infinity).toBeLessThan(rpc.mock.invocationCallOrder[0] ?? 0);
  });

  it.each([["word_bank"], ["typing"]] as const)(
    "Listening %s reads its own format with the one Listening review cut and parses revealed", async (mode) => {
      rpc.mockResolvedValue({ data: {
        lineCount: 3, scoredLines: 1, mean: 90,
        lines: [{ lineId: "line-a", state: "revealed", score: "90" }, { lineId: "line-b", state: "scored", score: 90 }],
      }, error: null });
      await expect(loadPracticeStats(VIDEO, mode)).resolves.toEqual({ ok: true, data: {
        lineCount: 3, scoredLines: 1, mean: 90,
        lines: { "line-a": { state: "revealed", score: 90 }, "line-b": { state: "scored", score: 90 } },
      } });
      expect(REVIEW_DICTATION_BELOW).toBe(80);
      expect(rpc).toHaveBeenCalledWith("practice_stats", { p_video: VIDEO, p_mode: mode, p_review_below: REVIEW_DICTATION_BELOW });
    },
  );

  it("refuses an unknown mode before the RPC (a null p_mode would read pronunciation, R11)", async () => {
    await expect(loadPracticeStats(VIDEO, "listening" as never)).rejects.toThrow();
    await expect(loadPracticeStats(VIDEO, null as never)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("preserves the null mean and zero counts of an unknown or RLS-inaccessible lesson", async () => {
    rpc.mockResolvedValue({ data: { lineCount: 0, scoredLines: 0, mean: null, lines: [] }, error: null });
    await expect(loadPracticeStats(VIDEO, "pronunciation")).resolves.toEqual({
      ok: true, data: { lineCount: 0, scoredLines: 0, mean: null, lines: {} },
    });
  });

  it("returns 401 without executing the RPC when the session is missing", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(loadPracticeStats(VIDEO, "pronunciation")).resolves.toEqual({ ok: false, status: 401 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces RPC failures rather than inventing empty stats", async () => {
    const error = { message: "database unavailable" };
    rpc.mockResolvedValue({ data: null, error });
    await expect(loadPracticeStats(VIDEO, "pronunciation")).rejects.toBe(error);
  });

  it("rejects an invalid aggregate payload", async () => {
    rpc.mockResolvedValue({ data: { lineCount: "invalid", scoredLines: 0, mean: null, lines: [] }, error: null });
    await expect(loadPracticeStats(VIDEO, "pronunciation")).rejects.toThrow();
  });
});
