import { createHash } from "node:crypto";
import { aggregateVocabulary } from "@/lib/analysis/lesson-vocabulary";
import type { StaticLineAnalysis } from "@/lib/analysis/types";

export const VOCABULARY_CANDIDATE_CAP = 60;
export const GRAMMAR_CANDIDATE_CAP = 40;

/** A transcript line as the prompt names it: `L<n>` is request-local and never stored. */
export interface PromptLine { shortId: string; id: string; textJp: string }
export interface VocabularyCandidate { shortId: string; entSeq: number; surface: string; lineId: string }
export interface GrammarCandidate { shortId: string; grammarId: string; lineId: string; span: string }
export interface AnalysisInput { lines: PromptLine[]; vocabulary: VocabularyCandidate[]; grammar: GrammarCandidate[] }

export function buildAnalysisInput(lines: { id: string; textJp: string }[], analyses: Map<string, StaticLineAnalysis>): AnalysisInput {
  const kept = lines.filter((line) => line.textJp.trim() !== "");
  const promptLines = kept.map((line, index) => ({ shortId: `L${index + 1}`, id: line.id, textJp: line.textJp }));
  const aggregated = aggregateVocabulary(kept.flatMap((line) => {
    const analysis = analyses.get(line.id);
    return analysis ? [{ id: line.id, tokens: analysis.tokens }] : [];
  }));
  const vocabulary: VocabularyCandidate[] = [];
  for (const item of aggregated) {
    if (vocabulary.length >= VOCABULARY_CANDIDATE_CAP) break;
    const lineId = item.exampleLineIds[0];
    const token = lineId ? analyses.get(lineId)?.tokens.find((candidate) => candidate.entries[0]?.entSeq === item.entSeq) : undefined;
    if (!lineId || !token) continue;
    vocabulary.push({ shortId: `v${vocabulary.length + 1}`, entSeq: item.entSeq, surface: token.surface, lineId });
  }
  const grammar: GrammarCandidate[] = [];
  const seen = new Set<string>();
  for (const line of kept) {
    for (const match of analyses.get(line.id)?.grammar ?? []) {
      if (grammar.length >= GRAMMAR_CANDIDATE_CAP || seen.has(match.grammarPointId)) continue;
      seen.add(match.grammarPointId);
      grammar.push({ shortId: `g${grammar.length + 1}`, grammarId: match.grammarPointId, lineId: line.id, span: line.textJp.slice(match.span.start, match.span.end) });
    }
  }
  return { lines: promptLines, vocabulary, grammar };
}

/** The cache key's fingerprint (spec §4.1): the canonical AI input actually sent, without its request-local ids. */
export function analysisFingerprint(input: AnalysisInput): string {
  const canonical = JSON.stringify({
    lines: input.lines.map((line) => [line.id, line.textJp]),
    vocabulary: input.vocabulary.map((item) => [item.entSeq, item.surface, item.lineId]),
    grammar: input.grammar.map((item) => [item.grammarId, item.lineId, item.span]),
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
