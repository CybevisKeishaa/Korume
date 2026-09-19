import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/guard";
import { rateLimit } from "@/lib/rate-limit";
import { findExistingLesson, isUnderQuota } from "@/lib/data/lesson-library";
import {
  enqueueLessonCreation,
  getRequesterJobWithEvents,
  retryRequesterJob,
} from "@/lib/lesson-creation/store";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/data/lesson-library", () => ({ findExistingLesson: vi.fn(), isUnderQuota: vi.fn() }));
vi.mock("@/lib/lesson-creation/store", () => ({
  enqueueLessonCreation: vi.fn(),
  getRequesterJobWithEvents: vi.fn(),
  retryRequesterJob: vi.fn(),
}));

import {
  enqueueAdminLessonCreationJob,
  enqueueLearnerLessonCreationJob,
  readAdminLessonCreationJob,
  readLearnerLessonCreationJob,
  retryAdminLessonCreationJob,
  retryLearnerLessonCreationJob,
} from "./lesson-creation-jobs";

const USER = { id: "11111111-1111-4111-8111-111111111111" };
const ADMIN = { id: "22222222-2222-4222-8222-222222222222", email: "admin@example.com" };
const JOB_ID = "33333333-3333-4333-8333-333333333333";
const VIDEO_ID = "dQw4w9WgXcQ";
const ORIGINAL_WORKER_FLAG = process.env.LESSON_CREATION_WORKER_ENABLED;

const JOB = {
  id: JOB_ID,
  state: "queued" as const,
  step: "deduplicating" as const,
  attemptCount: 0,
  lessonId: null,
  publicErrorCode: null,
  updatedAt: "2026-09-19T08:00:00.000Z",
};
const EVENT = {
  state: "queued" as const,
  step: "deduplicating" as const,
  attemptCount: 0,
  publicErrorCode: null,
  createdAt: "2026-09-19T08:00:00.000Z",
};

function signedInAs(user: { id: string } | null) {
  const supabase = createMockSupabase({ user, tables: {} });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LESSON_CREATION_WORKER_ENABLED = "true";
  signedInAs(USER);
  vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 0 });
  vi.mocked(findExistingLesson).mockResolvedValue(null);
  vi.mocked(isUnderQuota).mockResolvedValue(true);
  vi.mocked(requireAdmin).mockResolvedValue({ ok: true, user: ADMIN });
  vi.mocked(enqueueLessonCreation).mockResolvedValue(JOB);
  vi.mocked(getRequesterJobWithEvents).mockResolvedValue({ job: JOB, events: [EVENT] });
  vi.mocked(retryRequesterJob).mockResolvedValue(JOB);
});

afterEach(() => {
  if (ORIGINAL_WORKER_FLAG === undefined) delete process.env.LESSON_CREATION_WORKER_ENABLED;
  else process.env.LESSON_CREATION_WORKER_ENABLED = ORIGINAL_WORKER_FLAG;
});

