import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { addVisibleLessonToLibrary } from "@/lib/data/lesson-library";

vi.mock("@/lib/data/lesson-library", () => ({ addVisibleLessonToLibrary: vi.fn() }));

const LESSON_ID = "a0000000-0000-0000-0000-000000000001";

beforeEach(() => vi.clearAllMocks());

describe("POST /api/videos/[id]/library", () => {
  it("rejects malformed ids before the membership action", async () => {
    const response = await POST(new Request("http://localhost/api/videos/not-a-uuid/library"), {
      params: { id: "not-a-uuid" },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid id" });
    expect(addVisibleLessonToLibrary).not.toHaveBeenCalled();
  });

  it("returns an idempotent success payload for a visible catalogue lesson", async () => {
    vi.mocked(addVisibleLessonToLibrary).mockResolvedValue({ ok: true, alreadyAdded: true });

    const response = await POST(new Request(`http://localhost/api/videos/${LESSON_ID}/library`), {
      params: { id: LESSON_ID },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { alreadyAdded: true } });
  });

  it.each([
    [{ ok: false, status: 401 } as const, 401, "Unauthorized"],
    [{ ok: false, status: 404 } as const, 404, "Not found"],
  ])("does not collapse a %i membership refusal into a success", async (result, expectedStatus, error) => {
    vi.mocked(addVisibleLessonToLibrary).mockResolvedValue(result);

    const response = await POST(new Request(`http://localhost/api/videos/${LESSON_ID}/library`), {
      params: { id: LESSON_ID },
    });

    expect(response.status).toBe(expectedStatus);
    await expect(response.json()).resolves.toEqual({ error });
  });
});
