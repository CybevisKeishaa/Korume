import { z } from "zod/v4";

export const LESSON_ANALYSIS = { section: "lesson_analysis", schemaVersion: 1, generatorVersion: 1, maxOutputTokens: 4000 } as const;
export const COMMONNESS = ["very_common", "common", "situational"] as const;
export type Commonness = (typeof COMMONNESS)[number];

const text = (max: number) => z.string().trim().min(1).max(max);
/** Strict item contracts, applied one item at a time in finalize: an item with any extra field is dropped (spec §4.3). */
export const wordItem = z.strictObject({ candidate_id: z.string(), why_it_matters: text(600), usage_note: text(600) });
// span ≤ 50: the expression becomes a mining card's target_word, which POST /api/mining caps at 50 characters.
export const expressionItem = z.strictObject({ line: z.string(), span: text(50), meaning_use: text(600), nuance: text(600), commonness: z.enum(COMMONNESS) });
export const grammarItem = z.strictObject({ candidate_id: z.string(), meaning_short: text(120), explanation: text(800), try_it: text(200) });
export const cultureItem = z.strictObject({ line: z.string(), title: text(120), body: text(800) });

/**
 * What Gemini sees and the adapter parses: plain strings (no length or enum keywords) in loose objects that fall
 * back to null, so one malformed item never fails the whole artifact. Measured on Gemini 2026-10-04: accepted.
 */
// The runtime schema is exactly the measured `looseObject(...).catch(null)`; zod's types reject a null fallback for
// an object, so the result type is stated rather than changing the schema Gemini receives.
const loose = (shape: Record<string, z.ZodType>) =>
  z.looseObject(shape).catch(null as never) as unknown as z.ZodType<Record<string, unknown> | null>;
export const analysisAiSchema = z.object({
  overview: z.string(),
  words: z.array(loose({ candidate_id: z.string(), why_it_matters: z.string(), usage_note: z.string() })),
  expressions: z.array(loose({ line: z.string(), span: z.string(), meaning_use: z.string(), nuance: z.string(), commonness: z.string() })),
  grammar: z.array(loose({ candidate_id: z.string(), meaning_short: z.string(), explanation: z.string(), try_it: z.string() })),
  culture: z.array(loose({ line: z.string(), title: z.string(), body: z.string() })),
});

export const storedAnalysisSchema = z.object({
  overview: z.string(),
  words: z.array(z.object({ entSeq: z.number().int(), surface: z.string(), sourceLineId: z.string(), whyItMatters: z.string(), usageNote: z.string() })),
  expressions: z.array(z.object({ sourceLineId: z.string(), span: z.string(), meaningUse: z.string(), nuance: z.string(), commonness: z.enum(COMMONNESS) })),
  grammar: z.array(z.object({ grammarId: z.string(), sourceLineId: z.string(), span: z.string(), meaningShort: z.string(), explanation: z.string(), tryIt: z.string() })),
  culture: z.array(z.object({ sourceLineId: z.string(), title: z.string(), body: z.string() })),
});
export type StoredAnalysis = z.infer<typeof storedAnalysisSchema>;
