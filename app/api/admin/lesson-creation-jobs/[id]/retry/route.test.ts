import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { retryAdminLessonCreationJob } from "@/lib/data/lesson-creation-jobs";

vi.mock("@/lib/data/lesson-creation-jobs", () => ({ retryAdminLessonCreationJob: vi.fn() }));

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
  return POST(new Request(`http://localhost/api/admin/lesson-creation-jobs/${id}/retry`, { method: "POST" }), {
    params: { id },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retryAdminLessonCreationJob).mockResolvedValue({ ok: true, data: JOB });
});

describe("POST /api/admin/lesson-creation-jobs/[id]/retry", () => {
  it("accepts a retry of the requesting admin's own failed job", async () => {
    const response = await post(JOB_ID);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ data: JOB });
    expect(retryAdminLessonCreationJob).toHaveBeenCalledWith(JOB_ID);
  });

  it("rejects a malformed id before it reaches a query", async () => {
    const response = await post("not-a-uuid");

    expect(response.status).toBe(400);
    expect(retryAdminLessonCreationJob).not.toHaveBeenCalled();
  });

  it.each([
    [401 as const, "Unauthorized"],
    [403 as const, "Forbidden"],
    [404 as const, "Not found"],
    [409 as const, "This job cannot be retried"],
  ])("does not collapse a %i refusal into a queued retry", async (status, error) => {
    vi.mocked(retryAdminLessonCreationJob).mockResolvedValue({ ok: false, status });

    const response = await post(JOB_ID);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
  });
});
