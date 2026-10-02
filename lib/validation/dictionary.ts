import { z } from "zod";

/** A JMdict ent_seq. */
const entryId = z.number().int().positive().max(99_999_999);

export const glossQuerySchema = z.object({ entryId: z.coerce.number().pipe(entryId) }).strict();
export const glossBodySchema = z.object({ entryId }).strict();