describe("enqueueLearnerLessonCreationJob", () => {
  it("queues a learner-origin PRIVATE job for the authenticated requester", async () => {
    expect(await enqueueLearnerLessonCreationJob({ youtubeVideoId: VIDEO_ID })).toEqual({ ok: true, data: JOB });

    expect(enqueueLessonCreation).toHaveBeenCalledWith({
      requesterId: USER.id,
      origin: "learner",
      requestedAccess: "PRIVATE",
      youtubeVideoId: VIDEO_ID,
    });
  });

  it("refuses an anonymous caller before any queue work", async () => {
    signedInAs(null);

    expect(await enqueueLearnerLessonCreationJob({ youtubeVideoId: VIDEO_ID })).toEqual({ ok: false, status: 401 });
    expect(rateLimit).not.toHaveBeenCalled();
    expect(enqueueLessonCreation).not.toHaveBeenCalled();
  });

  it("reports the rate limiter's own retry delay", async () => {
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 4200 });

    expect(await enqueueLearnerLessonCreationJob({ youtubeVideoId: VIDEO_ID })).toEqual({
      ok: false,
      status: 429,
      retryAfter: 4200,
    });
    expect(rateLimit).toHaveBeenCalledWith(`lessons:create:${USER.id}`, { limit: 20, windowMs: 60_000 });
    expect(enqueueLessonCreation).not.toHaveBeenCalled();
  });

  it.each([["false"], [undefined], ["TRUE"], ["1"]])(
    "refuses to record a job the worker will never run (flag %s)",
    async (flag) => {
      if (flag === undefined) delete process.env.LESSON_CREATION_WORKER_ENABLED;
      else process.env.LESSON_CREATION_WORKER_ENABLED = flag;

      expect(await enqueueLearnerLessonCreationJob({ youtubeVideoId: VIDEO_ID })).toEqual({ ok: false, status: 503 });
      expect(enqueueLessonCreation).not.toHaveBeenCalled();
      // A disabled service must not also claim the learner is out of quota.
      expect(isUnderQuota).not.toHaveBeenCalled();
    },
  );

  it("gives an exhausted learner the advisory quota refusal for a lesson that does not exist yet", async () => {
    vi.mocked(findExistingLesson).mockResolvedValue(null);
    vi.mocked(isUnderQuota).mockResolvedValue(false);

    expect(await enqueueLearnerLessonCreationJob({ youtubeVideoId: VIDEO_ID })).toEqual({
      ok: false,
      status: 403,
      reason: "quota_exceeded",
    });
    expect(isUnderQuota).toHaveBeenCalledWith(USER.id);
    expect(enqueueLessonCreation).not.toHaveBeenCalled();
  });

  it.each([
    ["FREE" as const],
    ["PLUS" as const],
    ["PRIVATE" as const],
  ])(
    "never refuses an exhausted learner over a %s lesson that already exists — finalize would charge no slot",
    async (libraryAccess) => {
      // Design §3 rules 3 and 4: a lesson the learner can already reach, or
      // already holds, costs no quota. `finalize_lesson_creation_job` charges
      // only where no row exists or it is PRIVATE and unheld, so a refusal here
      // would be untrue AND would make the lesson unreachable from the importer.
      vi.mocked(findExistingLesson).mockResolvedValue({ id: "l1", library_access: libraryAccess } as never);
      vi.mocked(isUnderQuota).mockResolvedValue(false);

      expect(await enqueueLearnerLessonCreationJob({ youtubeVideoId: VIDEO_ID })).toEqual({ ok: true, data: JOB });
      expect(enqueueLessonCreation).toHaveBeenCalled();
    },
  );

  it("looks the catalogue up before spending an advisory refusal", async () => {
    await enqueueLearnerLessonCreationJob({ youtubeVideoId: VIDEO_ID });

    expect(findExistingLesson).toHaveBeenCalledWith(VIDEO_ID);
  });

  it("does not consult the catalogue while the worker is disabled", async () => {
    process.env.LESSON_CREATION_WORKER_ENABLED = "false";

    await enqueueLearnerLessonCreationJob({ youtubeVideoId: VIDEO_ID });

    expect(findExistingLesson).not.toHaveBeenCalled();
  });
});

