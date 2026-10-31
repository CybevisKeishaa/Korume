import { beforeEach, describe, expect, it, vi } from "vitest";
import { boundedMemo, chunkLine, CHUNKERS, CURRENT_CHUNKER, currentCut, cutKind, grammarRanges, lineTextHash, typingHintUnit } from "./chunk";
import { chunkDisplays, displayMap } from "./display";
import { normalizeJa } from "./normalize";
import { getTokenizer } from "../japanese/tokenizer";

vi.mock("../japanese/tokenizer", async (orig) => {
  const m = await orig<typeof import("../japanese/tokenizer")>();
  return { ...m, getTokenizer: vi.fn(m.getTokenizer) };
});

// kuromoji dictionary load is slow under suite contention (see lib/japanese/tokenizer.test.ts).
const T = 60000;
/** The array the pipeline gives for the owner line. */
const PIN_OWNER_V3 = ["ああ", "いう", "の", "を", "その", "場", "で", "すぐ", "Google", "マップ", "で", "調べ", "て"];
const chunkV1 = CHUNKERS[1];
const chunkV2 = CHUNKERS[2];
if (!chunkV1 || !chunkV2) throw new Error("chunker missing");
const run = (s: string) => chunkV1(s);
const run2 = (s: string) => chunkV2(s);

describe("v2", () => {
  it("is no longer the current chunker", () => expect(CURRENT_CHUNKER).toBe(3));

  it("one piece per word; punctuation binds back", async () => {
    expect(await run2("お店を検索すると思うんですけど。")).toEqual({
      version: 2,
      reliable: true,
      reason: null,
      chunks: ["お", "店", "を", "検索", "する", "と", "思う", "ん", "です", "けど。"],
    });
  }, T);

  it("♪ binds back", async () => {
    const { chunks } = await run2("今日は楽しいですね♪");
    expect(chunks.at(-1)).toMatch(/♪$/);
    expect(chunks.join("")).toBe("今日は楽しいですね♪");
  }, T);

  it("quotes: opener binds forward, closer back, no punctuation-only piece", async () => {
    const { chunks } = await run2("「こんにちは」と言った");
    expect(chunks).toContain("「こんにちは」");
    expect(chunks.every((c) => /[^「」]/.test(c))).toBe(true);
  }, T);

  it("a line-initial run binds forward", async () => {
    expect((await run2("…今日は雨です")).chunks[0]).toBe("...今日");
  }, T);

  it('an odd " opens, an even one closes', async () => {
    const { chunks } = await run2('彼は"はい"と言った');
    expect(chunks).toContain('"はい"');
    expect(chunks.join("")).toBe('彼は"はい"と言った');
  }, T);

  it("does not merge down: a doubled line gives twice the pieces", async () => {
    const line = "お店を検索すると思うんですけど。";
    expect((await run2(line + line)).chunks).toHaveLength(20);
  }, T);

  it("more than 64 pieces is unreliable (the submit schema caps chunkOrder at 64)", async () => {
    const line = "お店を検索すると思うんですけど。".repeat(7); // 70 tokens
    expect(await run2(line)).toEqual({ version: 2, reliable: false, reason: "too_many_pieces", chunks: [] });
    expect((await run2("お店を検索すると思うんですけど。".repeat(6) + "お店を")).chunks).toHaveLength(63);
  }, T);

  it.each([
    ["ABCです", "latin_or_digit"],
    ["3時です", "latin_or_digit"],
    ["はい。", "single_chunk"],
    ["ぱぽぴぷぺ", "unknown_token"],
  ])("unreliable %s -> %s", async (line, reason) => {
    expect(await run2(line)).toEqual({ version: 2, reliable: false, reason, chunks: [] });
  }, T);
});

const OWNER = "ああいうのをその場ですぐGoogleマップで調べて";

describe("v3: the word cut keeps Latin runs", () => {
  const run3 = (s: string) => CHUNKERS[3]!(s);

  it("keeps a Latin run as one piece", async () => {
    const r = await run3(OWNER);
    expect(r).toMatchObject({ version: 3, reliable: true, reason: null });
    expect(r.chunks).toContain("Google");
    expect(r.chunks.join("")).toBe(normalizeJa(OWNER));
    expect(r.chunks).toEqual(PIN_OWNER_V3);
  }, T);

  it("full-width Latin is one piece and displays as written", async () => {
    const raw = "すぐＧｏｏｇｌｅで";
    const { chunks } = await run3(raw);
    expect(chunks).toContain("Google");
    expect(chunkDisplays(displayMap(raw), normalizeJa(raw), chunks)).toContain("Ｇｏｏｇｌｅ");
  }, T);

  it("keeps the digit rule", async () => {
    expect(await run3("今日は2026年です。")).toEqual({ version: 3, reliable: false, reason: "latin_or_digit", chunks: [] });
  }, T);

  it("still rejects a non-Latin unknown", async () => {
    expect(await run3("ぱぽぴぷぺ")).toEqual({ version: 3, reliable: false, reason: "unknown_token", chunks: [] });
  }, T);
});

