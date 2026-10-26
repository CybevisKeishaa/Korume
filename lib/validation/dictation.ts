import { z } from "zod";
import { MAX_WORD_PIECES } from "../dictation/types";

const index = z.number().int();
const head = {
  videoId: z.string().uuid(),
  lineId: z.string().uuid(),
  version: z.number().int().min(1),
  textHash: z.string().regex(/^[0-9a-f]{64}$/),
  hintedUnits: z.array(index).max(200),
};
const hintUnit = z.enum(["chunk", "grapheme4"]);

/**
 * POST /api/dictation/attempt body: the four strict shapes of spec §5.4. Word Bank carries no `hintUnit`
 * (the server sets `chunk`); index ranges, uniqueness and the permutation are checked by the server
 * against the line it reads (`submitListeningAttempt`).
 */
export const dictationAttemptSchema = z.union([
  z.object({ kind: z.literal("submit"), format: z.literal("word_bank"), ...head, chunkOrder: z.array(index).max(MAX_WORD_PIECES) }).strict(),
  z.object({ kind: z.literal("submit"), format: z.literal("typing"), ...head, input: z.string().max(2000), hintUnit }).strict(),
  z.object({ kind: z.literal("reveal"), format: z.literal("word_bank"), ...head }).strict(),
  z.object({ kind: z.literal("reveal"), format: z.literal("typing"), ...head, hintUnit }).strict(),
]);
export type DictationAttemptInput = z.infer<typeof dictationAttemptSchema>;
