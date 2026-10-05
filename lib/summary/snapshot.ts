import { z } from "zod";
import { scoreDictation } from "@/lib/dictation/score";
import {
  REVIEW_DICTATION_BELOW,
  REVIEW_PRONUNCIATION_BELOW,
  STRONG_PRONUNCIATION_AT,
} from "./thresholds";

export type ModeState =
  | { kind: "not_started" }
  | { kind: "in_progress"; percent: number }
  | { kind: "complete" }
  | { kind: "scored"; score: number }
  | { kind: "not_enough_data" };

export interface LessonStatus {
  shadowing: ModeState;
  pronunciation: ModeState;
  listening: ModeState;
  retention: ModeState;
}

export type RetentionTile = { kind: "count"; value: number } | { kind: "not_enough_data" };

export interface SavedKnowledge {
  vocabulary: number;
  expressions: number;
  grammar: number;
  retention: RetentionTile;
}

export type ReviewReason = "pronunciation" | "pitch" | "dictation" | "difficult" | "grammar";

export interface ReviewTarget {
  lineId: string;
  lineText: string;
  reasons: ReviewReason[];
  focusSpan: string | null;
}

export interface LessonSnapshot {
  status: LessonStatus;
  savedKnowledge: SavedKnowledge;
  reviewTargets: ReviewTarget[];
  bestLine: { lineId: string; lineText: string } | null;
}

export interface SummaryLine {
  id: string;
  index: number;
  textJp: string;
  translation: string | null;
  startTime: number;
  endTime: number | null;
}

export interface SavedCard {
  cardId: string;
  kind: "vocabulary" | "expression";
  ref: string;
  lineId: string;
}

const numeric = z.coerce.number();

export const lessonEvidenceSchema = z.object({
  hasTranscript: z.boolean(),
  lineCount: numeric,
  shadowedLines: numeric,
  pronunciationMean: numeric.nullable(),
  dictationMean: numeric.nullable(),
  completed: z.boolean(),
  cards: z.object({
    total: numeric,
    mastered: numeric,
    reviewedAny: z.boolean(),
    vocabularyRefs: numeric,
    expressionRefs: numeric,
    knowledgeRemembered: numeric,
    knowledgeReviewedAny: z.boolean(),
  }),
  lines: z.array(z.object({
    lineId: z.string(),
    pronunciation: numeric.nullable(),
    pitch: numeric.nullable(),
    dictation: numeric.nullable(),
    dictationInput: z.string().nullable(),
    difficult: z.boolean(),
  })),
  saved: z.array(z.object({
    cardId: z.string(),
    kind: z.enum(["vocabulary", "expression"]),
    ref: z.string(),
    lineId: z.string(),
  })),
});

export type LessonEvidence = z.infer<typeof lessonEvidenceSchema>;

export const REVIEW_TARGET_DISPLAY_LIMIT = 5;

const round = (value: number): number => Math.round(value);

export function mistakeSpan(reference: string, input: string): string | null {
  const run: string[] = [];
  for (const op of scoreDictation(reference, input).diff) {
    if (op.type === "match") {
      if (run.length > 0) break;
      continue;
    }
    if (op.type === "extra") continue;
    if (op.expected) run.push(op.expected);
  }
  return run.length > 0 ? run.join("").slice(0, 50) : null;
}

function shadowingState(evidence: LessonEvidence): ModeState {
  if (evidence.lineCount === 0 || evidence.shadowedLines === 0) return { kind: "not_started" };
  if (evidence.shadowedLines >= evidence.lineCount) return { kind: "complete" };
  return { kind: "in_progress", percent: round((100 * evidence.shadowedLines) / evidence.lineCount) };
}

const meanState = (mean: number | null): ModeState => (
  mean === null ? { kind: "not_started" } : { kind: "scored", score: round(mean) }
);

function retentionState(cards: LessonEvidence["cards"]): ModeState {
  if (cards.total === 0 || !cards.reviewedAny) return { kind: "not_enough_data" };
  return { kind: "scored", score: round((100 * cards.mastered) / cards.total) };
}

export function buildLessonSnapshot(
  evidence: LessonEvidence,
  lines: SummaryLine[],
  grammarSpans: Map<string, string[]>,
  grammarSaved: number,
): LessonSnapshot {
  const byId = new Map(lines.map((line) => [line.id, line]));
  const targets: (ReviewTarget & { order: number; minScore: number })[] = [];
  let best: { lineId: string; lineText: string; score: number } | null = null;

  for (const row of evidence.lines) {
    const line = byId.get(row.lineId);
    if (!line) continue;
    const reasons: ReviewReason[] = [];
    if (row.pronunciation !== null && row.pronunciation < REVIEW_PRONUNCIATION_BELOW) reasons.push("pronunciation");
    if (row.pitch !== null && row.pitch < REVIEW_PRONUNCIATION_BELOW) reasons.push("pitch");
    const dictationWeak = row.dictation !== null && row.dictation < REVIEW_DICTATION_BELOW;
    if (dictationWeak) reasons.push("dictation");
    if (row.difficult) reasons.push("difficult");
    if (row.pronunciation !== null && row.pronunciation >= STRONG_PRONUNCIATION_AT && (!best || row.pronunciation > best.score)) {
      best = { lineId: line.id, lineText: line.textJp, score: row.pronunciation };
    }
    if (reasons.length === 0) continue;
    const grammar = grammarSpans.get(line.id)?.[0] ?? null;
    if (grammar) reasons.push("grammar");
    const dictationSpan = dictationWeak && row.dictationInput ? mistakeSpan(line.textJp, row.dictationInput) : null;
    const scores = [row.pronunciation, row.pitch, row.dictation].filter((score): score is number => score !== null);
    targets.push({
      lineId: line.id,
      lineText: line.textJp,
      reasons,
      focusSpan: dictationSpan ?? grammar,
      order: line.index,
      minScore: scores.length > 0 ? Math.min(...scores) : 101,
    });
  }

  targets.sort((a, b) => b.reasons.length - a.reasons.length || a.minScore - b.minScore || a.order - b.order);
  return {
    status: {
      shadowing: shadowingState(evidence),
      pronunciation: meanState(evidence.pronunciationMean),
      listening: meanState(evidence.dictationMean),
      retention: retentionState(evidence.cards),
    },
    savedKnowledge: {
      vocabulary: evidence.cards.vocabularyRefs,
      expressions: evidence.cards.expressionRefs,
      grammar: grammarSaved,
      retention: evidence.cards.knowledgeReviewedAny
        ? { kind: "count", value: evidence.cards.knowledgeRemembered }
        : { kind: "not_enough_data" },
    },
    reviewTargets: targets.map((target) => ({
      lineId: target.lineId,
      lineText: target.lineText,
      reasons: target.reasons,
      focusSpan: target.focusSpan,
    })),
    bestLine: best ? { lineId: best.lineId, lineText: best.lineText } : null,
  };
}
