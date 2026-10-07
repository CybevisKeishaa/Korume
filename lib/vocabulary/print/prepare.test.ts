import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSHEET_SETTINGS, type WorksheetSettings } from "./settings";
import type { VocabularyPrintItem } from "./source";
import { maskSet } from "./mask";
import { prepareDocument } from "./prepare";

const line = "苦手な人について話します";
const spans = [{ surface: "苦手", entSeq: 1 }, { surface: "人", entSeq: 2 }, { surface: "話し", entSeq: 3 }];
const items: VocabularyPrintItem[] = [
  { id: "a", surface: "苦手", entSeq: 1, reading: "にがて", meaning: "kém", meaningLocale: "vi", resolution: "resolved", example: { text: line, spans } },
  { id: "b", surface: "人", entSeq: 2, reading: "ひと", meaning: "người", meaningLocale: "vi", resolution: "resolved", example: { text: line, spans } },
  { id: "c", surface: "話す", entSeq: 3, reading: "はなす", meaning: "nói", meaningLocale: "vi", resolution: "resolved", example: { text: line, spans } },
  { id: "d", surface: "する", entSeq: 4, reading: "する", meaning: "làm", meaningLocale: "vi", resolution: "resolved" },
  { id: "e", surface: "Tシャツ", entSeq: 5, reading: "ティーシャツ", resolution: "resolved" },
  { id: "f", surface: "消えた", resolution: "saved_raw" },
];
const all = new Set(items.map((item) => item.id));
const selfTest = (over: Partial<WorksheetSettings> = {}) => ({ ...DEFAULT_WORKSHEET_SETTINGS, mode: "selfTest" as const, showExample: true, ...over });

describe("prepareDocument — selection and kana (spec W W4, §1.3)", () => {
  it("keeps document order, numbers from 1, and drops words without kanji by default", () => {
    const doc = prepareDocument(items, all, DEFAULT_WORKSHEET_SETTINGS);
    expect(doc.items.map((item) => [item.id, item.number])).toEqual([["a", 1], ["b", 2], ["c", 3], ["f", 4]]);
  });
  it("adds them back with includeKanaOnly, and respects the selection", () => {
    const doc = prepareDocument(items, new Set(["d", "e", "a"]), { ...DEFAULT_WORKSHEET_SETTINGS, includeKanaOnly: true });
    expect(doc.items.map((item) => item.id)).toEqual(["a", "d", "e"]);
  });
});

describe("prepareDocument — practice (spec W §3.1)", () => {
  it("prints the example by default; it shares the stroke-guide row, so it costs no height (owner 2026-10-07)", () => {
    expect(prepareDocument(items, new Set(["a"]), DEFAULT_WORKSHEET_SETTINGS).items[0]?.example).toBe(line);
  });
  it("shows the target and glyphs, the toggled metadata and the raw example, and has no answers", () => {
    const doc = prepareDocument(items, new Set(["a"]), { ...DEFAULT_WORKSHEET_SETTINGS, showMeaning: false, showExample: true });
    expect(doc.items[0]).toEqual({ id: "a", number: 1, cells: 2, target: "苦手", glyphs: ["苦", "手"], reading: "にがて", example: line });
    expect(doc.answers).toEqual([]);
  });
});

