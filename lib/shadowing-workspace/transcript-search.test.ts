import { describe, expect, it } from "vitest";
import { matchingLineIndexes } from "./transcript-search";
import type { WorkspaceLine } from "./types";

const lines: WorkspaceLine[] = [
  { id: "a", index: 0, startTime: 0, endTime: 1, textJp: "日本語です", textTranslation: "Bạn khỏe", furigana: null },
  { id: "b", index: 1, startTime: 1, endTime: 2, textJp: "猫です", textTranslation: null, furigana: null },
];

describe("matchingLineIndexes", () => {
  it("returns all indexes for blank search", () => {
    expect(matchingLineIndexes(lines, "")).toEqual([0, 1]);
    expect(matchingLineIndexes(lines, "  ")).toEqual([0, 1]);
  });

  it("matches Japanese and locale-insensitive Vietnamese text", () => {
    expect(matchingLineIndexes(lines, "本語")).toEqual([0]);
    expect(matchingLineIndexes(lines, "BẠN")).toEqual([0]);
    expect(matchingLineIndexes(lines, "Bạn".normalize("NFD"))).toEqual([0]); // decomposed (NFD) input still matches
    expect(matchingLineIndexes(lines, "missing")).toEqual([]);
  });
});
