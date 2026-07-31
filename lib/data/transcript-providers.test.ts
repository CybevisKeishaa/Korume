import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/youtube", () => ({ fetchJapaneseCaptions: vi.fn() }));

import { fetchJapaneseCaptions } from "@/lib/youtube";
import { aiTranscriptProvider, youtubeCaptionProvider } from "./transcript-providers";

const VIDEO_ID = "dQw4w9WgXcQ";

beforeEach(() => {
  vi.mocked(fetchJapaneseCaptions).mockReset();
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
});

describe("aiTranscriptProvider", () => {
  it("is a typed not-implemented stub", async () => {
    await expect(aiTranscriptProvider.fetch(VIDEO_ID)).resolves.toEqual({
      ok: false,
      status: 501,
    });
  });
});
