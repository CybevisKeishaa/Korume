/**
 * Video-transcript summarisation: produces a summary plus key vocab and grammar
 * for the `video_summaries` table. Transcript input is capped deterministically
 * and the model is told when it was truncated. Requests reasoning (the
 * extraction benefits from it) on the cacheable `fast` tier — tier and
 * reasoning are independent axes (see `port.ts`).
 *
 * Speaks the provider-agnostic port (`AiProvider`) — never a specific SDK. The
 * active provider is injected via an optional last parameter defaulting to
 * `getProvider()` (the repo's clock-injection convention, per `lib/gamification`).
 */
import type { AiProvider } from "./port";
import { MAX_TOKENS, TRANSCRIPT_CHAR_CAP } from "./constants";
import { getProvider } from "./registry";
import { VideoSummarySchema } from "./schemas";
import type { SummarizeTranscriptInput, VideoSummaryResult } from "./types";

const SUMMARY_SYSTEM =
  "You summarise Japanese video transcripts for language learners. " +
  "Given a title and transcript, produce: a concise English summary of the content; " +
  "a list of key vocabulary (each with the Japanese word, its reading in hiragana/katakana, and an English meaning); " +
  "and a list of key grammar points (each with the pattern and a short English explanation). " +
  "Choose genuinely useful, level-appropriate items — do not pad the lists.";

/** Joins and truncates transcript lines at {@link TRANSCRIPT_CHAR_CAP}. */
function capTranscript(lines: string[]): { text: string; truncated: boolean } {
  const joined = lines.join("\n");
  if (joined.length <= TRANSCRIPT_CHAR_CAP) {
    return { text: joined, truncated: false };
  }
  return { text: joined.slice(0, TRANSCRIPT_CHAR_CAP), truncated: true };
}

/**
 * Summarises transcript lines into `{summary, keyVocab, keyGrammar}`. Lines
 * are passed to the model as-is (they were validated/sanitized at import time,
 * and this module does not re-sanitize); XSS safety for the OUTPUT rests on
 * React text rendering at the display layer. Returns `inputTruncated` so the
 * caller knows whether the whole transcript was seen.
 */
export async function summarizeTranscript(
  input: SummarizeTranscriptInput,
  provider: AiProvider = getProvider(),
): Promise<VideoSummaryResult> {
  const { text, truncated } = capTranscript(input.lines);

  const truncationNote = truncated
    ? "\n\n(Note: the transcript was truncated for length; summarise what is present.)"
    : "";
  const userContent = `Title: ${input.title}\n\nTranscript:\n${text}${truncationNote}`;

  const result = await provider.generateStructured(
    {
      tier: "fast", // cacheable — per the product's cost model
      reasoning: true, // the extraction benefits from reasoning
      maxTokens: MAX_TOKENS.summary,
      system: [{ text: SUMMARY_SYSTEM, cacheable: true }],
      messages: [{ role: "user", content: userContent }],
    },
    VideoSummarySchema,
  );

  return {
    summary: result.parsed.summary,
    keyVocab: result.parsed.keyVocab,
    keyGrammar: result.parsed.keyGrammar,
    model: result.model,
    inputTruncated: truncated,
  };
}
