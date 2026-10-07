import { describe, expect, it } from "vitest";
import { DAILY_SOURCES, sourceIdFor } from "./source-id";

describe("sourceIdFor", () => {
  it.each([
    ["srs_review", { itemType: "kanji", itemId: "abc-1" }, "kanji:abc-1"],
    ["srs_review", { itemType: "vocab", itemId: "abc-2" }, "vocab:abc-2"],
    ["dictation", { lineId: "line-1" }, "line-1"],
    ["shadowing", { lineId: "line-2" }, "line-2"],
    ["mining_review", { cardId: "card-9" }, "card-9"],
    ["jlpt_submit", { testId: "test-n4-1", mode: "section" }, "test-n4-1:section"],
    ["jlpt_submit", { testId: "test-n4-1", mode: "full" }, "test-n4-1:full"],
    ["reading_submit", { passageId: "passage-5" }, "passage-5"],
    ["conversation", { sessionId: "sess-77" }, "sess-77"],
  ] as const)("%s uses a date-free natural key", (source, parts, expected) => {
    expect(sourceIdFor(source, parts)).toBe(expected);
  });

  it("returns the same key on repeated calls", () => {
    expect(sourceIdFor("dictation", { lineId: "line-1" })).toBe(sourceIdFor("dictation", { lineId: "line-1" }));
  });

  it("lists the daily award sources", () => {
    expect(DAILY_SOURCES).toEqual(["srs_review", "dictation", "shadowing", "mining_review", "jlpt_submit", "reading_submit"]);
  });

  it("rejects missing required parts", () => {
    expect(() => sourceIdFor("srs_review", { itemId: "abc-1" })).toThrow();
    expect(() => sourceIdFor("jlpt_submit", { testId: "t1" })).toThrow();
    expect(() => sourceIdFor("conversation", {})).toThrow();
  });
});
