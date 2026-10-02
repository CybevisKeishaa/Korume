import { z } from "zod";
import type { KnowledgeLocale } from "@/lib/knowledge/types";

/**
 * The client names a line, a section and a locale — never text, tier, variant, credits or price (spec §5.3).
 * Unknown fields are a 400. Whether a section exists, and whether it takes a span, is the registry's call.
 */
export const knowledgeSectionRequestSchema = z.object({
  transcriptLineId: z.string().uuid(),
  section: z.string().regex(/^[a-z_]{1,40}$/),
  locale: z.enum(["vi", "en"] satisfies [KnowledgeLocale, KnowledgeLocale]),
  /** UTF-16 offsets into the line's text_jp, end exclusive. */
  span: z.object({ start: z.number().int().min(0), end: z.number().int().min(1) }).strict()
    .refine((span) => span.start < span.end, "start must be before end")
    .optional(),
}).strict();

export type KnowledgeSectionRequest = z.infer<typeof knowledgeSectionRequestSchema>;
