import { beforeEach, describe, expect, it, vi } from "vitest";
import { chunkLine, CHUNKERS, CURRENT_CHUNKER, grammarRanges, lineTextHash, typingHintUnit } from "./chunk";
import { normalizeJa } from "./normalize";
import { getTokenizer } from "../japanese/tokenizer";

vi.mock("../japanese/tokenizer", async (orig) => {
  const m = await orig<typeof import("../japanese/tokenizer")>();
  return { ...m, getTokenizer: vi.fn(m.getTokenizer) };
});

// kuromoji dictionary load is slow under suite contention (see lib/japanese/tokenizer.test.ts).
const T = 60000;
const chunkV1 = CHUNKERS[CURRENT_CHUNKER];
if (!chunkV1) throw new Error("no current chunker");
const run = (s: string) => chunkV1(s);

describe("chunkV1", () => {
  it("cuts topic noun + copula", async () => {
    const r = await run("今日は雨です。");
    expect(r).toMatchObject({ reliable: true, reason: null, version: 1 });
    expect(r.chunks).toEqual(["今日は", "雨です。"]);
  }, T);

  it("R1: a 副詞可能 noun does not compound with the next noun; ました is never split", async () => {
    expect((await run("毎日日本語を勉強しました。")).chunks).toEqual(["毎日", "日本語を", "勉強しました。"]);
  }, T);

  it("keeps a サ変接続 noun and its する in one chunk", async () => {
    expect((await run("注文をお願いします。")).chunks).toEqual(["注文を", "お願いします。"]);
  }, T);

  it("binds a prefix (接頭詞) forward to its noun", async () => {
    expect((await run("お水をください。")).chunks).toEqual(["お水を", "ください。"]);
  }, T);

  it("opening bracket belongs to the next chunk, other punctuation to the previous", async () => {
    const line = "「はい」と言った。";
    const r = await run(line);
    expect(r.chunks).toEqual(["「はい」と", "言った。"]);
    expect(r.chunks.join("")).toBe(normalizeJa(line));
  }, T);

  it("merges down to 8 chunks, weakest boundaries first (modifier|head)", async () => {
    const line = "昨日私は友達と駅の近くの新しい店で美味しいラーメンをゆっくり食べました。";
    const r = await run(line);
    // 11 raw chunks; three rank-2 modifier|head merges (駅の|近くの, 新しい|店で, 美味しい|ラーメンを)
    expect(r.chunks).toEqual([
      "昨日",
      "私は",
      "友達と",
      "駅の近くの",
      "新しい店で",
      "美味しいラーメンを",
      "ゆっくり",
      "食べました。",
    ]);
    expect(r.chunks.join("")).toBe(line);
  }, T);

  it("single merge: 9 raw chunks lose exactly the leftmost weakest pair", async () => {
    const line = "昨日私は友達と駅の近くの新しい店でラーメンを食べました。";
    // raw: 昨日/私は/友達と/駅の/近くの/新しい/店で/ラーメンを/食べました。 (9). 駅の|近くの and 新しい|店で are
    // both rank 2 at 5 code points; the leftmost wins.
    const { chunks } = await run(line);
    expect(chunks).toHaveLength(8);
    expect(chunks[3]).toBe("駅の近くの");
    expect(chunks.join("")).toBe(line);
  }, T);

  it("mid-line opening bracket starts the chunk after it", async () => {
    const r = await run("私は「はい」と言った。");
    expect(r.chunks).toEqual(["私は", "「はい」と", "言った。"]);
  }, T);

  describe("punctuation-only UNKNOWN tokens keep Word Bank (owner 2026-10-21)", () => {
    // kuromoji tags `...` and `?」` as UNKNOWN 名詞; punctuation stays in the chunks (NFKC: … -> ..., ？ -> ?)
    it.each([
      ["お値段が…みたいな時が結構あるんですね", ["お値段が...みたいな時が", "結構", "あるんですね"]],
      ["今日はいい天気ですね？", ["今日は", "いい", "天気ですね?"]],
      ["「今日はいい天気ですね？」", ["「今日は", "いい", "天気ですね?」"]],
      ["「そうですね…」と言った。", ["「そうですね...」と", "言った。"]],
      ["…今日は雨です", ["...今日は", "雨です"]],
      ["今日は雨です！？", ["今日は", "雨です!?"]],
      // R20: kuromoji glues these into one UNKNOWN token (`...「`, `!?(`, `)`); each mark binds on its own
      ["お願い...「はい」と", ["お願い...", "「はい」と"]],
      ["彼は!?(はい)と言った", ["彼は!?", "(はい)と", "言った"]],
      ["彼は「「はい」」と言った", ["彼は", "「「はい」」と", "言った"]],
      ["いいえ」「はい」と言った", ["いいえ」", "「はい」と", "言った"]],
    ])("%s", async (line, chunks) => {
      const r = await run(line);
      expect(r).toEqual({ version: 1, reliable: true, reason: null, chunks });
      expect(r.chunks.join("")).toBe(normalizeJa(line));
    }, T);

    it("a punctuation-only chunk never stands alone", async () => {
      const { chunks } = await run("…今日は雨です");
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.every((c) => /[^.。、!?「」]/.test(c))).toBe(true);
    }, T);

    it("「そうですね…」 alone is one chunk with the … inside it", async () => {
      expect(await run("「そうですね…」")).toEqual({ version: 1, reliable: false, reason: "single_chunk", chunks: [] });
    }, T);

    it("an UNKNOWN token that is not punctuation still gives unknown_token", async () => {
      // ポッドジャスト is the UNKNOWN word; the trailing ... is not what fails the line
      expect(await run("ポッドジャスト…です")).toEqual({ version: 1, reliable: false, reason: "unknown_token", chunks: [] });
    }, T);
  });

  it.each([
    ["ABCです", "latin_or_digit"],
    ["3時です", "latin_or_digit"],
    ["はい。", "single_chunk"],
    ["ぱぽぴぷぺ", "unknown_token"], // kuromoji marks the whole run word_type UNKNOWN
  ])("unreliable %s -> %s", async (line, reason) => {
    expect(await run(line)).toEqual({ version: 1, reliable: false, reason, chunks: [] });
  }, T);
});