describe("enqueueAdminLessonCreationJob", () => {
  it("queues an admin-origin job at the requested access level", async () => {
    expect(await enqueueAdminLessonCreationJob({ youtubeVideoId: VIDEO_ID, libraryAccess: "PLUS" })).toEqual({
      ok: true,
      data: JOB,
    });

    expect(enqueueLessonCreation).toHaveBeenCalledWith({
      requesterId: ADMIN.id,
      origin: "admin",
      requestedAccess: "PLUS",
      youtubeVideoId: VIDEO_ID,
    });
  });

  it("never spends a learner quota slot on catalogue work", async () => {
    await enqueueAdminLessonCreationJob({ youtubeVideoId: VIDEO_ID, libraryAccess: "FREE" });

    expect(isUnderQuota).not.toHaveBeenCalled();
  });

  /**
   * The early half of the A+C ruling. An admin job asks for FREE/PLUS; deduping
   * onto a PRIVATE lesson publishes nothing, so refuse before a job exists at
   * all. This is the courtesy, not the guarantee — `finalize_lesson_creation_job`
   * repeats it under the advisory lock, where a learner cannot create the row
   * after the check has passed.
   */
  it("refuses a catalogue job for a video an existing private lesson already occupies", async () => {
    vi.mocked(findExistingLesson).mockResolvedValue({ id: "l1", library_access: "PRIVATE" } as never);

    expect(await enqueueAdminLessonCreationJob({ youtubeVideoId: VIDEO_ID, libraryAccess: "FREE" })).toEqual({
      ok: false,
      status: 409,
    });
    expect(enqueueLessonCreation).not.toHaveBeenCalled();
  });

  it.each(["FREE", "PLUS"] as const)("still queues over an existing published %s lesson", async (libraryAccess) => {
    vi.mocked(findExistingLesson).mockResolvedValue({ id: "l1", library_access: libraryAccess } as never);

    expect(await enqueueAdminLessonCreationJob({ youtubeVideoId: VIDEO_ID, libraryAccess: "FREE" })).toEqual({
      ok: true,
      data: JOB,
    });
  });

  it("does not consult the catalogue while the worker is disabled", async () => {
    process.env.LESSON_CREATION_WORKER_ENABLED = "false";

    await enqueueAdminLessonCreationJob({ youtubeVideoId: VIDEO_ID, libraryAccess: "FREE" });

    expect(findExistingLesson).not.toHaveBeenCalled();
  });

  it.each([
    [401 as const, { ok: false, status: 401 }],
    [403 as const, { ok: false, status: 403, reason: "not_admin" }],
  ])("passes the admin guard's own %i through, saying why", async (status, expected) => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status });

    expect(await enqueueAdminLessonCreationJob({ youtubeVideoId: VIDEO_ID, libraryAccess: "FREE" })).toEqual(expected);
    expect(enqueueLessonCreation).not.toHaveBeenCalled();
  });

  it("refuses while the worker is disabled", async () => {
    process.env.LESSON_CREATION_WORKER_ENABLED = "false";

    expect(await enqueueAdminLessonCreationJob({ youtubeVideoId: VIDEO_ID, libraryAccess: "FREE" })).toEqual({
      ok: false,
      status: 503,
    });
    expect(enqueueLessonCreation).not.toHaveBeenCalled();
  });

  it("rate-limits the admin queue action under its own key", async () => {
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 1500 });

    expect(await enqueueAdminLessonCreationJob({ youtubeVideoId: VIDEO_ID, libraryAccess: "FREE" })).toEqual({
      ok: false,
      status: 429,
      retryAfter: 1500,
    });
    expect(rateLimit).toHaveBeenCalledWith(`lessons:create:admin:${ADMIN.id}`, { limit: 20, windowMs: 60_000 });
  });
});

describe("readLearnerLessonCreationJob", () => {
  it("returns the owner's projection with its durable event history", async () => {
    expect(await readLearnerLessonCreationJob(JOB_ID)).toEqual({ ok: true, data: { job: JOB, events: [EVENT] } });

    expect(getRequesterJobWithEvents).toHaveBeenCalledWith(JOB_ID, USER.id);
  });

  it("cannot tell a foreign job from a missing one", async () => {
    vi.mocked(getRequesterJobWithEvents).mockResolvedValue(null);

    expect(await readLearnerLessonCreationJob(JOB_ID)).toEqual({ ok: false, status: 404 });
    // The requester id is passed to the store on every read; the store is what
    // refuses to touch history for a job this caller does not own.
    expect(getRequesterJobWithEvents).toHaveBeenCalledWith(JOB_ID, USER.id);
  });

  it("refuses an anonymous reader", async () => {
    signedInAs(null);

    expect(await readLearnerLessonCreationJob(JOB_ID)).toEqual({ ok: false, status: 401 });
    expect(getRequesterJobWithEvents).not.toHaveBeenCalled();
  });
});

