import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/strokes/guides", () => ({ getStrokeGuides: vi.fn(async (chars: string[]) => Object.fromEntries(chars.map((c) => [c, { character: c, viewBox: 109, strokes: [] }]))) }));
vi.mock("@/lib/dictionary/snapshot", () => ({
  getActiveSnapshotId: vi.fn(async () => "snap-1"),
  getDictionaryAttribution: vi.fn(async () => [
    { source: "jmdict", version: "2026-09-01", url: "u", license: "CC BY-SA 4.0" },
    { source: "kanjidic2", version: "2026-09-01", url: "u", license: "CC BY-SA 4.0" },
    { source: "kanjivg", version: "r20250816", url: "u", license: "CC BY-SA 3.0" },
  ]),
}));

import { getStrokeGuides } from "@/lib/strokes/guides";
import { loadPrintResources } from "./resources";

describe("loadPrintResources (spec W §1.1, §1.5)", () => {
  it("asks for each grapheme of every target once and formats the credits from the active snapshot", async () => {
    const resources = await loadPrintResources(["苦手", "手紙", "する"]);
    expect(getStrokeGuides).toHaveBeenCalledWith(["苦", "手", "紙", "す", "る"]);
    expect(resources.credits).toEqual({ jmdict: "JMdict 2026-09-01 (CC BY-SA 4.0)", kanjivg: "KanjiVG r20250816 (CC BY-SA 3.0)" });
    expect(Object.keys(resources.strokeGuides)).toHaveLength(5);
  });
});
