import { z } from "zod";
import { jlptLevelSchema } from "@/lib/validation/content";

/** Matches the `jlpt_section` DB enum (see `lib/jlpt/types.ts` `JlptSection`). */
export const jlptSectionSchema = z.enum(["vocab", "grammar", "reading", "listening"]);

export const jlptModeSchema = z.enum(["full", "section"]);

/** GET /api/certification/tests?level=N5 — optional; absent means "all levels". */
export const jlptTestsQuerySchema = z.object({
  level: jlptLevelSchema.optional(),
});

/** GET /api/certification/attempts?testId=... — optional; absent means "all of the caller's attempts". */
export const jlptAttemptsQuerySchema = z.object({
  testId: z.string().uuid().optional(),
});

/** Chosen-choice index, "0".."3" — matches `jlpt_questions.correct_answer`'s convention. */
const answerValueSchema = z.enum(["0", "1", "2", "3"]);

/**
 * POST /api/certification/tests/[id]/submit body. `answers` is keyed by question id;
 * a missing key means unanswered (scored as wrong by `lib/jlpt`). `section`
 * is required exactly when `mode === 'section'` (validated below since zod's
 * object shape can't express a conditional-required field on its own).
 */
export const jlptSubmitSchema = z
  .object({
    answers: z.record(z.string().uuid(), answerValueSchema),
    mode: jlptModeSchema,
    section: jlptSectionSchema.optional(),
    started_at: z.string().datetime().optional(),
  })
  .refine((v) => v.mode !== "section" || v.section !== undefined, {
    message: "section is required when mode is 'section'",
    path: ["section"],
  });
export type JlptSubmitInput = z.infer<typeof jlptSubmitSchema>;
