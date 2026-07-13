import { z } from "zod";
import { jlptLevelSchema } from "@/lib/validation/content";

/** GET /api/reading?level=N4 — optional; absent means "all levels". */
export const readingQuerySchema = z.object({
  level: jlptLevelSchema.optional(),
});

/** Chosen-choice index, "0".."3" — matches `reading_questions.correct_answer`'s convention. */
const answerValueSchema = z.enum(["0", "1", "2", "3"]);

/** POST /api/reading/[id]/submit body. `answers` is keyed by question id. */
export const readingSubmitSchema = z.object({
  answers: z.record(z.string().uuid(), answerValueSchema),
});
export type ReadingSubmitInput = z.infer<typeof readingSubmitSchema>;
