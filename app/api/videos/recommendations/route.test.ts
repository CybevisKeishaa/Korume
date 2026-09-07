import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getRecommendations } from "@/lib/data/recommendations";

vi.mock("@/lib/data/recommendations", () => ({ getRecommendations: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe("GET /api/videos/recommendations", () => {
  it("returns the measured recommendation reason as structured data, not server-authored explanation copy", async () => {
    vi.mocked(getRecommendations).mockResolvedValue({
      ok: true,
      data: [
        {
          videoId: "v1",
          youtubeVideoId: "yt1",
          title: "Lesson",
          thumbnailUrl: null,
          jlptLevelEstimate: "N5",
          knownRatio: 0.82,
          band: "ideal",
          totalWords: 100,
          knownWords: 82,
          reason: { kind: "known-word-fit", knownRatio: 0.82, totalWords: 100, knownWords: 82 },
        },
      ],
    });

    const response = await GET(new Request("http://localhost/api/videos/recommendations?limit=1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [
        expect.objectContaining({
          reason: { kind: "known-word-fit", knownRatio: 0.82, totalWords: 100, knownWords: 82 },
        }),
      ],
    });
  });
});
