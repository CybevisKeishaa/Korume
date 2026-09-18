import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { readLearnerLessonCreationJob } from "@/lib/data/lesson-creation-jobs";

vi.mock("@/lib/data/lesson-creation-jobs", () => ({ readLearnerLessonCreationJob: vi.fn() }));

const JOB_ID = "33333333-3333-4333-8333-333333333333";
const FOREIGN_JOB_ID = "44444444-4444-4444-8444-444444444444";
const STATUS = {
  job: {
    id: JOB_ID,
    state: "running" as const,
    step: "fetching_transcript" as const,
    attemptCount: 1,
    lessonId: null,
    publicErrorCode: null,
    updatedAt: "2026-09-19T08:00:00.000Z",
  },
  events: [
    {
      state: "queued" as const,
      step: "deduplicating" as const,
      attemptCount: 0,
      publicErrorCode: null,
      createdAt: "2026-09-19T08:00:00.000Z",
    },
  ],
};

function get(id: string) {
  return GET(new Request(`http://localhost/api/lesson-creation-jobs/${id}`), { params: { id } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readLearnerLessonCreationJob).mockResolvedValue({ ok: true, data: STATUS });
});

describe("GET /api/lesson-creation-jobs/[id]", () => {
  it("returns the owner's projection and its durable event history", async () => {
    const response = await get(JOB_ID);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: STATUS });
    expect(readLearnerLessonCreationJob).toHaveBeenCalledWith(JOB_ID);
  });

  it("rejects a malformed id before it reaches a query", async () => {
    const response = await get("not-a-uuid");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid id" });
    expect(readLearnerLessonCreationJob).not.toHaveBeenCalled();
  });

  it("answers a foreign job exactly as it answers a missing one", async () => {
    vi.mocked(readLearnerLessonCreationJob).mockResolvedValue({ ok: false, status: 404 });

    const foreign = await get(FOREIGN_JOB_ID);
    const missing = await get(JOB_ID);

    expect([foreign.status, missing.status]).toEqual([404, 404]);
    await expect(foreign.json()).resolves.toEqual({ error: "Not found" });
    await expect(missing.json()).resolves.toEqual({ error: "Not found" });
  });

  it("refuses an anonymous reader", async () => {
    vi.mocked(readLearnerLessonCreationJob).mockResolvedValue({ ok: false, status: 401 });

    const response = await get(JOB_ID);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});
