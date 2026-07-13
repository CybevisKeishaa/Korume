import { z } from "zod";

/** GET /api/notifications?limit=20 — optional cap on rows returned. */
export const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;

/**
 * PATCH /api/notifications body — either a specific set of notification ids
 * (max 50 per call, matching the max page size above) or `{ all: true }` to
 * clear the whole unread inbox in one call.
 */
export const markNotificationsReadSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }),
  z.object({ all: z.literal(true) }),
]);
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
