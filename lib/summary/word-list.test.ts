import { describe, expect, it } from "vitest";
import type { LessonVocabularyItem } from "@/lib/analysis/types";
import type { WordView } from "./analysis/view";
import { WORD_LIST_MAX, WORD_LIST_PAGE_SIZE, pageOf, printHref, wordRows } from "./word-list";

const ai = (entSeq: number): WordView => ({
  entSeq, surface: `s${entSeq}`, written: `w${entSeq}`, reading: `r${entSeq}`, meaning: `m${entSeq}`, meaningLocale: "en", meaningSource: "jmdict", posKey: "noun",
  jlpt: null, common: true, whyItMatters: "", usageNote: "", source: { lineId: `l${entSeq}`, textJp: "", startTime: 0, endTime: null },
});
const lesson = (entSeq: number, lines = [`x${entSeq}`]): LessonVocabularyItem => ({
  entSeq, headword: `h${entSeq}`, reading: `k${entSeq}`, glossEn: `g${entSeq}`, occurrences: 1, jlpt: null, vocabId: null, curatedVi: null,
  mastery: null, exampleLineIds: lines, exampleSurface: `e${entSeq}`,
});

describe("wordRows", () => {
  it("lists the AI words first, then the lesson's most frequent words it did not pick", () => {
    const rows = wordRows([ai(1), ai(2)], [lesson(2), lesson(3), lesson(4)], "en");
    expect(rows.map((row) => row.written)).toEqual(["w1", "w2", "h3", "h4"]);
    expect(rows[0]).toMatchObject({ reading: "r1", meaning: "m1", lineId: "l1", targetWord: "s1" });
    // Saved as the form in the line (exampleSurface), shown as the dictionary headword.
    expect(rows[2]).toMatchObject({ reading: "k3", meaning: "g3", lineId: "x3", targetWord: "e3" });
  });

  it("stops at WORD_LIST_MAX, skips lesson words with no line to save from, and works before the lesson words load", () => {
    const many = Array.from({ length: 40 }, (_, index) => lesson(100 + index));
    expect(wordRows([ai(1)], many, "en")).toHaveLength(WORD_LIST_MAX);
    expect(wordRows([], [lesson(5, [])], "en")).toEqual([]);
    expect(wordRows([ai(1)], null, "en").map((row) => row.written)).toEqual(["w1"]);
  });

  it("drops a second row that would save the same word on the same line (two dictionary entries, one form)", () => {
    const twin = { ...lesson(9, ["x8"]), exampleSurface: "ｅ8" };
    expect(wordRows([], [lesson(8), twin], "en").map((row) => row.key)).toEqual(["lesson-8"]);
  });
});

describe("wordRows meanings", () => {
  it("gives lesson rows a locale-aware meaning: curated vi, else JMdict English labelled en", () => {
    const curated = { ...lesson(3), curatedVi: "mưa" };
    expect(wordRows([], [curated, lesson(4)], "vi").map((row) => [row.meaning, row.meaningLocale, row.meaningSource]))
      .toEqual([["mưa", "vi", "curated"], ["g4", "en", "jmdict"]]);
    expect(wordRows([], [curated], "en")[0]).toMatchObject({ meaning: "g3", meaningLocale: "en" });
  });

  it("builds the print launcher link for a lesson", () => {
    expect(printHref("v-1")).toBe("/vocab/print?source=lesson&lesson=v-1&set=all");
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
