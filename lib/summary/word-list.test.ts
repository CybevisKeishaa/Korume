import { describe, expect, it } from "vitest";
import type { LessonVocabularyItem } from "@/lib/analysis/types";
import type { WordView } from "./analysis/view";
import { WORD_LIST_MAX, WORD_LIST_PAGE_SIZE, pageOf, wordRows } from "./word-list";

const ai = (entSeq: number): WordView => ({
  entSeq, surface: `s${entSeq}`, written: `w${entSeq}`, reading: `r${entSeq}`, meaning: `m${entSeq}`, posKey: "noun",
  jlpt: null, common: true, whyItMatters: "", usageNote: "", source: { lineId: `l${entSeq}`, textJp: "", startTime: 0, endTime: null },
});
const lesson = (entSeq: number, lines = [`x${entSeq}`]): LessonVocabularyItem => ({
  entSeq, headword: `h${entSeq}`, reading: `k${entSeq}`, glossEn: `g${entSeq}`, occurrences: 1, jlpt: null, vocabId: null,
  mastery: null, exampleLineIds: lines, exampleSurface: `e${entSeq}`,
});

describe("wordRows", () => {
  it("lists the AI words first, then the lesson's most frequent words it did not pick", () => {
    const rows = wordRows([ai(1), ai(2)], [lesson(2), lesson(3), lesson(4)]);
    expect(rows.map((row) => row.written)).toEqual(["w1", "w2", "h3", "h4"]);
    expect(rows[0]).toMatchObject({ reading: "r1", meaning: "m1", lineId: "l1", targetWord: "s1" });
    // Saved as the form in the line (exampleSurface), shown as the dictionary headword.
    expect(rows[2]).toMatchObject({ reading: "k3", meaning: "g3", lineId: "x3", targetWord: "e3" });
  });

  it("stops at WORD_LIST_MAX, skips lesson words with no line to save from, and works before the lesson words load", () => {
    const many = Array.from({ length: 40 }, (_, index) => lesson(100 + index));
    expect(wordRows([ai(1)], many)).toHaveLength(WORD_LIST_MAX);
    expect(wordRows([], [lesson(5, [])])).toEqual([]);
    expect(wordRows([ai(1)], null).map((row) => row.written)).toEqual(["w1"]);
  });

  it("drops a second row that would save the same word on the same line (two dictionary entries, one form)", () => {
    const twin = { ...lesson(9, ["x8"]), exampleSurface: "ｅ8" };
    expect(wordRows([], [lesson(8), twin]).map((row) => row.key)).toEqual(["lesson-8"]);
  });
});

describe("pageOf", () => {
  it("cuts pages of WORD_LIST_PAGE_SIZE and clamps the page into range", () => {
    const rows = Array.from({ length: 20 }, (_, index) => index);
    expect(WORD_LIST_PAGE_SIZE).toBe(8);
    expect(pageOf(rows, 0)).toEqual({ items: rows.slice(0, 8), page: 0, pageCount: 3 });
    expect(pageOf(rows, 2).items).toEqual(rows.slice(16));
    expect(pageOf(rows, 9).page).toBe(2);
    expect(pageOf([], 0)).toEqual({ items: [], page: 0, pageCount: 1 });
  });
});
