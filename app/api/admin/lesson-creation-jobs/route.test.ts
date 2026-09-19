import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { enqueueAdminLessonCreationJob } from "@/lib/data/lesson-creation-jobs";

vi.mock("@/lib/data/lesson-creation-jobs", () => ({ enqueueAdminLessonCreationJob: vi.fn() }));

const JOB = {
  id: "33333333-3333-4333-8333-333333333333",
  state: "queued" as const,
  step: "deduplicating" as const,
  attemptCount: 0,
  lessonId: null,
  publicErrorCode: null,
  updatedAt: "2026-09-19T08:00:00.000Z",
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/admin/lesson-creation-jobs", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(enqueueAdminLessonCreationJob).mockResolvedValue({ ok: true, data: JOB });
});

describe("POST /api/admin/lesson-creation-jobs", () => {
  it("queues catalogue work at the requested access level", async () => {
    const response = await post({ youtubeUrl: "dQw4w9WgXcQ", libraryAccess: "PLUS" });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ data: JOB });
    expect(enqueueAdminLessonCreationJob).toHaveBeenCalledWith({
      youtubeVideoId: "dQw4w9WgXcQ",
      libraryAccess: "PLUS",
    });
  });

  it("rejects PRIVATE, which belongs to the learner origin alone", async () => {
    const response = await post({ youtubeUrl: "dQw4w9WgXcQ", libraryAccess: "PRIVATE" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid lesson creation request" });
    expect(enqueueAdminLessonCreationJob).not.toHaveBeenCalled();
  });

  it("requires an access level rather than assuming one", async () => {
    const response = await post({ youtubeUrl: "dQw4w9WgXcQ" });

    expect(response.status).toBe(400);
    expect(enqueueAdminLessonCreationJob).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON before reaching the queue", async () => {
    const response = await post("{not json");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON" });
    expect(enqueueAdminLessonCreationJob).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, status: 401 } as const, 401, "Unauthorized"],
    [{ ok: false, status: 403, reason: "not_admin" } as const, 403, "Forbidden"],
    [{ ok: false, status: 503 } as const, 503, "Lesson creation is temporarily unavailable"],
    // Must not inherit the 503 copy: "temporarily unavailable" tells the admin
    // to wait, and this condition does not clear on its own.
    [
      { ok: false, status: 409 } as const,
      409,
      "This video already has a private lesson, so it cannot be published to the catalogue. Approve that lesson instead if it should be public.",
    ],
  ])("does not collapse a %o refusal into a queued job", async (refusal, status, error) => {
    vi.mocked(enqueueAdminLessonCreationJob).mockResolvedValue(refusal);

    const response = await post({ youtubeUrl: "dQw4w9WgXcQ", libraryAccess: "FREE" });

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
  });

  it("converts the limiter's millisecond delay into whole Retry-After seconds", async () => {
    vi.mocked(enqueueAdminLessonCreationJob).mockResolvedValue({ ok: false, status: 429, retryAfter: 1500 });

    const response = await post({ youtubeUrl: "dQw4w9WgXcQ", libraryAccess: "FREE" });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("2");
  });
});
