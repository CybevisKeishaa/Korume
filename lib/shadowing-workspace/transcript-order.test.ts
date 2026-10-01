import { describe, expect, it } from "vitest";
import { canonicalLines } from "./transcript-order";

describe("canonicalLines", () => {
  it("sorts by time then id, assigns indexes, and narrows furigana", () => {
    const lines = canonicalLines([
      { id: "c", start_time: 12.96, end_time: null, text_jp: "C", text_translation: null, furigana_json: "bad" },
      { id: "b", start_time: 1, end_time: 2, text_jp: "B", text_translation: "bee", furigana_json: [{ text: "B" }] },
      { id: "a", start_time: 1, end_time: 2, text_jp: "A", text_translation: null, furigana_json: null },
    ]);

    expect(lines.map(({ id, index, startTime }) => ({ id, index, startTime }))).toEqual([
      { id: "a", index: 0, startTime: 1 },
      { id: "b", index: 1, startTime: 1 },
      { id: "c", index: 2, startTime: 12.96 },
    ]);
    expect(lines[1]?.furigana).toEqual([{ text: "B" }]);
    expect(lines[0]?.furigana).toBeNull();
    expect(lines[2]?.furigana).toBeNull();
  });
});
