/**
 * The deterministic analysis contract (spec §5.1). Plain DTOs only: every value here crosses the
 * server → client boundary.
 */

/** UTF-16 code-unit offsets into `transcript_lines.text_jp`, end exclusive — what String#slice takes. */
export interface Utf16Span {
  start: number;
  end: number;
}

export interface DictionaryMatch {
  entSeq: number;
  headword: string;
  reading: string;
  glossEn: string;
  jlpt: number | null;
}

export interface AnalysisToken {
  index: number;
  surface: string;
  base: string;
  /** Katakana, as kuromoji reports it; null for unknown words and symbols. */
  reading: string | null;
  pos: string;
  span: Utf16Span;
  /** At most three JMdict entries, best first. Empty for particles, auxiliaries and symbols. */
  entries: DictionaryMatch[];
  /** The curated `vocab` row this token is, when one exists. */
  vocabId: string | null;
}

export interface GrammarMatch {
  grammarPointId: string;
  title: string;
  structure: string | null;
  /** The curated grammar point's own explanation and examples (grammar_points), shown by the Grammar tab. */
  explanation: string | null;
  examples: { jp: string; en: string }[];
  span: Utf16Span;
}

export type AnalysisScope = "lexical" | "full";

/** Shared by every learner: cached per (lineId, snapshotId, grammarRevision). Never holds learner state. */
export interface StaticLineAnalysis {
  lineId: string;
  /** null before the first dictionary import: tokens and grammar still work, entries are empty. */
  snapshotId: string | null;
  tokens: AnalysisToken[];
  grammar: GrammarMatch[];
}

export type LexicalLineAnalysis = Omit<StaticLineAnalysis, "grammar">;

/** The static analysis joined, per request, with this learner's SRS stage for each vocab id. */
export interface LineAnalysisDto extends StaticLineAnalysis {
  mastery: Record<string, number>;
}

export type LexicalLineAnalysisDto = Omit<LineAnalysisDto, "grammar">;

export interface LessonVocabularyItem {
  entSeq: number;
  headword: string;
  reading: string;
  glossEn: string;
  occurrences: number;
  jlpt: number | null;
  vocabId: string | null;
  /** This learner's SRS stage, or null when the word is not curated or not yet studied. */
  mastery: number | null;
  exampleLineIds: string[];
  /** The word as written in `exampleLineIds[0]` (e.g. 食べた for 食べる): what a saved card highlights in that line. */
  exampleSurface: string;
}

export interface LessonVocabularyPage {
  items: LessonVocabularyItem[];
  nextCursor: string | null;
  total: number;
}

export interface GlossDto {
  entSeq: number;
  status: "ready" | "missing" | "pending";
  glossesVi: string[];
  note: string | null;
  source: "vocab" | "ai" | null;
}
