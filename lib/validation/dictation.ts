import { z } from "zod";

/** POST /api/dictation/attempt body. */
export const dictationAttemptSchema = z.object({
  videoId: z.string().uuid(),
  lineId: z.string().uuid(),
  userInput: z.string().max(2000),
});
export type DictationAttemptInput = z.infer<typeof dictationAttemptSchema>;
