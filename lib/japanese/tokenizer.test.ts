import { describe, expect, it } from "vitest";
import { getTokenizer, tokenize } from "./tokenizer";

// See furigana.test.ts for why this is 60s rather than 20s: the kuromoji
// dictionary load measures 16-20s under full-suite parallel contention.
const KUROMOJI_TIMEOUT = 60000;

describe(
  "tokenize",
  () => {
    it("tokenizes a simple sentence into surface/reading/base/pos morphemes", async () => {
      const tokens = await tokenize("日本語を勉強する");

      expect(tokens.map((t) => t.surface).join("")).toBe("日本語を勉強する");

      const nihongo = tokens.find((t) => t.surface === "日本語");
      expect(nihongo).toBeDefined();
      expect(nihongo?.reading).toBe("ニホンゴ");
      expect(nihongo?.pos).toBe("名詞");

      const benkyou = tokens.find((t) => t.surface === "勉強");
      expect(benkyou).toBeDefined();
      expect(benkyou?.reading).toBe("ベンキョウ");
    }, KUROMOJI_TIMEOUT);

    it("gives the particle を its own token with pos 助詞", async () => {
      const tokens = await tokenize("日本語を勉強する");
      const wo = tokens.find((t) => t.surface === "を");
      expect(wo).toBeDefined();
      expect(wo?.pos).toBe("助詞");
    }, KUROMOJI_TIMEOUT);

    it("falls back to the surface form for base when kuromoji reports '*'", async () => {
      const tokens = await tokenize("日本語を勉強する");
      for (const token of tokens) {
        expect(token.base).not.toBe("*");
      }
    }, KUROMOJI_TIMEOUT);

    it("is deterministic across repeated calls", async () => {
      const a = await tokenize("日本語を勉強する");
      const b = await tokenize("日本語を勉強する");
      expect(a).toEqual(b);
    }, KUROMOJI_TIMEOUT);

    it("handles an empty string without throwing", async () => {
      const tokens = await tokenize("");
      expect(tokens).toEqual([]);
    }, KUROMOJI_TIMEOUT);
  },
);

describe(
  "getTokenizer",
  () => {
    it("caches the tokenizer across calls (module-level singleton)", async () => {
      const first = await getTokenizer();
      const second = await getTokenizer();
      expect(first).toBe(second);
    }, KUROMOJI_TIMEOUT);
  },
);
