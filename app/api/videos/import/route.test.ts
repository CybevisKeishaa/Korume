import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { enqueueLearnerLessonCreationJob } from "@/lib/data/lesson-creation-jobs";

vi.mock("@/lib/data/lesson-creation-jobs", () => ({ enqueueLearnerLessonCreationJob: vi.fn() }));

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
    new Request("http://localhost/api/videos/import", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(enqueueLearnerLessonCreationJob).mockResolvedValue({ ok: true, data: JOB });
});

describe("POST /api/videos/import", () => {
  it("accepts the request and answers with the queued job, not a lesson", async () => {
    const response = await post({ youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ data: JOB });
    expect(enqueueLearnerLessonCreationJob).toHaveBeenCalledWith({ youtubeVideoId: "dQw4w9WgXcQ" });
  });

  it("still accepts a bare eleven-character video id", async () => {
    await post({ youtubeUrl: "dQw4w9WgXcQ" });

    expect(enqueueLearnerLessonCreationJob).toHaveBeenCalledWith({ youtubeVideoId: "dQw4w9WgXcQ" });
  });

  it("rejects malformed JSON before reaching the queue", async () => {
    const response = await post("{not json");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON" });
    expect(enqueueLearnerLessonCreationJob).not.toHaveBeenCalled();
  });

  it("rejects a URL that is not a YouTube video", async () => {
    const response = await post({ youtubeUrl: "https://example.com/not-a-video" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Invalid video URL" });
    expect(enqueueLearnerLessonCreationJob).not.toHaveBeenCalled();
  });

  it("never lets a client choose the requester, origin, or state", async () => {
    await post({
      youtubeUrl: "dQw4w9WgXcQ",
      requesterId: "00000000-0000-4000-8000-000000000000",
      origin: "admin",
      state: "succeeded",
      attemptCount: 99,
    });

    expect(enqueueLearnerLessonCreationJob).toHaveBeenCalledWith({ youtubeVideoId: "dQw4w9WgXcQ" });
  });

  it.each([
    [{ ok: false, status: 401 } as const, 401, "Unauthorized"],
    [{ ok: false, status: 403 } as const, 403, "Monthly lesson quota reached"],
    [{ ok: false, status: 503 } as const, 503, "Lesson creation is temporarily unavailable"],
  ])("does not collapse a %o refusal into a queued job", async (result, status, error) => {
    vi.mocked(enqueueLearnerLessonCreationJob).mockResolvedValue(result);

    const response = await post({ youtubeUrl: "dQw4w9WgXcQ" });

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
  });

  it("converts the limiter's millisecond delay into whole Retry-After seconds", async () => {
    vi.mocked(enqueueLearnerLessonCreationJob).mockResolvedValue({ ok: false, status: 429, retryAfter: 4200 });

    const response = await post({ youtubeUrl: "dQw4w9WgXcQ" });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("5");
  });
});
