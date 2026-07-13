import { z } from "zod";
import { jlptLevelSchema } from "@/lib/validation/content";

/** POST /api/vocab/[id]/examples body — `level` overrides the vocab's own
 * `jlpt_level` for the generated sentences' difficulty; optional. */
export const generateVocabExamplesSchema = z.object({
  level: jlptLevelSchema.optional(),
});
export type GenerateVocabExamplesInput = z.infer<typeof generateVocabExamplesSchema>;

/** Once a vocab word has this many AI-generated examples on file, stop
 * generating more and just return what's there — guards against unbounded
 * duplicate generations for a popular word (task brief: cap at 6). */
export const MAX_AI_EXAMPLES_PER_VOCAB = 6;

/**
 * Whether another generation call should actually hit Claude, given how many
 * `ai_generated` examples already exist for this vocab. Pure so the
 * cap/dedup rule is unit-testable without a database.
 */
export function shouldGenerateMoreExamples(
  existingAiGeneratedCount: number,
  cap: number = MAX_AI_EXAMPLES_PER_VOCAB,
): boolean {
  return existingAiGeneratedCount < cap;
}
