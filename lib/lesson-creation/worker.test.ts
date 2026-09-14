import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimNextLessonCreationJob,
  finalizeClaimedJob,
  getRequesterJob,
  recoverExpiredLessonCreationJobs,
  transitionClaimedJob,
  type ClaimedLessonCreationJob,
} from "./store";
import type { LessonCreationDependencies } from "./pipeline";
import {
  TransientLessonCreationProviderError,
  retryDelayMs,
  runLessonCreationPass,
} from "./worker";

vi.mock("./store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./store")>();
  return {
    ...actual,
    claimNextLessonCreationJob: vi.fn(),
    finalizeClaimedJob: vi.fn(),
    getRequesterJob: vi.fn(),
    recoverExpiredLessonCreationJobs: vi.fn(),
    transitionClaimedJob: vi.fn(),
  };
});

const NOW = new Date("2026-09-14T03:00:00.000Z");
const JOB_ID = "dc2ceca1-1647-489b-985e-97aa4ac00abc";
const REQUESTER_ID = "dce6afaa-43d0-47cc-b983-1e504579f574";
const LESSON_ID = "6636547d-b082-4bb1-bc74-852418d4c9f1";
const LEASE_TOKEN = "b4a4485c-9539-408b-a9ea-67a89e845234";

function claim(attemptCount = 1): ClaimedLessonCreationJob {
  return {
    job: {
      id: JOB_ID,
      state: "running",
      step: "deduplicating",
      attemptCount,
      lessonId: null,
      publicErrorCode: null,
      updatedAt: NOW.toISOString(),
    },
    requesterId: REQUESTER_ID,
    origin: "learner",
    requestedAccess: "PRIVATE",
    youtubeVideoId: "dQw4w9WgXcQ",
    leaseToken: LEASE_TOKEN,
    leaseExpiresAt: "2026-09-14T03:02:00.000Z",
  };
}

function providers(overrides: Partial<LessonCreationDependencies> = {}): LessonCreationDependencies {
  return {
    findExistingLesson: vi.fn().mockResolvedValue(null),
    fetchOembed: vi.fn().mockResolvedValue({ title: "Lesson", thumbnailUrl: "https://i.ytimg.com/vi/id/hq.jpg" }),
    fetchCaptions: vi.fn().mockResolvedValue({
      source: "youtube_caption",
      lines: [{ startTime: 0, endTime: 1, textJp: "日本語", textTranslation: null }],
    }),
    toFurigana: vi.fn().mockResolvedValue([{ text: "日本語", reading: "にほんご" }]),
    ...overrides,
  };
}

