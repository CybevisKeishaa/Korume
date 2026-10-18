import { z } from "zod";
/** The saved take supplies both the audio and server-authored reference text. */
export const scoreSessionSchema = z.object({ sessionId: z.string().uuid() }).strict();
export type ScoreSessionFields = z.infer<typeof scoreSessionSchema>;
/** Conversation audio is ephemeral and can never attach to a shadowing session. */
export const conversationPronunciationSchema = z.object({
  referenceText: z.string().trim().min(1).max(500),
}).strict();
