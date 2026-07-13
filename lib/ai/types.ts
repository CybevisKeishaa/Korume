/**
 * Public data shapes for `lib/ai`. These are the contract the backend-engineer
 * codes routes against — every persisted result carries `model` so AI output is
 * always traceable and labellable (CLAUDE.md §2.3).
 */
import type { AI_SOURCE } from "./constants";

/** Coarse JLPT-ish level used to steer register and vocabulary. */
export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";

/**
 * A single conversation turn as stored/sent by the app. `ai` is mapped to the
 * Anthropic `assistant` role internally — callers never deal with API roles.
 */
export interface ConversationTurn {
  role: "user" | "ai";
  content: string;
}

/** Input to {@link import("./conversation").conversationReply}. */
export interface ConversationReplyInput {
  scenario: ScenarioId;
  level: JlptLevel;
  /** Prior turns, oldest first. May be empty (the AI opens the scene). */
  messages: ConversationTurn[];
}

/** Result of a conversation turn. `truncated` is true if the reply hit the cap. */
export interface ConversationReplyResult {
  reply: string;
  truncated: boolean;
  model: string;
}

/** One grammar/usage correction of a user utterance. `explanation` is English. */
export interface CorrectionItem {
  original: string;
  corrected: string;
  explanation: string;
}

/** Result of analysing a finished session's user utterances. */
export interface SessionCorrectionsResult {
  corrections: CorrectionItem[];
  /** One-line English encouragement. */
  encouragement: string;
  model: string;
}

/** Sanitized transcript passed to the summariser (server supplies the lines). */
export interface SummarizeTranscriptInput {
  title: string;
  /** Already-sanitized transcript lines from the DB, in order. */
  lines: string[];
}

/** A key-vocabulary entry, matching the `video_summaries.key_vocab` jsonb shape. */
export interface KeyVocab {
  word: string;
  reading: string;
  meaning: string;
}

/** A key-grammar entry, matching the `video_summaries.key_grammar` jsonb shape. */
export interface KeyGrammar {
  pattern: string;
  explanation: string;
}

/** Result of summarising a transcript; maps 1:1 onto `video_summaries` columns. */
export interface VideoSummaryResult {
  summary: string;
  keyVocab: KeyVocab[];
  keyGrammar: KeyGrammar[];
  model: string;
  /** True if the transcript was truncated before summarising. */
  inputTruncated: boolean;
}

/** Input to {@link import("./examples").generateExamples}. */
export interface GenerateExamplesInput {
  word: string;
  reading: string;
  meaning: string;
  level: JlptLevel;
}

/** A single example sentence with its English translation. */
export interface ExampleSentence {
  sentenceJp: string;
  sentenceTranslation: string;
}

/**
 * Result of example-sentence generation. `source` is fixed to `ai_generated`
 * so the caller can insert straight into `vocab_examples` — these MUST be
 * human-reviewed before publish (CLAUDE.md §3.3).
 */
export interface GenerateExamplesResult {
  examples: ExampleSentence[];
  model: string;
  source: typeof AI_SOURCE;
}

/** The scenarios the conversation chatbot can role-play. */
export type ScenarioId =
  | "restaurant"
  | "interview"
  | "shopping"
  | "directions"
  | "free-talk";
