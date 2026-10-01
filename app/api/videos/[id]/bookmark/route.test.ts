import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "./route";
import { setLessonBookmark } from "@/lib/data/lesson-bookmarks";

vi.mock("@/lib/data/lesson-bookmarks", () => ({ setLessonBookmark: vi.fn() }));

const VIDEO_ID = "a0000000-0000-0000-0000-000000000001";
const request = (method: string) => new Request(`http://localhost/api/videos/${VIDEO_ID}/bookmark`, { method });

beforeEach(() => vi.clearAllMocks());

describe("/api/videos/[id]/bookmark", () => {
  it("validates the id before calling the data layer", async () => {
    const response = await PUT(request("PUT"), { params: { id: "invalid" } });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid id" });
    expect(setLessonBookmark).not.toHaveBeenCalled();
  });

  it("bookmarks and removes bookmarks", async () => {
    vi.mocked(setLessonBookmark).mockResolvedValue({ ok: true });
    await expect((await PUT(request("PUT"), { params: { id: VIDEO_ID } })).json()).resolves.toEqual({ data: { bookmarked: true } });
    expect(setLessonBookmark).toHaveBeenLastCalledWith(VIDEO_ID, true);
    await expect((await DELETE(request("DELETE"), { params: { id: VIDEO_ID } })).json()).resolves.toEqual({ data: { bookmarked: false } });
    expect(setLessonBookmark).toHaveBeenLastCalledWith(VIDEO_ID, false);
  });

  it.each([
    [{ ok: false, status: 401 } as const, 401, "Unauthorized"],
    [{ ok: false, status: 404 } as const, 404, "Not found"],
  ])("maps a refusal %#", async (result, status, error) => {
    vi.mocked(setLessonBookmark).mockResolvedValue(result);
    const response = await PUT(request("PUT"), { params: { id: VIDEO_ID } });
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
  });

  it("sets Retry-After and hides unexpected errors", async () => {
    vi.mocked(setLessonBookmark).mockResolvedValueOnce({ ok: false, status: 429, retryAfter: 4_200 });
    expect((await PUT(request("PUT"), { params: { id: VIDEO_ID } })).headers.get("Retry-After")).toBe("5");
    vi.mocked(setLessonBookmark).mockRejectedValueOnce(new Error("database"));
    const response = await PUT(request("PUT"), { params: { id: VIDEO_ID } });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Something went wrong. Please try again." });
  });
});
