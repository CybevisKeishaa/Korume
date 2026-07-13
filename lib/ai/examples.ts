/**
 * Example-sentence generation for a vocab word. Returns 3 original sentences at
 * the requested JLPT level, shaped for direct insertion into `vocab_examples`
 * with `source: "ai_generated"`. That tag satisfies the spec's "label AI
 * content" rule (line 317) and is what the UI's visible "AI-generated" badge
 * keys off; it also lets a future human-review/publish gate (not built yet —
 * candidate for the Layer 7 admin tools) find unreviewed rows.
 */
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getClient } from "./client";
import { AI_MODEL, AI_SOURCE, MAX_TOKENS } from "./constants";
import { toAiError } from "./errors";
import { requireParsed } from "./run";
import { ExamplesSchema } from "./schemas";
import type { GenerateExamplesInput, GenerateExamplesResult } from "./types";

const EXAMPLES_SYSTEM =
  "You write original example sentences for Japanese vocabulary study. " +
  "Given a target word (with reading and meaning) and a JLPT level, write exactly 3 natural, original example sentences that use the target word, " +
  "each with a faithful English translation. " +
  "Match the grammar and vocabulary difficulty to the requested level. " +
  "Never copy sentences verbatim from dictionaries or other sources — write your own.";

/**
 * Generates 3 level-appropriate example sentences for `word`. The "exactly 3"
 * requirement lives in the prompt (structured-output schemas can't express
 * array length). Structured output via {@link ExamplesSchema}.
 */
export async function generateExamples(
  input: GenerateExamplesInput,
): Promise<GenerateExamplesResult> {
  const client = getClient();

  const userContent =
    `Target word: ${input.word}\n` +
    `Reading: ${input.reading}\n` +
    `Meaning: ${input.meaning}\n` +
    `JLPT level: ${input.level}\n\n` +
    "Write exactly 3 original example sentences using this word.";

  try {
    const response = await client.messages.parse({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS.examples,
      system: [
        {
          type: "text",
          text: EXAMPLES_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userContent }],
      output_config: { format: zodOutputFormat(ExamplesSchema) },
    });

    const parsed = requireParsed(response.parsed_output);
    return {
      examples: parsed.examples,
      model: response.model,
      source: AI_SOURCE,
    };
  } catch (err) {
    throw toAiError(err);
  }
}
