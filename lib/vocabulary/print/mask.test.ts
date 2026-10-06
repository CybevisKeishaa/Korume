import { describe, expect, it } from "vitest";
import type { VocabularyPrintItem } from "./source";
import { MASK_BLANK, maskSet, maskText, ownAnswerLocatable } from "./mask";

const item = (over: Partial<VocabularyPrintItem>): VocabularyPrintItem => ({ id: over.surface ?? "x", surface: "x", resolution: "resolved", ...over });
const line = "苦手な人について話します";
const spans = [{ surface: "苦手", entSeq: 1 }, { surface: "人", entSeq: 2 }, { surface: "話し", entSeq: 3 }];
const nigate = item({ surface: "苦手", entSeq: 1, example: { text: line, spans } });
const hito = item({ surface: "人", entSeq: 2 });
const hanasu = item({ surface: "話す", entSeq: 3 });

describe("document mask (spec W §1.4)", () => {
  it("collects every printed target and every span resolving to a printed item, longest first", () => {
    expect(maskSet([nigate, hito, hanasu])).toEqual(["苦手", "話し", "話す", "人"]); // stable sort: insertion order within a length
  });
  it("masks another printed item's answer and its inflected span inside this item's example", () => {
    expect(maskText(line, maskSet([nigate, hito, hanasu]))).toBe(`${MASK_BLANK}な${MASK_BLANK}について${MASK_BLANK}ます`);
  });
  it("leaves a word that is not printed", () => {
    expect(maskText(line, maskSet([nigate]))).toBe(`${MASK_BLANK}な人について話します`);
  });
  it("masks every occurrence and treats regex characters literally", () => {
    expect(maskText("人と人", ["人"])).toBe(`${MASK_BLANK}と${MASK_BLANK}`);
    expect(maskText("a.b a+b", ["a.b"])).toBe(`${MASK_BLANK} a+b`);
    expect(maskText("そのまま", [])).toBe("そのまま");
  });
  it("locates an item's own answer by its entSeq span or by its written form", () => {
    expect(ownAnswerLocatable(hanasu)).toBe(false); // no example at all
    expect(ownAnswerLocatable(item({ surface: "話す", entSeq: 3, example: { text: line, spans } }))).toBe(true); // via span 話し
    expect(ownAnswerLocatable(item({ surface: "消えた", resolution: "saved_raw", example: { text: "火が消えた", spans: [] } }))).toBe(true);
    expect(ownAnswerLocatable(item({ surface: "行く", entSeq: 9, example: { text: "行った", spans: [] } }))).toBe(false);
  });
});
