import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_PRINT_SETTINGS } from "@/lib/vocabulary/print/settings";
import type { VocabularyPrintItem } from "@/lib/vocabulary/print/source";
import { PrintSheets, type SheetLabels } from "./print-sheets";

const labels: SheetLabels = {
  wordmark: "KORUME", documentName: "Vocabulary review", title: "苦手な人", footer: "Korume · Vocabulary review",
  pageNumber: (page, count) => `${page} / ${count}`, englishMeaning: "EN",
};
const vi: VocabularyPrintItem = { id: "a", surface: "苦手", reading: "にがて", meaning: "kém", meaningLocale: "vi", meaningSource: "curated", resolution: "resolved", example: { text: "今回はね「私の苦手な人」について話します" } };
const en: VocabularyPrintItem = { id: "b", surface: "人", reading: "ひと", meaning: "person", meaningLocale: "en", meaningSource: "jmdict", resolution: "resolved" };
const raw: VocabularyPrintItem = { id: "c", surface: "消えた", resolution: "saved_raw" };

const sheets = (pages: VocabularyPrintItem[][], settings = DEFAULT_PRINT_SETTINGS) =>
  render(<PrintSheets pages={pages} settings={settings} labels={labels} />).container;

describe("PrintSheets (spec §5, §6)", () => {
  it("gives page 1 the mascot and full header, later pages a compact header, every page a footer with x / y", () => {
    const root = sheets([[vi], [en]]);
    const [first, second] = [...root.querySelectorAll(".vp-sheet")];
    expect(first?.querySelector(".vp-head-first img.vp-mascot")).toHaveAttribute("src", "/mascot/poses/quill-writing.png");
    expect(first?.textContent).toContain("Vocabulary review");
    expect(second?.querySelector(".vp-head-first")).toBeNull();
    expect(second?.querySelector(".vp-head-cont")?.textContent).toContain("苦手な人");
    expect(first?.querySelector(".vp-foot")?.textContent).toContain("1 / 2");
    expect(second?.querySelector(".vp-foot")?.textContent).toContain("2 / 2");
    expect(root.querySelectorAll(".vp-foot img.vp-foot-mark")).toHaveLength(2);
  });

  it("marks Japanese lang=ja and shows the EN chip only for an English meaning", () => {
    const root = sheets([[vi, en]]);
    expect(root.querySelector(".vp-word")).toHaveAttribute("lang", "ja");
    expect(root.querySelector(".vp-example")).toHaveAttribute("lang", "ja");
    expect(root.querySelectorAll(".vp-chip")).toHaveLength(1);
  });

  it("replaces the hidden field with a writing line in self-test, keeping the template", () => {
    const root = sheets([[vi]], { ...DEFAULT_PRINT_SETTINGS, mode: "selfTest", hide: "meaning" });
    expect(root.querySelector(".vp-meaning")).toBeNull();
    expect(root.querySelector(".vp-blank")).not.toBeNull();
    expect(root.textContent).toContain("にがて");
    const reading = sheets([[vi]], { ...DEFAULT_PRINT_SETTINGS, mode: "selfTest", hide: "reading" });
    expect(reading.querySelector(".vp-reading")).toBeNull();
    expect(reading.querySelector(".vp-blank-inline")).not.toBeNull();
  });

  it("drops toggled-off fields and prints a raw saved item without reading or meaning", () => {
    const root = sheets([[vi, raw]], { ...DEFAULT_PRINT_SETTINGS, showExample: false });
    expect(root.querySelector(".vp-example")).toBeNull();
    expect(root.querySelectorAll(".vp-item")[1]?.textContent).toBe("消えた");
  });

  it("is presentational: no ids, no buttons, no inputs, no aria references (it renders twice)", () => {
    const root = sheets([[vi, en], [raw]]);
    expect(root.querySelectorAll("[id], button, input, [aria-describedby], [aria-labelledby]")).toHaveLength(0);
  });

  it("applies the compact density as a class, not a different template", () => {
    expect(sheets([[vi]], { ...DEFAULT_PRINT_SETTINGS, density: "compact" }).querySelector(".vp-paper.vp-compact")).not.toBeNull();
  });
});
