import { z } from "zod";

/**
 * POST /api/user/deletion body.
 *
 * `confirmation` and `acknowledged` are validated HERE, not only in the modal:
 * a confirmation that exists only in the client is not a control (spec §8).
 */
export const deletionRequestSchema = z.object({
  tier: z.enum(["close_account", "erase_all"]),
  confirmation: z.literal("DELETE"),
  acknowledged: z.literal(true),
});
export type DeletionRequestInput = z.infer<typeof deletionRequestSchema>;
