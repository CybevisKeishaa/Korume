import "server-only";
import { createHash } from "node:crypto";
import type { IpadicFeatures } from "kuromoji";
import { getTokenizer, tokenize as tokenizeMorphemes } from "../japanese/tokenizer";
import type { Token } from "../japanese/types";
import { PUNCTUATION } from "./listening-score";
import { normalizeJa } from "./normalize";
import { MAX_WORD_PIECES, type ChunkReason, type CutKind } from "./types";

// Defined in the client-safe `./types` so client code can name it without this server-only module (R5).
export type { ChunkReason };

export interface ChunkResult {
  version: number;
  reliable: boolean;
  reason: ChunkReason | null;
  /** `[]` when unreliable. */
  chunks: string[];
}

export const CURRENT_CHUNKER = 3;
export const CHAR_CHUNKER = 4;
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

const isLatinWord = (t: Tok) => /^[A-Za-z]+$/.test(t.surface_form);

/**
 * Shared by every version: normalise, reject lines the tokenizer cannot be trusted on, split punctuation runs.
 * `latin` (v3): a run of ASCII letters is a word, not an unknown token; digits still reject the line.
 */
async function tokenize(textJp: string, version: number, isPunct = isPunctuation, latin = false): Promise<ChunkResult | Tok[]> {
  const base = normalizeJa(textJp);
  const tokens = (await getTokenizer()).tokenize(base);
  if (tokens.map((t) => t.surface_form).join("") !== base) return unreliable("mismatch", version);
  // latin/digit first: kuromoji marks every latin or digit run UNKNOWN, so the reverse order hides this reason
  if ((latin ? /[0-9]/ : /[A-Za-z0-9]/).test(base)) return unreliable("latin_or_digit", version);
  const unknown = (t: Tok) => t.word_type === "UNKNOWN" && !(latin && isLatinWord(t));
  if (tokens.some((t) => unknown(t) && !isPunct(t))) return unreliable("unknown_token", version);
  // R20: kuromoji glues punctuation into one UNKNOWN 名詞 (`...「`, `!?(`). Split it per code point into 記号 tokens so
  // the usual rules apply: openers start the next chunk, other marks attach left, a line-initial run binds forward.
  let quotes = 0;
  return (
    tokens
      .flatMap((t): Tok[] =>
        unknown(t)
          ? [...t.surface_form].map((c) => ({ ...t, surface_form: c, pos: "記号", pos_detail_1: "一般" }))
          : [t],
      )
      // owner 2026-10-21: `"` has no direction of its own; the 1st, 3rd... opens, the 2nd, 4th... closes
      .map((t): Tok => (t.surface_form === '"' && ++quotes % 2 === 1 ? { ...t, pos: "記号", pos_detail_1: "括弧開" } : t))
  );
}

// v2 (WP §3.1): symbols such as ♪ 〜 → ※ are punctuation too; kuromoji tags them UNKNOWN 名詞.
const isMarkText = (s: string) => [...s].every((c) => PUNCTUATION.test(c)) || /^[\p{P}\p{S}]+$/u.test(s);
const isSymbol = (t: Tok) => isMarkText(t.surface_form);

type Part = [text: string, kind: "word" | "open" | "mark"];

/** Openers and a line-initial run bind to the next word, other marks to the previous; locks as every word cut. */
function attach(parts: Part[], version: number): ChunkResult {
  const pieces: string[] = [];
  let pending = ""; // openers and a line-initial run wait here for the next word
  for (const [s, kind] of parts) {
    if (kind === "word") {
      pieces.push(pending + s);
      pending = "";
    } else if (kind === "open" || pieces.length === 0 || pending) pending += s;
    else pieces[pieces.length - 1] += s;
  }
  if (pending && pieces.length) pieces[pieces.length - 1] += pending;
  if (pieces.length < 2) return unreliable("single_chunk", version);
  if (pieces.length > MAX_WORD_PIECES) return unreliable("too_many_pieces", version);
  return { version, reliable: true, reason: null, chunks: pieces };
}

