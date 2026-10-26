import "server-only";
import { createHash } from "node:crypto";
import type { IpadicFeatures } from "kuromoji";
import { getTokenizer, tokenize as tokenizeMorphemes } from "../japanese/tokenizer";
import type { Token } from "../japanese/types";
import { PUNCTUATION } from "./listening-score";
import { normalizeJa } from "./normalize";
import { MAX_WORD_PIECES, type ChunkReason } from "./types";

// Defined in the client-safe `./types` so client code can name it without this server-only module (R5).
export type { ChunkReason };

export interface ChunkResult {
  version: number;
  reliable: boolean;
  reason: ChunkReason | null;
  /** `[]` when unreliable. */
  chunks: string[];
}

export const CURRENT_CHUNKER = 2;
const MAX_CHUNKS = 8;
const OPEN_BRACKETS = "「『（(【";

type Tok = IpadicFeatures;

// An odd `"` is re-tagged 括弧開 below, so it opens like a bracket; an even one closes and binds left.
const isOpenBracket = (t: Tok) => t.pos === "記号" && (OPEN_BRACKETS.includes(t.surface_form) || t.pos_detail_1 === "括弧開");
// kuromoji tags runs like `...` or `?」` as UNKNOWN nouns; those are punctuation, not a failure to read the line.
const isPunctuation = (t: Tok) => [...t.surface_form].every((c) => PUNCTUATION.test(c));
const isIndependent = (t: Tok) => t.pos_detail_1 === "自立";
// R1: a 副詞可能 noun (毎日, 今日) does not compound with the noun after it.
const isCompoundableNoun = (t: Tok) => t.pos === "名詞" && t.pos_detail_1 !== "副詞可能";

function startsChunk(t: Tok, prev: Tok | undefined): boolean {
  if (!prev) return true;
  if (isOpenBracket(t)) return true;
  if (prev.pos === "接頭詞" || isOpenBracket(prev)) return false;
  switch (t.pos) {
    case "名詞":
      if (t.pos_detail_1 === "接尾" || t.pos_detail_1 === "非自立") return false;
      return !isCompoundableNoun(prev);
    case "動詞":
    case "形容詞":
      if (!isIndependent(t)) return false;
      return !(t.basic_form === "する" && prev.pos === "名詞" && prev.pos_detail_1 === "サ変接続");
    case "副詞":
    case "連体詞":
    case "接続詞":
    case "感動詞":
    case "フィラー":
    case "接頭詞":
      return true;
    default:
      return false;
  }
}

/** First / last token of a chunk that carries meaning: opening brackets and prefixes are skipped at the head. */
const head = (c: Tok[]) => c.find((t) => !isOpenBracket(t) && t.pos !== "接頭詞") ?? c[0];
const tail = (c: Tok[]) => c[c.length - 1];
const cpLen = (c: Tok[]) => [...c.map((t) => t.surface_form).join("")].length;

/** Merge rank, weakest boundary first (1..6). */
function boundaryRank(left: Tok[], right: Tok[]): number {
  const l = tail(left);
  const r = head(right);
  if (!l || !r) return 6;
  if (isCompoundableNoun(l) && r.pos === "名詞") return 1;
  const modifier =
    l.pos === "連体詞" || l.pos === "動詞" || l.pos === "形容詞" || (l.pos === "助詞" && l.pos_detail_1 === "連体化");
  if (modifier && r.pos === "名詞") return 2;
  const adverbial = l.pos === "副詞" || (l.pos === "助詞" && l.pos_detail_1 === "副詞化");
  if (adverbial && (r.pos === "動詞" || r.pos === "形容詞")) return 3;
  if (l.pos === "助詞" && l.pos_detail_1 === "格助詞") return 4;
  if (l.surface_form === "、") return 5;
  return 6;
}

function mergeDownTo(chunks: Tok[][], max: number): Tok[][] {
  const out = chunks.slice();
  while (out.length > max) {
    let best = -1;
    let bestKey: [number, number] = [Infinity, Infinity];
    out.forEach((left, i) => {
      const right = out[i + 1];
      if (!right) return;
      const key: [number, number] = [boundaryRank(left, right), cpLen(left) + cpLen(right)];
      if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
        best = i;
        bestKey = key;
      }
    });
    const [left = [], right = []] = out.slice(best, best + 2);
    out.splice(best, 2, [...left, ...right]);
  }
  return out;
}

const unreliable = (reason: ChunkReason, version = 1): ChunkResult => ({ version, reliable: false, reason, chunks: [] });

/** Shared by every version: normalise, reject lines the tokenizer cannot be trusted on, split punctuation runs. */
async function tokenize(textJp: string, version: number, isPunct = isPunctuation): Promise<ChunkResult | Tok[]> {
  const base = normalizeJa(textJp);
  const tokens = (await getTokenizer()).tokenize(base);
  if (tokens.map((t) => t.surface_form).join("") !== base) return unreliable("mismatch", version);
  // latin/digit first: kuromoji marks every latin or digit run UNKNOWN, so the reverse order hides this reason
  if (/[A-Za-z0-9]/.test(base)) return unreliable("latin_or_digit", version);
  if (tokens.some((t) => t.word_type === "UNKNOWN" && !isPunct(t))) return unreliable("unknown_token", version);
  // R20: kuromoji glues punctuation into one UNKNOWN 名詞 (`...「`, `!?(`). Split it per code point into 記号 tokens so
  // the usual rules apply: openers start the next chunk, other marks attach left, a line-initial run binds forward.
  let quotes = 0;
  return (
    tokens
      .flatMap((t): Tok[] =>
        t.word_type === "UNKNOWN"
          ? [...t.surface_form].map((c) => ({ ...t, surface_form: c, pos: "記号", pos_detail_1: "一般" }))
          : [t],
      )
      // owner 2026-10-21: `"` has no direction of its own; the 1st, 3rd... opens, the 2nd, 4th... closes
      .map((t): Tok => (t.surface_form === '"' && ++quotes % 2 === 1 ? { ...t, pos: "記号", pos_detail_1: "括弧開" } : t))
  );
}

