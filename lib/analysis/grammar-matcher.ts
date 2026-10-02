import type { GrammarMatch, Utf16Span } from "./types";

export interface GrammarPattern {
  id: string;
  title: string;
  structurePattern: string | null;
  explanation?: string | null;
  examples?: { jp: string; en: string }[];
}

interface MatchableToken {
  surface: string;
  base: string;
  pos: string;
  span: Utf16Span;
}

/**
 * The literal Japanese of a human-written `structure_pattern` such as `〔verb ない-stem〕なければならない`:
 * slots in 〔〕 are dropped, and so are tildes, spaces and the slot descriptions inside them.
 */
export function patternFragments(structure: string | null): string[] {
  if (!structure) return [];
  return structure
    .replace(/〔[^〕]*〕/g, " ")
    .replace(/[〜～~]/g, " ")
    .split(/\s+/)
    .filter((fragment) => /[぀-ヿ㐀-鿿]/.test(fragment));
}

/**
 * The tokens from `from` that spell `fragment` exactly — the last one may be conjugated, so it also counts by
 * its base form (しまっ → しまう). Matching whole tokens is what keeps は out of はなし. A one-character
 * fragment must be a particle, so the topic は never matches the noun 歯 read as は.
 */
function matchAt(tokens: MatchableToken[], from: number, fragment: string): number | null {
  let spelled = "";
  for (let index = from; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) return null;
    if (spelled + token.surface === fragment || spelled + token.base === fragment) {
      if (fragment.length === 1 && token.pos !== "助詞") return null;
      return index;
    }
    spelled += token.surface;
    if (spelled.length >= fragment.length || !fragment.startsWith(spelled)) return null;
  }
  return null;
}

/** Every occurrence of every pattern, in sentence order; a pattern's fragments must appear in order. */
export function matchGrammar(tokens: MatchableToken[], patterns: GrammarPattern[]): GrammarMatch[] {
  const matches: GrammarMatch[] = [];
  for (const pattern of patterns) {
    const fragments = patternFragments(pattern.structurePattern);
    const [head, ...rest] = fragments;
    if (!head) continue;
    for (let start = 0; start < tokens.length; start += 1) {
      // The first fragment is anchored at `start`; later ones may follow after other words.
      let end = matchAt(tokens, start, head);
      for (const fragment of rest) {
        if (end === null) break;
        let found: number | null = null;
        for (let at = end + 1; at < tokens.length && found === null; at += 1) found = matchAt(tokens, at, fragment);
        end = found;
      }
      const from = tokens[start];
      const to = end === null ? undefined : tokens[end];
      if (!from || !to || end === null) continue;
      matches.push({
        grammarPointId: pattern.id,
        title: pattern.title,
        structure: pattern.structurePattern,
        explanation: pattern.explanation ?? null,
        examples: (pattern.examples ?? []).map((example) => ({ ...example })),
        span: { start: from.span.start, end: to.span.end },
      });
      start = end;
    }
  }
  return matches.sort((a, b) => a.span.start - b.span.start || a.span.end - b.span.end);
}
