import { describe, expect, it } from "vitest";
import { buildGroundedEntities } from "./grounding";
import type { ToolResult } from "./retrieval";

const dictionary: ToolResult = {
  tool: "dictionary_lookup", key: "dictionary_lookup:今日", status: "ok",
  data: { term: "今日", matches: [{ entSeq: 1, headword: "今日", reading: "きょう", glossEn: "today", jlpt: 5 }] },
};
const analysis: ToolResult = {
  tool: "line_analysis", key: "line_analysis", status: "ok",
  data: { tokens: [
    { surface: "今日", base: "今日", reading: "キョウ", pos: "名詞", entSeq: 1, headword: "今日", gloss: "today (dup)", jlpt: 5 },
    { surface: "晴れ", base: "晴れ", reading: "ハレ", pos: "名詞", entSeq: 2, headword: "晴れ", gloss: "clear weather", jlpt: 4 },
    { surface: "は", base: "は", reading: "ハ", pos: "助詞" },
  ], grammar: [] },
};
const exposure = (over: object): ToolResult => ({
  tool: "learner_exposure", key: "learner_exposure:は", status: "ok",
  data: { term: "は", identity: "tok:は:助詞", seenCount: 12, capped: false, label: "は", pos: "助詞", firstSeen: { videoId: "v1", lineId: "l1" }, ...over },
});

describe("buildGroundedEntities", () => {
  it("builds vocabulary from dictionary and analysis, merged by id, JLPT as a label", () => {
    const out = buildGroundedEntities([dictionary, analysis], new Set());
    expect(out).toEqual([
      { id: "ent:1", label: "今日", kind: "vocabulary", reading: "きょう", gloss: "today", jlpt: "N5" },
      { id: "ent:2", label: "晴れ", kind: "vocabulary", gloss: "clear weather", jlpt: "N4" },
    ]);
  });

  it("adds a particle from exposure with its count and a lesson link only to a readable video", () => {
    expect(buildGroundedEntities([exposure({})], new Set(["v1"]))).toEqual([
      { id: "tok:は:助詞", label: "は", kind: "particle", seenCount: 12, seenCapped: false, lessonLink: { videoId: "v1", lineId: "l1" } },
    ]);
    expect(buildGroundedEntities([exposure({})], new Set())[0]).not.toHaveProperty("lessonLink");
  });

  it("attaches the exposure count to a word the dictionary already grounded", () => {
    const out = buildGroundedEntities([dictionary, exposure({ identity: "ent:1", pos: "名詞", label: "今日", capped: true })], new Set());
    expect(out).toEqual([{ id: "ent:1", label: "今日", kind: "vocabulary", reading: "きょう", gloss: "today", jlpt: "N5", seenCount: 12, seenCapped: true }]);
  });

  it("ignores failed, empty and unseen results", () => {
    expect(buildGroundedEntities([
      { ...dictionary, status: "error", errorCode: "timeout" },
      { ...dictionary, status: "not_found", data: undefined },
      exposure({ seenCount: 0 }),
    ], new Set(["v1"]))).toEqual([]);
  });
});
