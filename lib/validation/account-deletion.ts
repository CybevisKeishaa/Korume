import { z } from "zod";
import { DELETION_TIERS } from "@/lib/account-deletion/lifecycle";

/**
 * POST /api/user/deletion body.
 *
 * `confirmation` and `acknowledged` are validated HERE, not only in the modal:
 * a confirmation that exists only in the client is not a control (spec §8).
 *
 * `tier` is built from `DELETION_TIERS` (lifecycle.ts), not a separately
 * spelled literal list — one fact, one home (CLAUDE.md §6).
 */
export const deletionRequestSchema = z.object({
  tier: z.enum(DELETION_TIERS),
  confirmation: z.literal("DELETE"),
  acknowledged: z.literal(true),
});
export type DeletionRequestInput = z.infer<typeof deletionRequestSchema>;
