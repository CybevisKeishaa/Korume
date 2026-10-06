import { describe, expect, it } from "vitest";
import { parsePrintQuery } from "./source";

const LESSON = "ba522023-8eba-4929-924f-35ae69eacf99";

describe("parsePrintQuery (spec §2.1)", () => {
  it("reads a lesson source and defaults the set to all", () => {
    expect(parsePrintQuery({ source: "lesson", lesson: LESSON })).toEqual({ kind: "lesson", lessonId: LESSON, set: "all" });
    expect(parsePrintQuery({ source: "lesson", lesson: LESSON, set: "saved" })).toMatchObject({ set: "saved" });
  });
  it("rejects anything else", () => {
    for (const query of [{}, { source: "deck", lesson: LESSON }, { source: "lesson", lesson: "not-a-uuid" },
      { source: "lesson", lesson: LESSON, set: "mine" }, { source: ["lesson", "lesson"], lesson: LESSON }]) {
      expect(parsePrintQuery(query)).toBeNull();
    }
  });
});
