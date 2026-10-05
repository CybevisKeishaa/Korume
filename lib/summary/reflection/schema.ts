import { z } from "zod/v4";
import { FinalizeError } from "@/lib/knowledge/leased";

export const LESSON_REFLECTION = {
  section: "lesson_reflection", schemaVersion: 1, generatorVersion: 1, maxOutputTokens: 400,
} as const;

/**
 * What Gemini sees: plain strings in a loose object — the shapes measured live on 2026-10-04. "No highlight" is two
 * empty strings rather than `null`: no schema in this repo has sent a nullable field to Gemini yet, so none starts here.
 */
export const reflectionAiSchema = z.looseObject({ text: z.string(), highlight_line_id: z.string(), highlight_span: z.string() });
const strict = z.strictObject({ text: z.string().trim().min(1).max(400), highlight_line_id: z.string(), highlight_span: z.string() });

export const storedReflectionSchema = z.object({
  text: z.string(),
  highlight: z.object({ lineId: z.string(), span: z.string() }).nullable(),
});
export type StoredReflection = z.infer<typeof storedReflectionSchema>;

/** Spec §5.3: strict, no digits, no Japanese quotation in text; the highlight is kept only if it is really in its line. */
export function finalizeReflection(parsed: unknown, lines: Map<string, { id: string; textJp: string }>): StoredReflection {
  const result = strict.safeParse(parsed);
  if (!result.success) throw new FinalizeError("reflection does not match its contract");
  const { text, highlight_line_id: lineKey, highlight_span: span } = result.data;
  if (/[0-9]/.test(text)) throw new FinalizeError("reflection text contains a digit");
  if (/[「」『』]/.test(text)) throw new FinalizeError("reflection text quotes Japanese");
  const line = lineKey ? lines.get(lineKey) : undefined;
  const normalized = span.normalize("NFKC").trim();
  const highlight = line && normalized !== "" && line.textJp.normalize("NFKC").includes(normalized)
    ? { lineId: line.id, span: normalized }
    : null;
  return { text, highlight };
}
