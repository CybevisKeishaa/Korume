import { describe, expect, it } from "vitest";
import { readKanjivgFiles, type KanjivgRow } from "./kanjivg";
import { UnsafeKanjivgError } from "./sanitize-kanjivg";

const svg = (hex: string, strokes: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="0 0 109 109">` +
  `<g id="kvg:${hex}" kvg:element="x">` +
  Array.from({ length: strokes }, (_, i) => `<path id="kvg:${hex}-s${i + 1}" d="M${i},1L2,2"/>`).join("") +
  `</g></svg>`;

async function* files(entries: [string, string][]) {
  for (const [name, content] of entries) yield { name, content };
}

async function collect(entries: [string, string][]): Promise<KanjivgRow[]> {
  const rows: KanjivgRow[] = [];
  for await (const row of readKanjivgFiles(files(entries))) rows.push(row);
  return rows;
}

describe("readKanjivgFiles", () => {
  it("maps kanji/<hex>.svg to its literal, including non-BMP code points, and skips variants", async () => {
    const rows = await collect([
      ["kanji/", ""],
      ["kanji/07dd1.svg", svg("07dd1", 2)],
      ["kanji/07dd1-Kaisho.svg", svg("07dd1", 3)],
      ["kanji/20b9f.svg", svg("20b9f", 1)],
    ]);
    expect(rows.map((row) => [row.literal, row.paths.length])).toEqual([
      ["緑", 2],
      ["𠮟", 1],
    ]);
  });

  it("fails the import on an unsafe file instead of skipping it", async () => {
    await expect(collect([["kanji/07dd1.svg", svg("07dd1", 1).replace("<g ", "<g onclick=\"x\" ")]])).rejects.toThrow(
      UnsafeKanjivgError,
    );
  });
});
