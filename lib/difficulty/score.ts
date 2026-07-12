/**
 * i+1 comprehensible-input scorer (CLAUDE.md §5.2, spec §10.2).
 *
 * Pure and deterministic: given a list of content-word lemmas from a video's
 * transcript and the set of lemmas the learner already knows (from SRS data),
 * compute what fraction of the video's running text is already known and bin
 * that into a recommendation band. No I/O, no randomness — every case is a
 * plain unit test.
 */
import type { Token } from "@/lib/japanese/types";
import type { ComprehensionBand, ComprehensionScore } from "./types";

/**
 * kuromoji IPADIC major part-of-speech categories that carry lexical content.
 * Everything else (助詞 particle, 助動詞 auxiliary, 記号 symbol, 接続詞
 * conjunction, 連体詞, フィラー, 感動詞, …) is grammar/punctuation scaffolding,
 * not a "word" a learner studies via vocab SRS, so it is excluded.
 */
const CONTENT_POS_TAGS: ReadonlySet<string> = new Set(["名詞", "動詞", "形容詞", "副詞"]);

/** i+1 band boundaries on knownRatio. Named so the thresholds are a single source of truth. */
export const TOO_HARD_MAX = 0.8; // ratio < this => too-hard
export const IDEAL_MAX = 0.95; // this < ratio <= ... => too-easy above; ideal is [TOO_HARD_MAX, IDEAL_MAX]

/**
 * Reduce tokens to the content-word lemmas ("base" forms) used for
 * comprehension scoring, dropping particles/auxiliaries/symbols and any
 * token kuromoji couldn't resolve a usable base form for.
 */
export function contentLemmas(tokens: Token[]): string[] {
  return tokens
    .filter((t) => CONTENT_POS_TAGS.has(t.pos) && t.base.trim().length > 0)
    .map((t) => t.base);
}

/**
 * Score how comprehensible a video is for a learner: what fraction of its
 * content-word occurrences are already in their known-vocab set.
 *
 * Counts occurrences (not distinct lemmas) so repeated common words — which
 * dominate a learner's actual viewing experience — weigh accordingly.
 */
export function scoreComprehension(
  contentLemmasList: string[],
  knownLemmas: Set<string>,
): ComprehensionScore {
  const totalWords = contentLemmasList.length;

  if (totalWords === 0) {
    return { totalWords: 0, knownWords: 0, knownRatio: 0, band: "insufficient-data" };
  }

  const knownWords = contentLemmasList.reduce((count, lemma) => count + (knownLemmas.has(lemma) ? 1 : 0), 0);
  const knownRatio = knownWords / totalWords;

  let band: ComprehensionBand;
  if (knownRatio < TOO_HARD_MAX) {
    band = "too-hard";
  } else if (knownRatio > IDEAL_MAX) {
    band = "too-easy";
  } else {
    band = "ideal";
  }

  return { totalWords, knownWords, knownRatio, band };
}
