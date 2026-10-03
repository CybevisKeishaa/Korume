import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "./route";
import { deleteLessonNote, setLessonNote } from "@/lib/data/notes";
import { LESSON_NOTE_MAX_BYTES } from "@/lib/validation/notes";

vi.mock("@/lib/data/notes", () => ({ setLessonNote: vi.fn(), deleteLessonNote: vi.fn() }));

const VIDEO_ID = "c0000000-0000-0000-0000-000000000001";
const request = (method: string, body?: unknown) => new Request(`http://localhost/api/videos/${VIDEO_ID}/notes`, {
  method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
});
const params = (id = VIDEO_ID) => ({ params: { id } });

beforeEach(() => vi.clearAllMocks());

describe("/api/videos/[id]/notes", () => {
  it("refuses an oversized body before it reaches the data layer", async () => {
    const response = await PUT(request("PUT", { body: "x".repeat(LESSON_NOTE_MAX_BYTES) }), params());
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "Payload too large" });
    expect(setLessonNote).not.toHaveBeenCalled();
    expect(deleteLessonNote).not.toHaveBeenCalled();
  });

  it("rejects a bad id, malformed JSON and invalid bodies", async () => {
    expect((await PUT(request("PUT", { body: "a" }), params("nope"))).status).toBe(400);
    expect((await DELETE(request("DELETE"), params("nope"))).status).toBe(400);
    const malformed = await PUT(new Request("http://localhost/x", { method: "PUT", body: "{" }), params());
    await expect(malformed.json()).resolves.toEqual({ error: "Invalid JSON" });
    for (const body of [{ body: "a", videoId: VIDEO_ID }, { body: "x".repeat(20_001) }, {}]) {
      expect((await PUT(request("PUT", body), params())).status).toBe(400);
    }
    expect(setLessonNote).not.toHaveBeenCalled();
    expect(deleteLessonNote).not.toHaveBeenCalled();
  });

  it("saves and deletes idempotently", async () => {
    vi.mocked(setLessonNote).mockResolvedValue({ ok: true });
    vi.mocked(deleteLessonNote).mockResolvedValue({ ok: true });
    const saved = await PUT(request("PUT", { body: "lesson memo" }), params());
    await expect(saved.json()).resolves.toEqual({ data: { saved: true } });
    expect(setLessonNote).toHaveBeenLastCalledWith(VIDEO_ID, "lesson memo");

    const deleted = await DELETE(request("DELETE"), params());
    await expect(deleted.json()).resolves.toEqual({ data: { saved: false } });
    expect(deleteLessonNote).toHaveBeenLastCalledWith(VIDEO_ID);
  });

  it("maps refusals to 401, a generic 404 and 429 with Retry-After", async () => {
    vi.mocked(setLessonNote).mockResolvedValueOnce({ ok: false, status: 401 });
    expect((await PUT(request("PUT", { body: "a" }), params())).status).toBe(401);
    vi.mocked(setLessonNote).mockResolvedValueOnce({ ok: false, status: 404 });
    const missing = await PUT(request("PUT", { body: "a" }), params());
    await expect(missing.json()).resolves.toEqual({ error: "Not found" });
    vi.mocked(deleteLessonNote).mockResolvedValueOnce({ ok: false, status: 429, retryAfter: 1_000 });
    const limited = await DELETE(request("DELETE"), params());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("1");
  });
});
