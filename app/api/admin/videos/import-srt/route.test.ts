import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { importVideoFromSrt } from "@/lib/data/admin-videos";

vi.mock("@/lib/data/admin-videos", () => ({ importVideoFromSrt: vi.fn() }));

const BODY = {
  youtubeUrl: "https://www.youtube.com/watch?v=kIDaXEnkjmk&t=356s",
  libraryAccess: "FREE",
  format: "srt",
  content: "1\n00:00:01,000 --> 00:00:04,000\nこんにちは\n",
  translation: "1\n00:00:01,000 --> 00:00:04,000\nXin chào\n",
};

function post(body: unknown) {
  return POST(new Request("http://localhost/api/admin/videos/import-srt", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(importVideoFromSrt).mockResolvedValue({
    ok: true,
    data: { videoId: "v1", created: true, lineCount: 1, translatedCount: 1 },
  });
});

describe("POST /api/admin/videos/import-srt", () => {
  it("imports by the id parsed from any YouTube URL form and answers 201 for a new lesson", async () => {
    const response = await post(BODY);

    expect(response.status).toBe(201);
    expect(importVideoFromSrt).toHaveBeenCalledWith(expect.objectContaining({
      youtubeVideoId: "kIDaXEnkjmk",
      libraryAccess: "FREE",
      format: "srt",
      content: BODY.content,
      translation: BODY.translation,
    }));
  });

  it("answers 200 when it replaced an existing lesson's transcript", async () => {
    vi.mocked(importVideoFromSrt).mockResolvedValue({
      ok: true,
      data: { videoId: "v1", created: false, lineCount: 1, translatedCount: 0 },
    });
    expect((await post(BODY)).status).toBe(200);
  });

  it.each([
    ["a plain transcript, which has no times to align a translation by", { ...BODY, format: "plain" }],
    ["a PRIVATE access level", { ...BODY, libraryAccess: "PRIVATE" }],
    ["an unrecognised URL", { ...BODY, youtubeUrl: "https://example.com/watch" }],
    ["an empty translation file", { ...BODY, translation: "" }],
  ])("refuses %s before the data layer", async (_, body) => {
    expect((await post(body)).status).toBe(400);
    expect(importVideoFromSrt).not.toHaveBeenCalled();
  });

  it("passes `replace` through and answers 409 with `exists` when the video already has a lesson", async () => {
    vi.mocked(importVideoFromSrt).mockResolvedValue({ ok: false, status: 409, exists: true });
    const response = await post({ ...BODY, replace: false });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ exists: true });
    expect(importVideoFromSrt).toHaveBeenCalledWith(expect.objectContaining({ replace: false }));
  });

  it("names the field problem the admin can fix", async () => {
    const response = await post({ ...BODY, content: "x".repeat(200_001) });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Subtitle file is too long (max 200,000 characters)." });
  });

  it("says when YouTube metadata is the problem", async () => {
    vi.mocked(importVideoFromSrt).mockResolvedValue({ ok: false, status: 503 });
    const response = await post(BODY);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Could not read this video's title and thumbnail from YouTube" });
  });
});
