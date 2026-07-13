/**
 * Server-only Claude wrapper for Layer 4 AI features. Barrel export — the
 * backend-engineer imports from `@/lib/ai`. All functions throw
 * {@link AiNotConfiguredError} when unconfigured and map SDK failures to a
 * typed {@link AiError} (inspect `.kind`). No HTTP route or rate-limiting lives
 * here — that is the backend-engineer's layer on top of these wrappers.
 */
export { isAiConfigured } from "./client";
export { conversationReply, sessionCorrections } from "./conversation";
export { summarizeTranscript } from "./summary";
export { generateExamples } from "./examples";

export { AI_MODEL, AI_SOURCE } from "./constants";
export { SCENARIO_IDS } from "./scenarios";
export { AiError, AiNotConfiguredError, type AiErrorKind } from "./errors";

export type {
  JlptLevel,
  ScenarioId,
  ConversationTurn,
  ConversationReplyInput,
  ConversationReplyResult,
  CorrectionItem,
  SessionCorrectionsResult,
  SummarizeTranscriptInput,
  KeyVocab,
  KeyGrammar,
  VideoSummaryResult,
  GenerateExamplesInput,
  ExampleSentence,
  GenerateExamplesResult,
} from "./types";
