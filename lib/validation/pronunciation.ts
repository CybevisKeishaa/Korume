import { z } from "zod";

/**
 * POST /api/pronunciation/score — multipart form fields (audio arrives as a
 * separate file part; see `validateAudioSize` in `lib/validation/audio.ts`).
 * `referenceText` is the transcript line the user was shadowing;
 * `shadowingSessionId` is optional — when present, the score is persisted
 * onto that (owned) `shadowing_sessions` row.
 */
export const pronunciationScoreFieldsSchema = z.object({
  referenceText: z
    .string()
    .trim()
    .min(1, "Reference text is required.")
    .max(500, "Reference text is too long (max 500 characters)."),
  shadowingSessionId: z.string().uuid().optional(),
});
export type PronunciationScoreFields = z.infer<typeof pronunciationScoreFieldsSchema>;