describe("v4: the character cut", () => {
  const run4 = (s: string) => CHUNKERS[4]!(s);

  it.each([
    ["今日は2026年です。", ["今", "日", "は", "2026", "年", "で", "す。"]],
    ["検索する", ["検", "索", "す", "る"]],
    ["きって", ["き", "っ", "て"]],
    ["COVID19です", ["COVID19", "で", "す"]],
    ["「はい」", ["「は", "い」"]],
  ])("cuts %s", async (line, chunks) => {
    expect(await run4(line)).toEqual({ version: 4, reliable: true, reason: null, chunks });
  }, T);

  it("never splits a grapheme cluster", async () => {
    const { chunks } = await run4("あ👍🏽い");
    expect(chunks.some((c) => c === "🏽")).toBe(false);
    expect(chunks.join("")).toBe("あ👍🏽い");
  }, T);

  it("full-width digits are one piece that displays as written", async () => {
    const raw = "２０２６年";
    const { chunks } = await run4(raw);
    expect(chunks[0]).toBe("2026");
    expect(chunkDisplays(displayMap(raw), normalizeJa(raw), chunks)[0]).toBe("２０２６");
  }, T);

  it("keeps the locks", async () => {
    expect(await run4("あ。")).toEqual({ version: 4, reliable: false, reason: "single_chunk", chunks: [] });
    expect(await run4("あ".repeat(65))).toEqual({ version: 4, reliable: false, reason: "too_many_pieces", chunks: [] });
  }, T);
});

describe("currentCut", () => {
  it("the word cut when it is reliable, else the character cut, else locked", async () => {
    expect(await currentCut(OWNER)).toMatchObject({ version: 3, reliable: true });
    expect(await currentCut("今日は2026年です。")).toMatchObject({ version: 4, reliable: true });
    expect(await currentCut("あ。")).toMatchObject({ version: 4, reliable: false });
    expect([cutKind(3), cutKind(4)]).toEqual(["word", "char"]);
  }, T);
});

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
      // owner 2026-10-21: `"` is punctuation; an odd one opens and binds forward, an even one closes and binds back
      ['"お店の性格"っていうのを', ['"お店の', '性格"っていうのを']],
      ['彼は"はい"と言った', ["彼は", '"はい"と', "言った"]],
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

describe("boundedMemo", () => {
  it("evicts the least recently used key past the cap and never caches a failure", async () => {
    const remember = boundedMemo<string>(2);
    const make = vi.fn((key: string) => Promise.resolve(key));
    const get = (key: string) => remember(key, () => make(key));
    await get("a"); await get("b"); await get("a"); // a is now the most recent
    await get("c"); // evicts b
    expect(make).toHaveBeenCalledTimes(3);
    await get("a");
    expect(make).toHaveBeenCalledTimes(3);
    await get("b");
    expect(make).toHaveBeenCalledTimes(4);
    const fail = vi.fn(() => Promise.reject(new Error("x")));
    await expect(remember("f", fail)).rejects.toThrow();
    await expect(remember("f", fail)).rejects.toThrow();
    expect(fail).toHaveBeenCalledTimes(2);
  });

  it("a stale failure never drops the newer entry made after its key was evicted", async () => {
    const remember = boundedMemo<string>(1);
    let rejectOld!: (error: Error) => void;
    const old = remember("a", () => new Promise<string>((_, reject) => { rejectOld = reject; }));
    await remember("b", () => Promise.resolve("b")); // evicts a
    const fresh = vi.fn(() => Promise.resolve("a2"));
    await remember("a", fresh);
    rejectOld(new Error("late"));
    await expect(old).rejects.toThrow("late");
    await remember("a", fresh);
    expect(fresh).toHaveBeenCalledTimes(1);
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
    expect(typingHintUnit({ ...ok, version: 2 })).toBe("chunk");
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
