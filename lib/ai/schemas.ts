/**
 * Zod schemas for structured Claude outputs. These are passed to
 * `messages.parse()` via `zodOutputFormat`, which emits a JSON schema with
 * `additionalProperties: false` on every object automatically.
 *
 * IMPORTANT: `zodOutputFormat` consumes `zod/v4` schemas (the SDK helper
 * imports `zod/v4`), so these are defined against `zod/v4` — distinct from the
 * app's `zod` (v3) validators. Structured-output schema limits: no recursive
 * schemas and no numeric/length constraints (`.min`/`.max`/`.length`); required
 * cardinality (e.g. "3 examples") is expressed in the prompt, not the schema.
 */
import { z } from "zod/v4";

/** Post-session grammar corrections + one-line encouragement. */
export const CorrectionsSchema = z.object({
  corrections: z.array(
    z.object({
      original: z.string(),
      corrected: z.string(),
      explanation: z.string(),
    }),
  ),
  encouragement: z.string(),
});

/** Video summary with key vocab and grammar (maps to `video_summaries`). */
export const VideoSummarySchema = z.object({
  summary: z.string(),
  keyVocab: z.array(
    z.object({
      word: z.string(),
      reading: z.string(),
      meaning: z.string(),
    }),
  ),
  keyGrammar: z.array(
    z.object({
      pattern: z.string(),
      explanation: z.string(),
    }),
  ),
});

/** Example-sentence generation output (stored in `vocab_examples`). */
export const ExamplesSchema = z.object({
  examples: z.array(
    z.object({
      sentenceJp: z.string(),
      sentenceTranslation: z.string(),
    }),
  ),
});
