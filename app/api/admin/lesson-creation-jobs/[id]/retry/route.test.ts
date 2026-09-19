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

  it("converts the limiter's millisecond delay into whole Retry-After seconds", async () => {
    vi.mocked(retryAdminLessonCreationJob).mockResolvedValue({ ok: false, status: 429, retryAfter: 2500 });

    const response = await post(JOB_ID);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3");
  });

  it.each([
    [{ ok: false, status: 401 } as const, 401, "Unauthorized"],
    [{ ok: false, status: 403, reason: "not_admin" } as const, 403, "Forbidden"],
    [{ ok: false, status: 404 } as const, 404, "Not found"],
    [{ ok: false, status: 409 } as const, 409, "This job cannot be retried"],
  ])("does not collapse a %o refusal into a queued retry", async (refusal, status, error) => {
    vi.mocked(retryAdminLessonCreationJob).mockResolvedValue(refusal);

    const response = await post(JOB_ID);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
  });
});
