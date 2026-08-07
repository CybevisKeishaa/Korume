import { describe, expect, it } from "vitest";
import {
  isAnswerValue,
  parseSectionConfig,
  reviewHrefForSection,
  totalMinutes,
  totalQuestionCount,
} from "./jlpt-ui";

describe("parseSectionConfig", () => {
  it("parses a well-formed section_config", () => {
    const raw = {
      sections: [
        { section: "vocab", question_count: 12, time_limit_minutes: 20 },
        { section: "listening", question_count: 6, time_limit_minutes: 15 },
      ],
    };
    expect(parseSectionConfig(raw)).toEqual([
      { section: "vocab", question_count: 12, time_limit_minutes: 20 },
      { section: "listening", question_count: 6, time_limit_minutes: 15 },
    ]);
  });

  it("drops entries with an invalid section name", () => {
    const raw = { sections: [{ section: "kanji", question_count: 5, time_limit_minutes: 10 }] };
    expect(parseSectionConfig(raw)).toEqual([]);
  });

  it("drops entries missing numeric fields", () => {
    const raw = { sections: [{ section: "vocab", question_count: "12", time_limit_minutes: 20 }] };
    expect(parseSectionConfig(raw)).toEqual([]);
  });

  it("returns [] for null, undefined, and non-object input", () => {
    expect(parseSectionConfig(null)).toEqual([]);
    expect(parseSectionConfig(undefined)).toEqual([]);
    expect(parseSectionConfig("not an object")).toEqual([]);
    expect(parseSectionConfig({})).toEqual([]);
  });
});

describe("totalMinutes / totalQuestionCount", () => {
  const entries = [
    { section: "vocab" as const, question_count: 12, time_limit_minutes: 20 },
    { section: "grammar" as const, question_count: 10, time_limit_minutes: 20 },
    { section: "listening" as const, question_count: 6, time_limit_minutes: 15 },
  ];

  it("sums time limits", () => {
    expect(totalMinutes(entries)).toBe(55);
  });

  it("sums question counts", () => {
    expect(totalQuestionCount(entries)).toBe(28);
  });

  it("returns 0 for an empty list", () => {
    expect(totalMinutes([])).toBe(0);
    expect(totalQuestionCount([])).toBe(0);
  });
});

describe("reviewHrefForSection", () => {
  it("routes each section to its study module, scoped by level", () => {
    expect(reviewHrefForSection("vocab", "N4")).toBe("/vocab?level=N4");
    expect(reviewHrefForSection("grammar", "N4")).toBe("/grammar?level=N4");
    expect(reviewHrefForSection("reading", "N4")).toBe("/reading?level=N4");
    expect(reviewHrefForSection("listening", "N4")).toBe("/shadowing?level=N4");
  });
});

describe("isAnswerValue", () => {
  it("accepts only '0'..'3'", () => {
    expect(isAnswerValue("0")).toBe(true);
    expect(isAnswerValue("3")).toBe(true);
    expect(isAnswerValue("4")).toBe(false);
    expect(isAnswerValue("a")).toBe(false);
  });
});
