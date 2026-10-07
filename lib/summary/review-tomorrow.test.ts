import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoadedSummary } from "./load-snapshot";

const mocks = vi.hoisted(() => ({
  authenticateSummary: vi.fn(),
  loadLessonSummary: vi.fn(),
  rateLimit: vi.fn(),
  getStudyTimezone: vi.fn(),
}));
vi.mock("@/lib/time/study-timezone", () => ({ getStudyTimezone: mocks.getStudyTimezone }));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("./load-snapshot", () => ({ authenticateSummary: mocks.authenticateSummary, loadLessonSummary: mocks.loadLessonSummary }));

import { scheduleReviewTomorrow } from "./review-tomorrow";

const VIDEO_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const loadedSummary = (reviewTargets: LoadedSummary["snapshot"]["reviewTargets"]): LoadedSummary => ({
  userId: USER_ID,
  video: { id: VIDEO_ID, youtubeVideoId: "youtube-id", title: "Lesson", thumbnailUrl: null, jlptLevel: null, durationSeconds: null },
  lines: [],
  analyses: new Map(),
  hasTranscript: true,
  completed: false,
  snapshot: {
    status: {
      shadowing: { kind: "not_started" },
      pronunciation: { kind: "not_started" },
      listening: { kind: "not_started" },
      retention: { kind: "not_enough_data" },
    },
    savedKnowledge: { vocabulary: 0, expressions: 0, grammar: 0, retention: { kind: "not_enough_data" } },
    reviewTargets,
    bestLine: null,
  },
  saved: [],
});

describe("scheduleReviewTomorrow", () => {
  const now = new Date("2026-10-04T16:59:00Z");
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateSummary.mockResolvedValue({ supabase: { rpc }, userId: USER_ID });
    mocks.rateLimit.mockReturnValue({ ok: true, retryAfter: 0 });
    rpc.mockResolvedValue({ data: "2", error: null });
    mocks.getStudyTimezone.mockResolvedValue({ timeZone: "Asia/Ho_Chi_Minh", needsDetection: false });
  });

  it("refuses a signed-out caller before the rate limit and any load", async () => {
    mocks.authenticateSummary.mockResolvedValue(null);

    await expect(scheduleReviewTomorrow(VIDEO_ID, now)).resolves.toEqual({ kind: "unauthorized" });
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.loadLessonSummary).not.toHaveBeenCalled();
  });

  it("passes a lesson the learner cannot see through as not_found", async () => {
    mocks.loadLessonSummary.mockResolvedValue({ ok: false, status: 404 });

    await expect(scheduleReviewTomorrow(VIDEO_ID, now)).resolves.toEqual({ kind: "not_found" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses server snapshot targets and serializes the RPC count", async () => {
    mocks.loadLessonSummary.mockResolvedValue({ ok: true, data: loadedSummary([
      { lineId: "line-1", lineText: "server target", reasons: ["dictation"], focusSpan: "target" },
      { lineId: "line-2", lineText: "another", reasons: ["difficult"], focusSpan: null },
    ]) });

    await expect(scheduleReviewTomorrow(VIDEO_ID, now)).resolves.toEqual({
      kind: "ok",
      scheduled: 2,
      dueAt: "2026-10-04T17:00:00.000Z",
    });
    expect(mocks.rateLimit).toHaveBeenCalledWith(`summary:review-tomorrow:${USER_ID}`, { limit: 10, windowMs: 60_000 }, now.getTime());
    expect(rpc).toHaveBeenCalledWith("schedule_review_tomorrow", {
      p_video: VIDEO_ID,
      p_targets: [{ lineId: "line-1", focusSpan: "target" }, { lineId: "line-2", focusSpan: null }],
      p_due: "2026-10-04T17:00:00.000Z",
    });
  });

  it("does not call the RPC when there are no server review targets", async () => {
    mocks.loadLessonSummary.mockResolvedValue({ ok: true, data: loadedSummary([]) });

    await expect(scheduleReviewTomorrow(VIDEO_ID, now)).resolves.toEqual({
      kind: "ok",
      scheduled: 0,
      dueAt: "2026-10-04T17:00:00.000Z",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the stored study zone rather than the browser or a fixed zone", async () => {
    mocks.getStudyTimezone.mockResolvedValue({ timeZone: "America/Los_Angeles", needsDetection: false });
    mocks.loadLessonSummary.mockResolvedValue({ ok: true, data: loadedSummary([]) });
    await expect(scheduleReviewTomorrow(VIDEO_ID, now)).resolves.toEqual({
      kind: "ok", scheduled: 0, dueAt: "2026-10-05T07:00:00.000Z",
    });
    expect(mocks.getStudyTimezone).toHaveBeenCalledOnce();
  });

  it("returns the rate-limit retry delay before loading the lesson or writing (m1)", async () => {
    mocks.rateLimit.mockReturnValue({ ok: false, retryAfter: 4_200 });

    await expect(scheduleReviewTomorrow(VIDEO_ID, now)).resolves.toEqual({ kind: "rate_limited", retryAfter: 4_200 });
    expect(mocks.loadLessonSummary).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