describe("chunkLine memo", () => {
  beforeEach(() => vi.mocked(getTokenizer).mockClear());

  it("runs once per text, again for edited text", async () => {
    await chunkLine("私は猫です。");
    await chunkLine("私は猫です。");
    expect(getTokenizer).toHaveBeenCalledTimes(1);
    await chunkLine("私は犬です。");
    expect(getTokenizer).toHaveBeenCalledTimes(2);
  }, T);

  it("rejects an unknown version", async () => {
    await expect(chunkLine("はい", 99)).rejects.toThrow();
  });
});

describe("helpers", () => {
  it("lineTextHash is a distinct sha256 hex", () => {
    expect(lineTextHash("a")).not.toBe(lineTextHash("b"));
    expect(lineTextHash("a")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("typingHintUnit is chunk only for a reliable 2+ chunk result", () => {
    const ok = { version: 1, reliable: true, reason: null, chunks: ["a", "b"] };
    expect(typingHintUnit(ok)).toBe("chunk");
    expect(typingHintUnit({ ...ok, chunks: ["a"] })).toBe("grapheme4");
    expect(typingHintUnit({ ...ok, reliable: false })).toBe("grapheme4");
  });

  it("grammarRanges returns code-point ranges of particles and auxiliaries", async () => {
    // 今日|は|雨|です|。 -> は [2,3), です [4,6)
    expect(await grammarRanges("今日は雨です。")).toEqual([
      { start: 2, end: 3 },
      { start: 4, end: 6 },
    ]);
  }, T);
});
