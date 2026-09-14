import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/youtube", () => ({
  fetchJapaneseCaptions: vi.fn(),
  fetchJapaneseCaptionsForWorker: vi.fn(),
}));

import { fetchJapaneseCaptions, fetchJapaneseCaptionsForWorker } from "@/lib/youtube";
import { TransientLessonCreationProviderError } from "@/lib/lesson-creation/worker";
import { aiTranscriptProvider, youtubeCaptionProvider } from "./transcript-providers";

const VIDEO_ID = "dQw4w9WgXcQ";

beforeEach(() => {
  vi.mocked(fetchJapaneseCaptions).mockReset();
  vi.mocked(fetchJapaneseCaptionsForWorker).mockReset();
});

describe("youtubeCaptionProvider", () => {
  it("returns transcript lines with source 'youtube_caption' when captions exist", async () => {
    vi.mocked(fetchJapaneseCaptions).mockResolvedValue([
      { startTime: 0, endTime: 2, textJp: "こんにちは" },
    ]);

    const result = await youtubeCaptionProvider.fetch(VIDEO_ID);

    expect(result).toEqual({
      source: "youtube_caption",
      lines: [{ startTime: 0, endTime: 2, textJp: "こんにちは", textTranslation: null }],
    });
  });

  it("returns null when fetchJapaneseCaptions returns null", async () => {
    vi.mocked(fetchJapaneseCaptions).mockResolvedValue(null);
    await expect(youtubeCaptionProvider.fetch(VIDEO_ID)).resolves.toBeNull();
  });

  it("exposes typed transient caption errors on the worker path", async () => {
    const error = new TransientLessonCreationProviderError("caption timedtext transport failed");
    vi.mocked(fetchJapaneseCaptionsForWorker).mockRejectedValue(error);

    await expect(youtubeCaptionProvider.fetchForWorker(VIDEO_ID)).rejects.toBe(error);
  });
});

describe("aiTranscriptProvider", () => {
  it("is a typed not-implemented stub", async () => {
    await expect(aiTranscriptProvider.fetch(VIDEO_ID)).resolves.toEqual({
      ok: false,
      status: 501,
    });
  });
});
