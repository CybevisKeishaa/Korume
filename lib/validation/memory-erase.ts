import { z } from "zod";

/**
 * `POST /api/user/memory-erase` body.
 *
 * The literal is ASCII `"ERASE"` in every locale. The *typed* word is
 * translated — a Vietnamese user types "XOA" — but that is a UI affordance,
 * and `MemoryEraseForm` maps it to this constant before sending. Putting a
 * locale-dependent word on the wire would make the server's confirmation
 * check depend on a header it does not read (spec §4.8).
 */
export const memoryEraseSchema = z.object({
  confirm: z.literal("ERASE"),
});
export type MemoryEraseInput = z.infer<typeof memoryEraseSchema>;
