/**
 * Video-transcript summarisation: produces a summary plus key vocab and grammar
 * for the `video_summaries` table. Transcript input is capped deterministically
 * and the model is told when it was truncated. Enables adaptive thinking (the
 * extraction benefits from reasoning) and uses the largest token budget.
 */
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient } from "./client";
import { AI_MODEL, MAX_TOKENS, TRANSCRIPT_CHAR_CAP } from "./constants";
import { toAiError } from "./errors";
import { requireParsed } from "./run";
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
 * are passed to Claude as-is (they were validated/sanitized at import time,
 * and this module does not re-sanitize); XSS safety for the OUTPUT rests on
 * React text rendering at the display layer. Returns `inputTruncated` so the
 * caller knows whether the whole transcript was seen.
 */
export async function summarizeTranscript(
  input: SummarizeTranscriptInput,
): Promise<VideoSummaryResult> {
  const client = getClient();
  const { text, truncated } = capTranscript(input.lines);

  const truncationNote = truncated
    ? "\n\n(Note: the transcript was truncated for length; summarise what is present.)"
    : "";
  const userContent = `Title: ${input.title}\n\nTranscript:\n${text}${truncationNote}`;

  try {
    const response = await client.messages.parse({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS.summary,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: SUMMARY_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
      output_config: { format: zodOutputFormat(VideoSummarySchema) },
    });

    const parsed = requireParsed(response.parsed_output);
    return {
      summary: parsed.summary,
      keyVocab: parsed.keyVocab,
      keyGrammar: parsed.keyGrammar,
      model: response.model,
      inputTruncated: truncated,
    };
  } catch (err) {
    throw toAiError(err);
  }
}