function installRunningStore(claimed = claim()) {
  let durable = claimed.job;
  vi.mocked(recoverExpiredLessonCreationJobs).mockResolvedValue(0);
  vi.mocked(claimNextLessonCreationJob).mockResolvedValue(claimed);
  vi.mocked(getRequesterJob).mockImplementation(async () => durable);
  vi.mocked(transitionClaimedJob).mockImplementation(async (input) => {
    durable = { ...durable, state: "running", step: input.step };
  });
  vi.mocked(finalizeClaimedJob).mockResolvedValue({
    ...claimed.job,
    state: "succeeded",
    step: "ready",
    lessonId: LESSON_ID,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(recoverExpiredLessonCreationJobs).mockResolvedValue(0);
  vi.mocked(claimNextLessonCreationJob).mockResolvedValue(null);
});

describe("runLessonCreationPass", () => {
  it("recovers leases and returns an idle pass without claiming more than once", async () => {
    vi.mocked(recoverExpiredLessonCreationJobs).mockResolvedValue(2);

    await expect(runLessonCreationPass(NOW, providers())).resolves.toEqual({
      claimed: 0,
      succeeded: 0,
      requeued: 0,
      failed: 0,
      recovered: 2,
    });
    expect(claimNextLessonCreationJob).toHaveBeenCalledTimes(1);
    expect(claimNextLessonCreationJob).toHaveBeenCalledWith(NOW.toISOString());
  });

  it("processes one claimed job to success", async () => {
    installRunningStore();

    await expect(runLessonCreationPass(NOW, providers())).resolves.toEqual({
      claimed: 1,
      succeeded: 1,
      requeued: 0,
      failed: 0,
      recovered: 0,
    });
    expect(claimNextLessonCreationJob).toHaveBeenCalledTimes(1);
    expect(finalizeClaimedJob).toHaveBeenCalledTimes(1);
  });

  it("turns a no-caption job failure into a terminal result instead of rejecting the worker pass", async () => {
    installRunningStore();

    await expect(runLessonCreationPass(NOW, providers({ fetchCaptions: vi.fn().mockResolvedValue(null) }))).resolves.toEqual({
      claimed: 1,
      succeeded: 0,
      requeued: 0,
      failed: 1,
      recovered: 0,
    });
    expect(transitionClaimedJob).toHaveBeenLastCalledWith({
      jobId: JOB_ID,
      leaseToken: LEASE_TOKEN,
      step: "failed",
      error: "transcript_unavailable",
    });
  });

  it("requeues one explicit transient database failure with deterministic exponential backoff", async () => {
    installRunningStore();
    const transientDatabaseError = { code: "08006", message: "connection failure" };
    const dependency = providers({ findExistingLesson: vi.fn().mockRejectedValue(transientDatabaseError) });

    await expect(runLessonCreationPass(NOW, dependency)).resolves.toEqual({
      claimed: 1,
      succeeded: 0,
      requeued: 1,
      failed: 0,
      recovered: 0,
    });
    expect(transitionClaimedJob).toHaveBeenLastCalledWith({
      jobId: JOB_ID,
      leaseToken: LEASE_TOKEN,
      step: "failed",
      error: "temporary_failure",
      availableAt: "2026-09-14T03:00:01.000Z",
    });
  });

  it("fails an explicit transient error after the third total attempt instead of requeueing", async () => {
    installRunningStore(claim(3));
    const dependency = providers({ findExistingLesson: vi.fn().mockRejectedValue({ code: "40001" }) });

    await expect(runLessonCreationPass(NOW, dependency)).resolves.toEqual({
      claimed: 1,
      succeeded: 0,
      requeued: 0,
      failed: 1,
      recovered: 0,
    });
    expect(transitionClaimedJob).toHaveBeenLastCalledWith({
      jobId: JOB_ID,
      leaseToken: LEASE_TOKEN,
      step: "failed",
      error: "temporary_failure",
    });
  });

  it("surfaces invalid durable store state rather than silently accepting it as a job failure", async () => {
    installRunningStore();
    vi.mocked(getRequesterJob).mockResolvedValue(null);

    await expect(runLessonCreationPass(NOW, providers())).rejects.toThrow("claimed lesson-creation job");
    expect(transitionClaimedJob).not.toHaveBeenCalled();
  });

  it("surfaces an invalid claimed attempt count", async () => {
    installRunningStore(claim(0));

    await expect(runLessonCreationPass(NOW, providers())).rejects.toThrow("attempt count");
  });

  it("requeues an explicitly transient caption failure on attempt two with a two-second delay", async () => {
    installRunningStore(claim(2));
    const dependency = providers({
      fetchCaptions: vi.fn().mockRejectedValue(new TransientLessonCreationProviderError("caption service unavailable")),
    });

    await expect(runLessonCreationPass(NOW, dependency)).resolves.toMatchObject({
      claimed: 1, requeued: 1, failed: 0,
    });
    expect(transitionClaimedJob).toHaveBeenLastCalledWith({
      jobId: JOB_ID, leaseToken: LEASE_TOKEN, step: "failed", error: "temporary_failure",
      availableAt: "2026-09-14T03:00:02.000Z",
    });
  });

  it("contains an unclassified provider failure without treating its message as a retry signal", async () => {
    installRunningStore();
    const dependency = providers({ fetchCaptions: vi.fn().mockRejectedValue(new Error("temporary timeout 503")) });

    await expect(runLessonCreationPass(NOW, dependency)).resolves.toMatchObject({
      claimed: 1, requeued: 0, failed: 1,
    });
    expect(transitionClaimedJob).toHaveBeenLastCalledWith({
      jobId: JOB_ID, leaseToken: LEASE_TOKEN, step: "failed", error: "temporary_failure",
    });
  });

  it("counts the final database quota refusal without trying a second finalization or transition", async () => {
    installRunningStore();
    vi.mocked(finalizeClaimedJob).mockResolvedValue({
      ...claim().job, state: "failed", step: "failed", publicErrorCode: "quota_exceeded",
    });

    await expect(runLessonCreationPass(NOW, providers())).resolves.toMatchObject({
      claimed: 1, succeeded: 0, requeued: 0, failed: 1,
    });
    expect(finalizeClaimedJob).toHaveBeenCalledTimes(1);
    expect(transitionClaimedJob).toHaveBeenLastCalledWith({
      jobId: JOB_ID, leaseToken: LEASE_TOKEN, step: "persisting",
    });
  });
});

describe("retryDelayMs", () => {
  it("uses bounded non-zero exponential delays for the execution-attempt sequence", () => {
    expect([
      retryDelayMs(1),
      retryDelayMs(2),
      retryDelayMs(3),
    ]).toEqual([1_000, 2_000, 4_000]);
  });
});