async function wordCut(textJp: string, version: number, latin: boolean): Promise<ChunkResult> {
  const toks = await tokenize(textJp, version, isSymbol, latin);
  if (!Array.isArray(toks)) return toks;
  return attach(toks.map((t): Part => [t.surface_form, t.pos !== "記号" && !isPunctuation(t) ? "word" : isOpenBracket(t) ? "open" : "mark"]), version);
}

const chunkV2 = (textJp: string) => wordCut(textJp, 2, false);
// v3: v2 with a Latin run kept as one piece
const chunkV3 = (textJp: string) => wordCut(textJp, 3, true);

// v4: one piece per grapheme of the normalised line, an ASCII letter/digit run one piece; for lines the word cut cannot read.
async function chunkChars(textJp: string): Promise<ChunkResult> {
  let quotes = 0;
  const parts: Part[] = [];
  for (const { segment: g } of new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(normalizeJa(textJp))) {
    const last = parts[parts.length - 1];
    const quote = g === '"' && ++quotes % 2 === 1;
    if (/^[A-Za-z0-9]+$/.test(g)) {
      if (last && last[1] === "word" && /[A-Za-z0-9]$/.test(last[0])) last[0] += g;
      else parts.push([g, "word"]);
    } else if (isMarkText(g)) {
      parts.push([g, quote || OPEN_BRACKETS.includes(g) ? "open" : "mark"]);
    } else parts.push([g, "word"]);
  }
  return attach(parts, CHAR_CHUNKER);
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
  3: chunkV3,
  4: chunkChars,
});

export function lineTextHash(textJp: string): string {
  return createHash("sha256").update(textJp).digest("hex");
}

/** Entries per memo; learners can add lines of their own, so the memo must not grow with them. */
export const MEMO_CAP = 2000;

/** `make(key)` once per key, the least recently used key evicted past `cap`; a failure is never cached. */
export function boundedMemo<T>(cap: number = MEMO_CAP): (key: string, make: () => Promise<T>) => Promise<T> {
  const entries = new Map<string, Promise<T>>();
  return (key, make) => {
    let hit = entries.get(key);
    if (hit) entries.delete(key); // re-insert below: Map order is recency order
    else {
      hit = make();
      hit.catch(() => { if (entries.get(key) === hit) entries.delete(key); });
    }
    entries.set(key, hit);
    if (entries.size > cap) entries.delete(entries.keys().next().value!);
    return hit;
  };
}

const memo = boundedMemo<ChunkResult>();

/**
 * Callers must have read `textJp` under the learner's access first (P12); the memo holds no learner data.
 */
export function chunkLine(textJp: string, version: number = CURRENT_CHUNKER): Promise<ChunkResult> {
  const chunker = CHUNKERS[version];
  if (!chunker) return Promise.reject(new Error(`unknown chunker version ${version}`));
  return memo(`${version}:${lineTextHash(textJp)}`, () => chunker(textJp));
}

/** The cut a learner gets: the word cut when it is reliable, else the character cut (reliable or locked). */
export async function currentCut(textJp: string): Promise<ChunkResult> {
  const word = await chunkLine(textJp, CURRENT_CHUNKER);
  return word.reliable ? word : chunkLine(textJp, CHAR_CHUNKER);
}

export const cutKind = (version: number): CutKind => (version === CHAR_CHUNKER ? "char" : "word");

const tokenMemo = boundedMemo<Token[]>();

/** Tokens of `normalizeJa(textJp)` from chunker v2's kuromoji pipeline (cloze, romaji); memoised like `chunkLine` (P12). */
// Cloze selector v1: its token indices are these raw tokens; never edit once attempts reference it, add v2 instead.
export function lineTokens(textJp: string): Promise<Token[]> {
  return tokenMemo(lineTextHash(textJp), () => tokenizeMorphemes(normalizeJa(textJp)));
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

