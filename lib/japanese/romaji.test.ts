import { describe, expect, it } from "vitest";
import { tokenize } from "./tokenizer";
import { lineRomaji, toHiraganaReading, toRomaji } from "./romaji";

describe("toRomaji", () => {
  it.each([
    ["キャ", "kya"],
    ["ガッコウ", "gakkou"],
    ["ラーメン", "raamen"],
    ["シンヨウ", "shin'you"],
    ["コンニチハ", "konnichiha"],
  ])("%s -> %s", (kana, romaji) => expect(toRomaji(kana)).toBe(romaji));
});

describe("toHiraganaReading", () => {
  it("shifts katakana to hiragana", () => expect(toHiraganaReading("ベンキョウ")).toBe("べんきょう"));
});

describe("lineRomaji", () => {
  it("romanises particles by sound and joins with spaces", async () => {
    expect(lineRomaji(await tokenize("私は学校へ行く"))).toBe("watashi wa gakkou e iku");
  });
});
