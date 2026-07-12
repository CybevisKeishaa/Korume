import { describe, expect, it } from "vitest";
import { parseVideoId } from "@/lib/youtube";
import { YOUTUBE_URL_FIXTURES } from "./youtube-urls";

describe("YOUTUBE_URL_FIXTURES against the real lib/youtube parser", () => {
  it.each(YOUTUBE_URL_FIXTURES)(
    "parseVideoId($url) -> $expectedVideoId",
    ({ url, expectedVideoId }) => {
      expect(parseVideoId(url)).toBe(expectedVideoId);
    },
  );
});

describe("YOUTUBE_URL_FIXTURES", () => {
  it("has both valid and invalid cases", () => {
    expect(YOUTUBE_URL_FIXTURES.some((f) => f.expectedVideoId !== null)).toBe(true);
    expect(YOUTUBE_URL_FIXTURES.some((f) => f.expectedVideoId === null)).toBe(true);
  });

  it("every expected video id, when present, is exactly 11 chars of [A-Za-z0-9_-]", () => {
    for (const { expectedVideoId } of YOUTUBE_URL_FIXTURES) {
      if (expectedVideoId !== null) {
        expect(expectedVideoId).toMatch(/^[A-Za-z0-9_-]{11}$/);
      }
    }
  });

  it("covers watch?v=, youtu.be/, shorts/, and embed/ URL shapes", () => {
    const urls = YOUTUBE_URL_FIXTURES.map((f) => f.url);
    expect(urls.some((u) => u.includes("watch?v="))).toBe(true);
    expect(urls.some((u) => u.includes("youtu.be/"))).toBe(true);
    expect(urls.some((u) => u.includes("/shorts/"))).toBe(true);
    expect(urls.some((u) => u.includes("/embed/"))).toBe(true);
  });
});
