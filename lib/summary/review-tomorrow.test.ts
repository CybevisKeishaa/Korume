import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoadedSummary } from "./load-snapshot";

const mocks = vi.hoisted(() => ({
  authenticateSummary: vi.fn(),
  loadLessonSummary: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("./load-snapshot", () => ({ authenticateSummary: mocks.authenticateSummary, loadLessonSummary: mocks.loadLessonSummary }));

import { isValidTimeZone, nextLocalMidnightUtc, scheduleReviewTomorrow } from "./review-tomorrow";

const VIDEO_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

const localDate = (instant: Date, timeZone: string): string => new Intl.DateTimeFormat("en-CA", {
  timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(instant);

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

describe("nextLocalMidnightUtc (spec §6.2: the learner's next local midnight, never now + 24h)", () => {
  it("Ho Chi Minh one minute before midnight", () => {
    expect(nextLocalMidnightUtc(new Date("2026-10-04T16:59:00Z"), "Asia/Ho_Chi_Minh").toISOString()).toBe("2026-10-04T17:00:00.000Z");
  });

  it("New York late evening, after the UTC date has already turned", () => {
    expect(nextLocalMidnightUtc(new Date("2026-10-05T03:30:00Z"), "America/New_York").toISOString()).toBe("2026-10-05T04:00:00.000Z");
  });

  it("two zones at the same instant get different instants", () => {
    const now = new Date("2026-10-04T16:00:00Z");
    expect(nextLocalMidnightUtc(now, "Asia/Ho_Chi_Minh")).not.toEqual(nextLocalMidnightUtc(now, "Europe/Paris"));
  });

  it("a midnight skipped by DST resolves to the first instant of the next local day (Review Focus 1)", () => {
    const now = new Date("2026-09-06T03:30:00Z");
    const due = nextLocalMidnightUtc(now, "America/Santiago");
    expect(localDate(due, "America/Santiago")).toBe("2026-09-06");
    expect(localDate(new Date(due.getTime() - 60_000), "America/Santiago")).toBe("2026-09-05");
    expect(due.getTime()).toBeGreaterThan(now.getTime());
  });

  it("never selects the current instant when the local date is already tomorrow", () => {
    const now = new Date("2026-10-04T17:00:00Z");
    expect(nextLocalMidnightUtc(now, "Asia/Ho_Chi_Minh").toISOString()).toBe("2026-10-05T17:00:00.000Z");
  });

  it("never returns an instant at or before the supplied clock timestamp", () => {
    const now = new Date("2026-10-04T16:59:00Z");
    vi.spyOn(now, "getTime").mockReturnValue(new Date("2026-10-05T16:59:00Z").getTime());
    expect(() => nextLocalMidnightUtc(now, "Asia/Ho_Chi_Minh")).toThrow("no local midnight found");
  });

  it("accepts IANA zones and rejects garbage", () => {
    expect(isValidTimeZone("Asia/Ho_Chi_Minh")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("scheduleReviewTomorrow", () => {
  const now = new Date("2026-10-04T16:59:00Z");
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateSummary.mockResolvedValue({ supabase: { rpc }, userId: USER_ID });
    mocks.rateLimit.mockReturnValue({ ok: true, retryAfter: 0 });
    rpc.mockResolvedValue({ data: "2", error: null });
  });

  it("refuses a signed-out caller before the rate limit and any load", async () => {
    mocks.authenticateSummary.mockResolvedValue(null);

    await expect(scheduleReviewTomorrow(VIDEO_ID, "Asia/Ho_Chi_Minh", now)).resolves.toEqual({ kind: "unauthorized" });
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.loadLessonSummary).not.toHaveBeenCalled();
  });

  it("passes a lesson the learner cannot see through as not_found", async () => {
    mocks.loadLessonSummary.mockResolvedValue({ ok: false, status: 404 });

    await expect(scheduleReviewTomorrow(VIDEO_ID, "Asia/Ho_Chi_Minh", now)).resolves.toEqual({ kind: "not_found" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an invalid zone before loading or writing", async () => {
    await expect(scheduleReviewTomorrow(VIDEO_ID, "Mars/Olympus", now)).resolves.toEqual({ kind: "invalid" });
    expect(mocks.loadLessonSummary).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses server snapshot targets and serializes the RPC count", async () => {
    mocks.loadLessonSummary.mockResolvedValue({ ok: true, data: loadedSummary([
      { lineId: "line-1", lineText: "server target", reasons: ["dictation"], focusSpan: "target" },
      { lineId: "line-2", lineText: "another", reasons: ["difficult"], focusSpan: null },
    ]) });

    await expect(scheduleReviewTomorrow(VIDEO_ID, "Asia/Ho_Chi_Minh", now)).resolves.toEqual({
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

    await expect(scheduleReviewTomorrow(VIDEO_ID, "Asia/Ho_Chi_Minh", now)).resolves.toEqual({
      kind: "ok",
      scheduled: 0,
      dueAt: "2026-10-04T17:00:00.000Z",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the rate-limit retry delay before loading the lesson or writing (m1)", async () => {
    mocks.rateLimit.mockReturnValue({ ok: false, retryAfter: 4_200 });

    await expect(scheduleReviewTomorrow(VIDEO_ID, "Asia/Ho_Chi_Minh", now)).resolves.toEqual({ kind: "rate_limited", retryAfter: 4_200 });
    expect(mocks.loadLessonSummary).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
