import { z } from "zod";

/** Body for POST /api/companion/memories — pinning a transcript line as a
 * GIFTED memory (spec §4.3). Only the line pointer + the learner's own note;
 * NO media (§2.1). `videoId`/`lineTextJp`/`timestampSeconds` are deliberately
 * NOT accepted from the client — `pinMemory` derives them itself from the
 * `transcriptLineId` lookup (same precedent as `createMiningCard`), so a
 * caller can never assert a line said something it never said. */
export const pinMemorySchema = z
  .object({
    transcriptLineId: z.string().uuid(),
    note: z.string().max(500).optional(),
  })
  // `.strict()`, not the zod default of silently stripping unknown keys: a
  // client that still sends videoId/lineTextJp/timestampSeconds earns a 400,
  // not a quiet no-op, so a regression that reintroduces trusting those
  // fields would be caught at the boundary immediately.
  .strict();

export type PinMemoryInput = z.infer<typeof pinMemorySchema>;
