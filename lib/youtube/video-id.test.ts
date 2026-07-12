import { describe, expect, it } from "vitest";
import { parseVideoId } from "./video-id";

const ID = "dQw4w9WgXcQ";

describe("parseVideoId — accepted forms", () => {
  it("parses a standard watch URL", () => {
    expect(parseVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("parses a watch URL with extra query params and a timestamp", () => {
    expect(
      parseVideoId(`https://www.youtube.com/watch?v=${ID}&list=PL123&t=42s&index=3`),
    ).toBe(ID);
  });

  it("parses a watch URL without protocol", () => {
    expect(parseVideoId(`youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("parses a mobile (m.) watch URL", () => {
    expect(parseVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("parses a youtu.be short link", () => {
    expect(parseVideoId(`https://youtu.be/${ID}`)).toBe(ID);
  });

  it("parses a youtu.be short link with a timestamp query", () => {
    expect(parseVideoId(`https://youtu.be/${ID}?t=10`)).toBe(ID);
  });

  it("parses a Shorts URL", () => {
    expect(parseVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
  });

  it("parses an embed URL", () => {
    expect(parseVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
  });

  it("parses a legacy /v/ URL", () => {
    expect(parseVideoId(`https://www.youtube.com/v/${ID}`)).toBe(ID);
  });

  it("parses a bare 11-char ID", () => {
    expect(parseVideoId(ID)).toBe(ID);
  });

  it("trims surrounding whitespace", () => {
    expect(parseVideoId(`  ${ID}  `)).toBe(ID);
    expect(parseVideoId(`  https://youtu.be/${ID}  `)).toBe(ID);
  });

  it("is case-insensitive on the host", () => {
    expect(parseVideoId(`https://WWW.YouTube.com/watch?v=${ID}`)).toBe(ID);
  });
});

describe("parseVideoId — rejected input", () => {
  it("rejects an empty or whitespace-only string", () => {
    expect(parseVideoId("")).toBeNull();
    expect(parseVideoId("   ")).toBeNull();
  });

  it("rejects a non-YouTube domain", () => {
    expect(parseVideoId(`https://vimeo.com/watch?v=${ID}`)).toBeNull();
  });

  it("rejects an ID that is too short or too long", () => {
    expect(parseVideoId("short")).toBeNull();
    expect(parseVideoId(`${ID}XX`)).toBeNull();
  });

  it("rejects an ID with invalid characters", () => {
    expect(parseVideoId("dQw4w9WgX!Q")).toBeNull();
  });

  it("rejects a watch URL with a missing or empty v param", () => {
    expect(parseVideoId("https://www.youtube.com/watch")).toBeNull();
    expect(parseVideoId("https://www.youtube.com/watch?v=")).toBeNull();
  });

  it("rejects a youtube.com URL with an unrecognized path", () => {
    expect(parseVideoId("https://www.youtube.com/channel/UC123456789")).toBeNull();
    expect(parseVideoId("https://www.youtube.com/")).toBeNull();
  });

  it("rejects garbage text", () => {
    expect(parseVideoId("not a url at all")).toBeNull();
  });

  it("rejects a youtu.be URL with no path", () => {
    expect(parseVideoId("https://youtu.be/")).toBeNull();
  });
});
