import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PreparedPage } from "@/lib/vocabulary/print/prepare";
import { DEFAULT_WORKSHEET_SETTINGS } from "@/lib/vocabulary/print/settings";
import type { PrintResources } from "@/lib/vocabulary/print/source";
import { Worksheet } from "./worksheet";
import type { SheetLabels } from "./labels";

const labels: SheetLabels = {
  wordmark: "KORUME", documentName: "Vocabulary Writing Practice", title: "苦手な人", footer: "Korume · Vocabulary Writing Practice",
  englishMeaning: "EN", strokeOrder: "Stroke order", answers: "Answers",
  pageNumber: (page, count) => `${page} / ${count}`, quote: (index) => `quote-${index}`, credit: (sources) => `Data: ${sources}`,
};
const resources: PrintResources = {
  strokeGuides: { 苦: { character: "苦", viewBox: 109, strokes: [{ d: "M1,1c1,1", start: [1, 1] }] } },
  credits: { jmdict: "JMdict v1 (CC BY-SA 4.0)", kanjivg: "KanjiVG r1 (CC BY-SA 3.0)" },
};
const practice: PreparedPage[] = [
  { kind: "items", items: [{ id: "a", number: 1, cells: 2, target: "苦手", glyphs: ["苦", "手"], reading: "にがて", meaning: "poor at", meaningLocale: "en", example: "苦手な人" }] },
  { kind: "items", items: [{ id: "b", number: 2, cells: 1, target: "人", glyphs: ["人"] }] },
];
const selfTest: PreparedPage[] = [
  { kind: "items", items: [{ id: "a", number: 1, cells: 2, reading: "にがて", example: "＿＿な人" }] },
  { kind: "answers", answers: [{ id: "a", number: 1, target: "苦手", reading: "にがて" }] },
];
const sheets = (pages: PreparedPage[], mode: "practice" | "selfTest" = "practice") =>
  render(<Worksheet pages={pages} settings={{ ...DEFAULT_WORKSHEET_SETTINGS, mode }} labels={labels} resources={resources} />).container;

describe("Worksheet (spec W §3–§4)", () => {
  it("page 1 has the colour mascot and full header, later pages the compact header; every page a watermark, quote and footer", () => {
    const root = sheets(practice);
    const pages = root.querySelectorAll(".vp-sheet");
    expect(pages).toHaveLength(2);
    expect(pages[0]?.querySelector(".vp-head-first img")).not.toBeNull();
    expect(pages[1]?.querySelector(".vp-head-cont")).not.toBeNull();
    for (const [index, page] of [...pages].entries()) {
      expect(page.querySelector(".vp-watermark img")?.getAttribute("src")).toBe("/mascot/poses/neutral.png");
      expect(page.querySelector(".vp-watermark")?.textContent).toBe("KORUME");
      expect(page.querySelector(".vp-quote")?.textContent).toBe(`“quote-${index}”`);
      expect(page.querySelector(".vp-foot")?.textContent).toContain(`${index + 1} / 2`);
      expect(page.querySelector(".vp-foot img")).toBeNull(); // footer mascot mark removed (W9)
    }
  });
  it("practice items: target, stroke guide, model + trace cells, example; credit names JMdict and KanjiVG", () => {
    const page = sheets(practice).querySelector(".vp-sheet")!;
    const item = page.querySelector('.vp-item[data-item-id="a"]')!;
    expect(item.querySelector(".vp-word")?.textContent).toBe("苦手");
    expect(item.querySelector(".vp-guide")).not.toBeNull();
    expect(item.querySelectorAll(".vp-model")).toHaveLength(2);
    expect(item.querySelector(".vp-chip")?.textContent).toBe("EN");
    expect(item.querySelector(".vp-example")?.textContent).toBe("苦手な人");
    expect(page.querySelector(".vp-credit")?.textContent).toBe("Data: JMdict v1 (CC BY-SA 4.0) · KanjiVG r1 (CC BY-SA 3.0)");
  });
  it("self-test item pages carry no target, trace, model or stroke guide; answers come last and credit only JMdict", () => {
    const root = sheets(selfTest, "selfTest");
    const [itemsPage, answersPage] = [...root.querySelectorAll(".vp-sheet")];
    expect(itemsPage?.querySelector(".vp-body")?.textContent).not.toContain("苦手");
    expect(itemsPage?.querySelector(".vp-guide, .vp-trace, .vp-model, .vp-word")).toBeNull();
    expect(itemsPage?.querySelector(".vp-number")?.textContent).toBe("1.");
    expect(answersPage?.querySelector(".vp-answers-title")?.textContent).toBe("Answers");
    expect(answersPage?.querySelector('.vp-answer[data-item-id="a"]')?.textContent).toBe("1.苦手にがて");
    expect(itemsPage?.querySelector(".vp-credit")?.textContent).toBe("Data: JMdict v1 (CC BY-SA 4.0)");
  });
  it("is presentational: no ids, buttons, inputs or aria references (it renders twice)", () => {
    const root = sheets(practice);
    expect(root.querySelector("[id], button, input, [aria-labelledby], [aria-describedby], [aria-controls]")).toBeNull();
  });
});
