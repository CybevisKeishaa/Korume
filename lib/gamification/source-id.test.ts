import { describe, expect, it } from "vitest";
import { sourceIdFor } from "./source-id";

const NOW = new Date("2026-07-12T04:00:00.000Z"); // VN 2026-07-12

describe("sourceIdFor — idempotency keys per natural learning unit per VN day", () => {
  it("srs_review: itemType:itemId:vnDate", () => {
    expect(sourceIdFor("srs_review", { itemType: "kanji", itemId: "abc-1" }, NOW)).toBe(
      "kanji:abc-1:2026-07-12",
    );
    expect(sourceIdFor("srs_review", { itemType: "vocab", itemId: "abc-2" }, NOW)).toBe(
      "vocab:abc-2:2026-07-12",
    );
  });

  it("dictation: lineId:vnDate", () => {
    expect(sourceIdFor("dictation", { lineId: "line-1" }, NOW)).toBe("line-1:2026-07-12");
  });

  it("shadowing: lineId:vnDate", () => {
    expect(sourceIdFor("shadowing", { lineId: "line-2" }, NOW)).toBe("line-2:2026-07-12");
  });

  it("mining_review: cardId:vnDate", () => {
    expect(sourceIdFor("mining_review", { cardId: "card-9" }, NOW)).toBe("card-9:2026-07-12");
  });

  it("jlpt_submit: testId:mode:vnDate", () => {
    expect(sourceIdFor("jlpt_submit", { testId: "test-n4-1", mode: "section" }, NOW)).toBe(
      "test-n4-1:section:2026-07-12",
    );
    expect(sourceIdFor("jlpt_submit", { testId: "test-n4-1", mode: "full" }, NOW)).toBe(
      "test-n4-1:full:2026-07-12",
    );
  });

  it("reading_submit: passageId:vnDate", () => {
    expect(sourceIdFor("reading_submit", { passageId: "passage-5" }, NOW)).toBe(
      "passage-5:2026-07-12",
    );
  });

  it("conversation: sessionId only, no date component (session ids are already unique)", () => {
    expect(sourceIdFor("conversation", { sessionId: "sess-77" }, NOW)).toBe("sess-77");
  });

  it("uses the VN calendar date, not the raw UTC date, across the day line", () => {
    const lateUtc = new Date("2026-07-12T17:30:00.000Z"); // VN 2026-07-13
    expect(sourceIdFor("dictation", { lineId: "line-1" }, lateUtc)).toBe("line-1:2026-07-13");
  });

  it("throws when required parts are missing for a source", () => {
    expect(() => sourceIdFor("srs_review", { itemId: "abc-1" } as never, NOW)).toThrow();
    expect(() => sourceIdFor("jlpt_submit", { testId: "t1" } as never, NOW)).toThrow();
    expect(() => sourceIdFor("conversation", {} as never, NOW)).toThrow();
  });
});
