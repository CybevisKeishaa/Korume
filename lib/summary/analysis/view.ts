import type { Commonness } from "./schema";

/**
 * What the lesson-analysis route returns and the client island renders (spec §4.5). Pure types: every fact
 * here (reading, meaning, POS, JLPT, grammar title) was hydrated from the database on read, never from the AI.
 */
export type PosKey = "noun" | "verb" | "adjective" | "adverb" | "expression" | "other";

export interface LineRef {
  lineId: string;
  textJp: string;
  startTime: number;
  endTime: number | null;
}

export interface WordView {
  entSeq: number;
  surface: string;
  written: string;
  reading: string;
  meaning: string;
  posKey: PosKey;
  jlpt: string | null;
  common: boolean;
  whyItMatters: string;
  usageNote: string;
  source: LineRef;
}

export interface ExpressionView {
  expression: string;
  commonness: Commonness;
  meaningUse: string;
  nuance: string;
  source: LineRef;
}

export interface GrammarView {
  grammarId: string;
  title: string;
  jlpt: string | null;
  meaningShort: string;
  explanation: string;
  tryIt: string;
  span: string;
  source: LineRef;
}

export interface CultureView {
  title: string;
  body: string;
  source: LineRef;
}

export interface LessonAnalysisView {
  overview: string;
  words: WordView[];
  expressions: ExpressionView[];
  grammar: GrammarView[];
  culture: CultureView[];
}

export type AnalysisResponse =
  | { status: "ready"; data: LessonAnalysisView }
  | { status: "pending"; retryAfterMs: number }
  | { status: "not_ready" }
  | { status: "retryable_error"; retryAfter: string }
  | { status: "unavailable" }
  | { status: "no_transcript" };

/** JMdict POS arrives as an entity code (`n`, `v5r`, `adj-na`) or its expansion; both map to one display key. */
export function posKey(code: string | null | undefined): PosKey {
  const value = (code ?? "").toLowerCase();
  if (value.startsWith("adj") || value.includes("adjective")) return "adjective";
  if (value.startsWith("adv") || value.includes("adverb")) return "adverb";
  if (value.startsWith("exp") || value.includes("expression")) return "expression";
  if (value.startsWith("v") || value.includes("verb")) return "verb";
  if (value === "n" || value.startsWith("n-") || value.includes("noun")) return "noun";
  return "other";
}
