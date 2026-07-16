/**
 * Example-sentence generation for a vocab word. Returns 3 original sentences at
 * the requested JLPT level, shaped for direct insertion into `vocab_examples`
 * with `source: "ai_generated"`. That tag satisfies the spec's "label AI
 * content" rule (line 317) and is what the UI's visible "AI-generated" badge
 * keys off; it also lets a future human-review/publish gate (not built yet —
 * candidate for the Layer 7 admin tools) find unreviewed rows.
 *
 * Speaks the provider-agnostic port (`AiProvider`) — never a specific SDK. The
 * active provider is injected via an optional last parameter defaulting to
 * `getProvider()` (the repo's clock-injection convention, per `lib/gamification`).
 */
import type { AiProvider } from "./port";
import { AI_SOURCE, MAX_TOKENS } from "./constants";
import { getProvider } from "./registry";
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
  provider: AiProvider = getProvider(),
): Promise<GenerateExamplesResult> {
  const userContent =
    `Target word: ${input.word}\n` +
    `Reading: ${input.reading}\n` +
    `Meaning: ${input.meaning}\n` +
    `JLPT level: ${input.level}\n\n` +
    "Write exactly 3 original example sentences using this word.";

  const result = await provider.generateStructured(
    {
      tier: "fast",
      reasoning: false,
      maxTokens: MAX_TOKENS.examples,
      system: [{ text: EXAMPLES_SYSTEM, cacheable: true }],
      messages: [{ role: "user", content: userContent }],
    },
    ExamplesSchema,
  );

  return {
    examples: result.parsed.examples,
    model: result.model,
    source: AI_SOURCE,
  };
}
