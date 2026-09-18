import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { retryLearnerLessonCreationJob } from "@/lib/data/lesson-creation-jobs";

vi.mock("@/lib/data/lesson-creation-jobs", () => ({ retryLearnerLessonCreationJob: vi.fn() }));

const JOB_ID = "33333333-3333-4333-8333-333333333333";
const JOB = {
  id: JOB_ID,
  state: "queued" as const,
  step: "deduplicating" as const,
  attemptCount: 0,
  lessonId: null,
  publicErrorCode: null,
  updatedAt: "2026-09-19T08:00:00.000Z",
};

function post(id: string) {
  return POST(new Request(`http://localhost/api/lesson-creation-jobs/${id}/retry`, { method: "POST" }), {
    params: { id },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retryLearnerLessonCreationJob).mockResolvedValue({ ok: true, data: JOB });
});

describe("POST /api/lesson-creation-jobs/[id]/retry", () => {
  it("accepts a retry of the owner's failed job", async () => {
    const response = await post(JOB_ID);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ data: JOB });
    expect(retryLearnerLessonCreationJob).toHaveBeenCalledWith(JOB_ID);
  });

  it("rejects a malformed id before it reaches a query", async () => {
    const response = await post("not-a-uuid");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid id" });
    expect(retryLearnerLessonCreationJob).not.toHaveBeenCalled();
  });

  it("refuses to re-queue a job that is still active or already succeeded", async () => {
    vi.mocked(retryLearnerLessonCreationJob).mockResolvedValue({ ok: false, status: 409 });

    const response = await post(JOB_ID);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "This job cannot be retried" });
  });

  it("converts the limiter's millisecond delay into whole Retry-After seconds", async () => {
    vi.mocked(retryLearnerLessonCreationJob).mockResolvedValue({ ok: false, status: 429, retryAfter: 2500 });

    const response = await post(JOB_ID);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3");
  });

  it.each([
    [401 as const, "Unauthorized"],
    [404 as const, "Not found"],
  ])("does not collapse a %i refusal into a queued retry", async (status, error) => {
    vi.mocked(retryLearnerLessonCreationJob).mockResolvedValue({ ok: false, status });

    const response = await post(JOB_ID);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
  });
});
