import { z } from "zod";
import { DELETION_TIERS } from "@/lib/account-deletion/lifecycle";
import { routing } from "@/lib/i18n/routing";

/**
 * POST /api/user/deletion body.
 *
 * `confirmation` and `acknowledged` are validated HERE, not only in the modal:
 * a confirmation that exists only in the client is not a control (spec §8).
 *
 * `tier` is built from `DELETION_TIERS` (lifecycle.ts), not a separately
 * spelled literal list — one fact, one home (CLAUDE.md §6).
 *
 * `locale` is forwarded explicitly by the client (`DeleteDataDialog`'s own
 * `useLocale()`), the same pattern `app/[locale]/(auth)/actions.ts` uses to
 * carry the locale across `emailRedirectTo` into `/auth/callback` — because
 * `/api/user/deletion` is a Route Handler, and `middleware.ts`'s matcher
 * excludes `api`, `getLocale()` here would silently resolve
 * `routing.defaultLocale` for every request rather than the caller's actual
 * locale (code review, `feat/email-notification-system`). Required, not
 * inferred: the deletion-requested notification this drives is a GDPR
 * surface, and a wrong-language email with a wrong-locale cancel link is the
 * wrong direction to default in silently.
 */
export const deletionRequestSchema = z.object({
  tier: z.enum(DELETION_TIERS),
  confirmation: z.literal("DELETE"),
  acknowledged: z.literal(true),
  locale: z.enum(routing.locales),
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
const pendingDeletionSchema = z.object({
  id: z.string(),
  tier: z.enum(DELETION_TIERS),
  requestedAt: z.string(),
  executeAfter: z.string(),
});

export const pendingDeletionResponseSchema = z.object({ data: pendingDeletionSchema });
export type PendingDeletionResponse = z.infer<typeof pendingDeletionResponseSchema>;

/**
 * GET /api/user/deletion response — validated at the client boundary the
 * same way the POST success body already is (fix round 1, the
 * `refreshPending()` mechanism in `components/settings/privacy-screen.tsx`).
 * Shares `pendingDeletionSchema` with the POST schema above rather than
 * spelling the same shape twice (CLAUDE.md §6, one fact one home); `data` is
 * nullable here, unlike the POST response, because "no pending request" is
 * this route's normal, successful answer.
 */
export const getPendingDeletionResponseSchema = z.object({ data: pendingDeletionSchema.nullable() });
export type GetPendingDeletionResponse = z.infer<typeof getPendingDeletionResponseSchema>;