// v2 (WP §3.1): symbols such as ♪ 〜 → ※ are punctuation too; kuromoji tags them UNKNOWN 名詞.
const isSymbol = (t: Tok) => isPunctuation(t) || /^[\p{P}\p{S}]+$/u.test(t.surface_form);

async function chunkV2(textJp: string): Promise<ChunkResult> {
  const toks = await tokenize(textJp, 2, isSymbol);
  if (!Array.isArray(toks)) return toks;
  const pieces: string[] = [];
  let pending = ""; // openers and a line-initial run wait here for the next word
  for (const t of toks) {
    const s = t.surface_form;
    if (t.pos !== "記号" && !isPunctuation(t)) {
      pieces.push(pending + s);
      pending = "";
    } else if (isOpenBracket(t) || pieces.length === 0 || pending) pending += s;
    else pieces[pieces.length - 1] += s;
  }
  if (pending && pieces.length) pieces[pieces.length - 1] += pending;
  if (pieces.length < 2) return unreliable("single_chunk", 2);
  if (pieces.length > MAX_WORD_PIECES) return unreliable("too_many_pieces", 2);
  return { version: 2, reliable: true, reason: null, chunks: pieces };
}

async function chunkV1(textJp: string): Promise<ChunkResult> {
  const toks = await tokenize(textJp, 1);
  if (!Array.isArray(toks)) return toks;

  let chunks: Tok[][] = [];
  toks.forEach((t, i) => {
    const last = chunks[chunks.length - 1];
    // a line-initial run of punctuation binds forward to the first lexical token (R18)
    if (!last || (!last.every(isPunctuation) && startsChunk(t, toks[i - 1]))) chunks.push([t]);
    else last.push(t);
  });
  chunks = mergeDownTo(chunks, MAX_CHUNKS);
  if (chunks.length < 2) return unreliable("single_chunk");
  return {
    version: 1,
    reliable: true,
    reason: null,
    chunks: chunks.map((c) => c.map((t) => t.surface_form).join("")),
  };
}

// A version is never edited once an attempt references it; a rule change then ships as a new number.
// v1 was edited in place on 2026-10-21 (R17, Tasks 2b and R20): no attempt row referenced it and Word Bank is not live until Task 9.
export const CHUNKERS: Readonly<Record<number, (textJp: string) => Promise<ChunkResult>>> = Object.freeze({
  1: chunkV1,
  2: chunkV2,
});

export function lineTextHash(textJp: string): string {
  return createHash("sha256").update(textJp).digest("hex");
}

const memo = new Map<string, Promise<ChunkResult>>();

/**
 * Callers must have read `textJp` under the learner's access first (P12); the memo holds no learner data.
 */
export function chunkLine(textJp: string, version: number = CURRENT_CHUNKER): Promise<ChunkResult> {
  const chunker = CHUNKERS[version];
  if (!chunker) return Promise.reject(new Error(`unknown chunker version ${version}`));
  const key = `${version}:${lineTextHash(textJp)}`;
  let hit = memo.get(key);
  if (!hit) {
    hit = chunker(textJp);
    memo.set(key, hit);
    // do not cache a failure
    hit.catch(() => memo.delete(key));
  }
  return hit;
}

const tokenMemo = new Map<string, Promise<Token[]>>();

/** Tokens of `normalizeJa(textJp)` from chunker v2's kuromoji pipeline (cloze, romaji); memoised like `chunkLine` (P12). */
// Cloze selector v1: its token indices are these raw tokens; never edit once attempts reference it, add v2 instead.
export function lineTokens(textJp: string): Promise<Token[]> {
  const key = lineTextHash(textJp);
  let hit = tokenMemo.get(key);
  if (!hit) {
    hit = tokenizeMorphemes(normalizeJa(textJp));
    tokenMemo.set(key, hit);
    hit.catch(() => tokenMemo.delete(key));
  }
  return hit;
}

export function typingHintUnit(result: ChunkResult): "chunk" | "grapheme4" {
  return result.reliable && result.chunks.length >= 2 ? "chunk" : "grapheme4";
}

/** Code-point ranges over `normalizeJa(textJp)` of particle and auxiliary tokens (§5.6 Grammar). */
export async function grammarRanges(textJp: string): Promise<{ start: number; end: number }[]> {
  const tokens = (await getTokenizer()).tokenize(normalizeJa(textJp));
  const ranges: { start: number; end: number }[] = [];
  let pos = 0;
  for (const t of tokens) {
    const end = pos + [...t.surface_form].length;
    if (t.pos === "助詞" || t.pos === "助動詞") ranges.push({ start: pos, end });
    pos = end;
  }
  return ranges;
}

// ponytail: unbounded per-process memo, an LRU if line counts grow
