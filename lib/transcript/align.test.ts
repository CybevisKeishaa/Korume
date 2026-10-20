import { describe, expect, it } from "vitest";
import { alignTranslations, parseBilingualTranscript } from "./align";

describe("alignTranslations", () => {
  it("joins every cue into the line it overlaps most and leaves uncovered lines null", () => {
    const line = (startTime: number, endTime: number) => ({ startTime, endTime, textJp: "日本語" });
    expect(alignTranslations(
      [line(0, 2), line(2, 4), line(4, 6)],
      [
        { startTime: 0, endTime: 1, textJp: "Một" },
        { startTime: 1, endTime: 2.4, textJp: "hai" },
        { startTime: 2.4, endTime: 2.6, textJp: "ba" },
        { startTime: 6, endTime: 7, textJp: "chạm mép" },
      ],
    )).toEqual(["Một hai", "ba", null]);
  });

  it("never places a cue without an end time", () => {
    expect(alignTranslations([{ startTime: 0, endTime: 2 }], [{ startTime: 1, endTime: null, textJp: "x" }])).toEqual([null]);
  });
});

describe("parseBilingualTranscript", () => {
  const ja = `1
00:00:01,000 --> 00:00:04,000
こんにちは

2
00:00:04,000 --> 00:00:08,000
元気ですか
`;
  // A creator's own track: split differently, and one cue carries markup.
  const vi = `1
00:00:01,000 --> 00:00:02,500
Xin chào

2
00:00:02,500 --> 00:00:03,900
<i>các bạn</i>
`;

  it("attaches the time-aligned, sanitized translation and leaves an uncovered line without one", () => {
    expect(parseBilingualTranscript(ja, vi, "srt")).toEqual([
      { startTime: 1, endTime: 4, textJp: "こんにちは", textTranslation: "Xin chào các bạn" },
      { startTime: 4, endTime: 8, textJp: "元気ですか" },
    ]);
  });

  it("is the plain parse when there is no translation file", () => {
    expect(parseBilingualTranscript(ja, null, "srt")).toEqual([
      { startTime: 1, endTime: 4, textJp: "こんにちは" },
      { startTime: 4, endTime: 8, textJp: "元気ですか" },
    ]);
  });
});
