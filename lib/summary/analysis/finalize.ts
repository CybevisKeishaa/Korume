import { FinalizeError } from "@/lib/knowledge/leased";
import type { AnalysisInput, PromptLine } from "./input";
import { analysisAiSchema, cultureItem, expressionItem, grammarItem, wordItem, type StoredAnalysis } from "./schema";

const CAPS = { words: 6, expressions: 5, grammar: 4, culture: 3 } as const;

/** The span as stored when it is really in the line (NFKC both sides, substring — never offsets), else null. */
function spanIn(line: PromptLine, span: string): string | null {
  const normalized = span.normalize("NFKC").trim();
  return normalized !== "" && line.textJp.normalize("NFKC").includes(normalized) ? normalized : null;
}

/**
 * Owner 2026-10-05: the prompt forbids JLPT levels and romaji in culture notes, yet live v2 output still said
 * "N3/N2". A note matching one of these high-confidence patterns is dropped whole — never edited. Plain Latin words
 * are not a signal (vi/en prose is Latin), so romaji is caught only as Japanese text followed by a Latin gloss in
 * brackets, e.g. 空気を読む (kuuki wo yomu).
 */
const JLPT = [/\bJLPT\b/i, /(?<![A-Za-z0-9])N[1-5](?![A-Za-z0-9])/];
/**
 * One romanized word: Hepburn syllables, syllabic n, or a doubled consonant (small tsu). Every branch starts on a
 * different letter sequence, so a failing word cannot backtrack exponentially ("tsutsu…x" is linear).
 */
const HEPBURN_WORD = /^(?:(?:[kgsztdnhbpmrjfwy]|sh|ch|ts|[kgnhbpmr]y)?[aiueoāīūēō]|n(?![aiueoy])|([kspgt])(?=\1)|t(?=ch))+$/i;
/**
 * Spelling English (almost) never produces but romaji routinely does; scanning as Hepburn alone also fits "see you".
 * Deliberately absent, each an English gloss that would be dropped: doubled consonants (button), shi/chi (shine),
 * nn (inn), a non-final ou (house).
 */
const ROMAJI_MARKER = /(?:ou|uu)$|[āīūēō]|tsu|(?:masu|masen|mashita|desu|deshita)$|^(?:wo|wa|ga)$/i;
const ENGLISH_LOOKALIKE = /^you$/i;
const BRACKETED_AFTER_JAPANESE =
  /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}][」』]?\s*[(（[［]([^()（）[\]［］]{1,80})[)）\]］]/gu;

// ponytail: romaji is caught only bracketed after Japanese and carrying a romaji-only marker; bare romaji in prose
// and marker-less romaji ("(sakana)") still rely on the prompt.
function hasRomajiGloss(text: string): boolean {
  for (const match of text.matchAll(BRACKETED_AFTER_JAPANESE)) {
    const words = (match[1] ?? "").trim().split(/[\s'-]+/).filter(Boolean);
    if (words.length > 0 && words.every((word) => HEPBURN_WORD.test(word)) && words.some((word) => ROMAJI_MARKER.test(word) && !ENGLISH_LOOKALIKE.test(word))) {
      return true;
    }
  }
  return false;
}

export function cultureOutOfContract(text: string): boolean {
  return JLPT.some((pattern) => pattern.test(text)) || hasRomajiGloss(text);
}

/** Spec §4.4: strict per item, ids and spans checked against this request, duplicates and overflow dropped. */
export function finalizeAnalysis(parsed: unknown, input: AnalysisInput): StoredAnalysis {
  const raw = analysisAiSchema.parse(parsed);
  const lineOf = new Map(input.lines.map((line) => [line.shortId, line]));
  const wordOf = new Map(input.vocabulary.map((item) => [item.shortId, item]));
  const grammarOf = new Map(input.grammar.map((item) => [item.shortId, item]));
  const result: StoredAnalysis = { overview: raw.overview.trim().slice(0, 400), words: [], expressions: [], grammar: [], culture: [] };

  const seenWords = new Set<number>();
  for (const item of raw.words) {
    const strict = item ? wordItem.safeParse(item) : null;
    const candidate = strict?.success ? wordOf.get(strict.data.candidate_id) : undefined;
    if (!strict?.success || !candidate || seenWords.has(candidate.entSeq) || result.words.length >= CAPS.words) continue;
    seenWords.add(candidate.entSeq);
    result.words.push({ entSeq: candidate.entSeq, surface: candidate.surface, sourceLineId: candidate.lineId, whyItMatters: strict.data.why_it_matters, usageNote: strict.data.usage_note });
  }
  const seenExpressions = new Set<string>();
  for (const item of raw.expressions) {
    const strict = item ? expressionItem.safeParse(item) : null;
    const line = strict?.success ? lineOf.get(strict.data.line) : undefined;
    const span = strict?.success && line ? spanIn(line, strict.data.span) : null;
    if (!strict?.success || !line || !span || seenExpressions.has(`${line.id}|${span}`) || result.expressions.length >= CAPS.expressions) continue;
    seenExpressions.add(`${line.id}|${span}`);
    result.expressions.push({ sourceLineId: line.id, span, meaningUse: strict.data.meaning_use, nuance: strict.data.nuance, commonness: strict.data.commonness });
  }
  const seenGrammar = new Set<string>();
  for (const item of raw.grammar) {
    const strict = item ? grammarItem.safeParse(item) : null;
    const candidate = strict?.success ? grammarOf.get(strict.data.candidate_id) : undefined;
    if (!strict?.success || !candidate || seenGrammar.has(candidate.grammarId) || result.grammar.length >= CAPS.grammar) continue;
    seenGrammar.add(candidate.grammarId);
    result.grammar.push({ grammarId: candidate.grammarId, sourceLineId: candidate.lineId, span: candidate.span, meaningShort: strict.data.meaning_short, explanation: strict.data.explanation, tryIt: strict.data.try_it });
  }
  const seenCulture = new Set<string>();
  for (const item of raw.culture) {
    const strict = item ? cultureItem.safeParse(item) : null;
    const line = strict?.success ? lineOf.get(strict.data.line) : undefined;
    if (!strict?.success || !line || seenCulture.has(`${line.id}|${strict.data.title}`) || result.culture.length >= CAPS.culture) continue;
    if (cultureOutOfContract(`${strict.data.title}\n${strict.data.body}`)) continue;
    seenCulture.add(`${line.id}|${strict.data.title}`);
    result.culture.push({ sourceLineId: line.id, title: strict.data.title, body: strict.data.body });
  }

  const offered = input.vocabulary.length > 0 || input.grammar.length > 0;
  if (offered && result.words.length === 0 && result.grammar.length === 0) {
    throw new FinalizeError("no grounded word or grammar item survived validation");
  }
  return result;
}