describe("readAdminLessonCreationJob", () => {
  it("scopes an admin read to the jobs that admin requested", async () => {
    expect(await readAdminLessonCreationJob(JOB_ID)).toEqual({ ok: true, data: { job: JOB, events: [EVENT] } });

    expect(getRequesterJobWithEvents).toHaveBeenCalledWith(JOB_ID, ADMIN.id);
  });

  it("passes the admin guard's refusal through, saying why", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });

    expect(await readAdminLessonCreationJob(JOB_ID)).toEqual({ ok: false, status: 403, reason: "not_admin" });
    expect(getRequesterJobWithEvents).not.toHaveBeenCalled();
  });
});

describe("retryLearnerLessonCreationJob", () => {
  it("queues a fresh attempt for the owner's failed job", async () => {
    expect(await retryLearnerLessonCreationJob(JOB_ID)).toEqual({ ok: true, data: JOB });

    expect(retryRequesterJob).toHaveBeenCalledWith(JOB_ID, USER.id);
  });

  it("cannot tell a foreign job from a missing one", async () => {
    vi.mocked(retryRequesterJob).mockResolvedValue(null);

    expect(await retryLearnerLessonCreationJob(JOB_ID)).toEqual({ ok: false, status: 404 });
  });

  it("maps the database's not-retryable rejection to a conflict", async () => {
    vi.mocked(retryRequesterJob).mockRejectedValue({ message: "job_not_retryable", code: "23505" });

    expect(await retryLearnerLessonCreationJob(JOB_ID)).toEqual({ ok: false, status: 409 });
  });

  it("never swallows an unrelated database failure as a conflict", async () => {
    const outage = { message: "connection failure", code: "08006" };
    vi.mocked(retryRequesterJob).mockRejectedValue(outage);

    await expect(retryLearnerLessonCreationJob(JOB_ID)).rejects.toBe(outage);
  });

  it("refuses an anonymous caller", async () => {
    signedInAs(null);

    expect(await retryLearnerLessonCreationJob(JOB_ID)).toEqual({ ok: false, status: 401 });
    expect(retryRequesterJob).not.toHaveBeenCalled();
  });

  it("is rate-limited under its own key", async () => {
    // A retry resets attempt_count to 0, buying a fresh three-attempt budget of
    // third-party metadata and caption calls, so it needs a budget of its own.
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 2500 });

    expect(await retryLearnerLessonCreationJob(JOB_ID)).toEqual({ ok: false, status: 429, retryAfter: 2500 });
    expect(rateLimit).toHaveBeenCalledWith(`lessons:retry:${USER.id}`, { limit: 20, windowMs: 60_000 });
    expect(retryRequesterJob).not.toHaveBeenCalled();
  });
});

describe("retryAdminLessonCreationJob", () => {
  it("scopes an admin retry to the jobs that admin requested", async () => {
    expect(await retryAdminLessonCreationJob(JOB_ID)).toEqual({ ok: true, data: JOB });

    expect(retryRequesterJob).toHaveBeenCalledWith(JOB_ID, ADMIN.id);
  });

  it("passes the admin guard's refusal through", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 401 });

    expect(await retryAdminLessonCreationJob(JOB_ID)).toEqual({ ok: false, status: 401 });
    expect(retryRequesterJob).not.toHaveBeenCalled();
  });

  it("is rate-limited under its own key", async () => {
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 2500 });

    expect(await retryAdminLessonCreationJob(JOB_ID)).toEqual({ ok: false, status: 429, retryAfter: 2500 });
    expect(rateLimit).toHaveBeenCalledWith(`lessons:retry:admin:${ADMIN.id}`, { limit: 20, windowMs: 60_000 });
    expect(retryRequesterJob).not.toHaveBeenCalled();
  });
});
