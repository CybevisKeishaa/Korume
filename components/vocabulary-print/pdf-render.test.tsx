import { render, waitFor } from "@/test/render";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WORKSHEET_SETTINGS } from "@/lib/vocabulary/print/settings";
import type { RenderPayload } from "@/lib/vocabulary/print/pdf/request";
import { overflowing, PdfRender } from "./pdf-render";

const payload: RenderPayload = {
  locale: "en", title: "T", settings: DEFAULT_WORKSHEET_SETTINGS,
  pages: [{ kind: "items", items: [{ id: "a", number: 1, cells: 1, target: "人", glyphs: ["人"] }] }],
  resources: { strokeGuides: {}, credits: { jmdict: null, kanjivg: null } },
};
afterEach(() => { vi.restoreAllMocks(); Reflect.deleteProperty(document, "fonts"); Reflect.deleteProperty(HTMLImageElement.prototype, "decode"); });

describe("PdfRender (spec W §6.3 step 5)", () => {
  it("renders exactly the payload pages into a body-level print root and marks it ready after fonts and images", async () => {
    let fontsDone!: () => void;
    Object.defineProperty(document, "fonts", { configurable: true, value: { ready: new Promise<void>((resolve) => { fontsDone = resolve; }) } });
    // jsdom has no HTMLImageElement.decode, so there is nothing to spy on.
    Object.defineProperty(HTMLImageElement.prototype, "decode", { configurable: true, value: () => Promise.resolve() });
    render(<PdfRender payload={payload} />);
    const root = () => document.body.querySelector(":scope > [data-print-root]");
    await waitFor(() => expect(root()?.querySelectorAll(".vp-sheet")).toHaveLength(1));
    expect(root()?.hasAttribute("data-pdf-ready")).toBe(false);
    fontsDone();
    await waitFor(() => expect(root()?.hasAttribute("data-pdf-ready")).toBe(true));
  });
  it("overflowing() is true when an item ends below its sheet's quote band", () => {
    document.body.innerHTML = '<section class="vp-sheet"><div class="vp-item"></div><div class="vp-quote"></div></section>';
    const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    vi.spyOn(document.querySelector(".vp-item")!, "getBoundingClientRect").mockReturnValue(rect(0, 120));
    vi.spyOn(document.querySelector(".vp-quote")!, "getBoundingClientRect").mockReturnValue(rect(100, 110));
    expect(overflowing(document)).toBe(true);
    vi.spyOn(document.querySelector(".vp-item")!, "getBoundingClientRect").mockReturnValue(rect(0, 100));
    expect(overflowing(document)).toBe(false);
  });
});
