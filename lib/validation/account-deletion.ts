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

/**
 * POST /api/user/deletion SUCCESS body — validated at the client boundary
 * (`components/settings/delete-data-dialog.tsx`) rather than trusted via a
 * bare type cast. That cast was harmless while nothing consumed the value;
 * Task 11 threads it into `DeletionPendingBanner`'s rendered date, so an
 * unvalidated shape would start driving what the user sees on a page that
 * exists specifically to tell them the truth about a pending deletion
 * (CLAUDE.md §6 — validate every API input/output crossing a trust
 * boundary).
 *
 * `requestedAt`/`executeAfter` are checked only as strings, not as strict
 * ISO datetimes: the wire shape is this app's own contract
 * (`lib/data/account-deletion.ts`'s `toPending`, which always emits
 * `Date#toISOString()`), so the schema's job is catching a malformed or
 * unexpected SHAPE — a missing field, a wrong tier — not re-deriving the
 * API's own datetime format.
 */
export const pendingDeletionResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    tier: z.enum(DELETION_TIERS),
    requestedAt: z.string(),
    executeAfter: z.string(),
  }),
});
export type PendingDeletionResponse = z.infer<typeof pendingDeletionResponseSchema>;
