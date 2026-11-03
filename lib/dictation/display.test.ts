import { describe, expect, it } from "vitest";
import { chunkDisplays, displayMap, displayRange } from "./display";
import { normalizeJa } from "./normalize";

const strip = (s: string) => s.replace(/\s+/g, "");

describe("displayMap", () => {
  it("shows the raw cluster on its first base code point, empty on the rest", () => {
    const text = "お値段が…みたいな時が";
    const map = displayMap(text);
    expect(map).not.toBeNull();
    const base = normalizeJa(text);
    expect(base).toBe("お値段が...みたいな時が");
    expect(map).toHaveLength(Array.from(base).length);
    expect(chunkDisplays(map, base, [base])).toEqual([text]);
    expect(map?.slice(4, 7)).toEqual(["…", "", ""]);
  });

  it("keeps the full-width question mark", () => {
    const text = "天気ですね？";
    const base = normalizeJa(text);
    expect(base.endsWith("?")).toBe(true);
    expect(displayRange(displayMap(text), base, { start: 5, end: 6 })).toBe("？");
  });

  it("keeps half-width katakana half-width", () => {
    const text = "ｶﾀｶﾅ";
    expect(normalizeJa(text)).toBe("カタカナ");
    expect(displayRange(displayMap(text), normalizeJa(text), { start: 0, end: 4 })).toBe("ｶﾀｶﾅ");
  });

  it("drops whitespace and loses nothing else", () => {
    const text = ' お店の性格 "っていうのを';
    const base = normalizeJa(text);
    const map = displayMap(text);
    expect(displayRange(map, base, { start: 0, end: Array.from(base).length })).toBe(strip(text));
  });

  it("is null when NFKC composes across a cluster boundary, and displayRange falls back to the base", () => {
    const text = "ᄀￂ";
    expect(displayMap(text)).toBeNull();
    const base = normalizeJa(text);
    expect(displayRange(null, base, { start: 0, end: 1 })).toBe(Array.from(base)[0]);
  });

  it("the displays of all chunks concatenate to text_jp without whitespace", () => {
    const text = "お値段が…みたいな ｶﾀｶﾅ 時が？";
    const base = normalizeJa(text);
    const chunks = ["お値段が...", "みたいな", "カタカナ", "時が?"];
    expect(chunks.join("")).toBe(base);
    expect(chunkDisplays(displayMap(text), base, chunks).join("")).toBe(strip(text));
  });
});
