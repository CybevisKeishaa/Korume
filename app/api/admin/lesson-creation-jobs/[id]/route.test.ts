import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { readAdminLessonCreationJob } from "@/lib/data/lesson-creation-jobs";

vi.mock("@/lib/data/lesson-creation-jobs", () => ({ readAdminLessonCreationJob: vi.fn() }));

const JOB_ID = "33333333-3333-4333-8333-333333333333";
const STATUS = {
  job: {
    id: JOB_ID,
    state: "failed" as const,
    step: "failed" as const,
    attemptCount: 3,
    lessonId: null,
    publicErrorCode: "transcript_unavailable" as const,
    updatedAt: "2026-09-19T08:00:00.000Z",
  },
  events: [],
};

function get(id: string) {
  return GET(new Request(`http://localhost/api/admin/lesson-creation-jobs/${id}`), { params: { id } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readAdminLessonCreationJob).mockResolvedValue({ ok: true, data: STATUS });
});

describe("GET /api/admin/lesson-creation-jobs/[id]", () => {
  it("returns the requesting admin's own job", async () => {
    const response = await get(JOB_ID);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: STATUS });
    expect(readAdminLessonCreationJob).toHaveBeenCalledWith(JOB_ID);
  });

  it("rejects a malformed id before it reaches a query", async () => {
    const response = await get("not-a-uuid");

    expect(response.status).toBe(400);
    expect(readAdminLessonCreationJob).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, status: 401 } as const, 401, "Unauthorized"],
    [{ ok: false, status: 403, reason: "not_admin" } as const, 403, "Forbidden"],
    [{ ok: false, status: 404 } as const, 404, "Not found"],
  ])("does not collapse a %o refusal into a job", async (refusal, status, error) => {
    vi.mocked(readAdminLessonCreationJob).mockResolvedValue(refusal);

    const response = await get(JOB_ID);

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
  });
});
