import { z } from "zod";

/** Body for POST /api/companion/memories — pinning a transcript line as a
 * GIFTED memory (spec §4.3). Only pointers + the line's own text + the
 * learner's note; NO media (§2.1). */
export const pinMemorySchema = z.object({
  transcriptLineId: z.string().uuid(),
  videoId: z.string().uuid().optional(),
  lineTextJp: z.string().max(1000).optional(),
  timestampSeconds: z.number().nonnegative().optional(),
  note: z.string().max(500).optional(),
});

export type PinMemoryInput = z.infer<typeof pinMemorySchema>;