describe("prepareDocument — self-test never leaks (spec W W6, §1.4, §2)", () => {
  it("carries no target or glyphs on items, and masks every printed answer in every example", () => {
    const doc = prepareDocument(items, all, selfTest({ includeKanaOnly: true }));
    for (const item of doc.items) {
      expect(item.target).toBeUndefined();
      expect(item.glyphs).toBeUndefined();
    }
    expect(doc.items.find((item) => item.id === "a")?.example).toBe("＿＿な＿＿について＿＿ます");
    expect(doc.items.find((item) => item.id === "c")?.example).toBe("＿＿な＿＿について＿＿ます");
  });
  it("masks another printed item's inflected span: deselecting 話す leaves 話し visible", () => {
    const doc = prepareDocument(items, new Set(["a", "b"]), selfTest());
    expect(doc.items[0]?.example).toBe("＿＿な＿＿について話します");
  });
  it("drops a reading that reveals the target but keeps a differing one", () => {
    const doc = prepareDocument(items, new Set(["d", "e"]), selfTest({ includeKanaOnly: true, showMeaning: false }));
    const suru = doc.items.find((item) => item.id === "d");
    expect(suru?.reading).toBeUndefined();
    expect(suru?.meaning).toBe("làm"); // fallback: no enabled prompt left, meaning exists
    expect(doc.items.find((item) => item.id === "e")?.reading).toBe("ティーシャツ");
  });
  it("drops an example whose own answer cannot be located, then falls back or excludes", () => {
    const doc = prepareDocument(items, new Set(["f"]), selfTest({ showReading: false, showMeaning: false }));
    expect(doc.items).toEqual([]);
    expect(doc.excluded).toEqual(["f"]);
  });
  it("property: no mask string of the printed set occurs in any printed example or reading prompt", () => {
    const pool: VocabularyPrintItem[] = [...items,
      { id: "g", surface: "ひと", entSeq: 6, reading: "ひと", meaning: "người (kana)", meaningLocale: "vi", resolution: "resolved" },
      { id: "h", surface: "一人", entSeq: 7, reading: "ひとり", resolution: "resolved", example: { text: "一人で話した", spans: [{ surface: "一人", entSeq: 7 }, { surface: "話し", entSeq: 3 }] } }];
    const on = [true, false];
    for (const ids of [pool.map((item) => item.id), ["b", "g", "h"], ["a", "c", "h"]]) for (const includeKanaOnly of on) for (const showReading of on) for (const showMeaning of on) for (const showExample of on) {
      const doc = prepareDocument(pool, new Set(ids), selfTest({ includeKanaOnly, showReading, showMeaning, showExample }));
      const printed = new Set(doc.items.map((item) => item.id));
      const mask = maskSet(pool.filter((item) => printed.has(item.id)));
      for (const item of doc.items) for (const text of [item.example, item.reading]) for (const blank of text ? mask : []) expect(text, `${item.id}: ${blank}`).not.toContain(blank);
    }
  });
  it("drops a reading prompt that contains another printed answer, then falls back (meaning) or excludes", () => {
    const hito: VocabularyPrintItem = { id: "b", surface: "人", entSeq: 2, reading: "ひと", meaning: "người", meaningLocale: "vi", resolution: "resolved" };
    const pool: VocabularyPrintItem[] = [hito, { id: "g", surface: "ひと", entSeq: 6, reading: "ひと", meaning: "người (kana)", meaningLocale: "vi", resolution: "resolved" },
      { id: "r", surface: "一人", entSeq: 7, reading: "ひとり", resolution: "resolved" }];
    const doc = prepareDocument(pool, new Set(["b", "g", "r"]), selfTest({ includeKanaOnly: true, showMeaning: false, showExample: false }));
    expect(doc.items.map((item) => [item.id, item.reading, item.meaning])).toEqual([["b", undefined, "người"], ["g", undefined, "người (kana)"]]);
    expect(doc.excluded).toEqual(["r"]); // ひとり contains ひと, and 一人 has no meaning or example to fall back on
    expect(doc.answers.map((answer) => [answer.id, answer.number])).toEqual([["b", 1], ["g", 2]]);
  });
  it("lists answers in item order with the target, and the reading only when it does not reveal it", () => {
    const doc = prepareDocument(items, new Set(["a", "d"]), selfTest({ includeKanaOnly: true }));
    expect(doc.answers).toEqual([
      { id: "a", number: 1, target: "苦手", reading: "にがて" },
      { id: "d", number: 2, target: "する" },
    ]);
  });
});
