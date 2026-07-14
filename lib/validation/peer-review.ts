import { z } from "zod";

/** POST /api/peer-review/shares body. */
export const createShareSchema = z.object({
  sessionId: z.string().uuid(),
  note: z.string().trim().max(1000, "Note is too long (max 1000 characters).").optional(),
});
export type CreateShareInput = z.infer<typeof createShareSchema>;

/** GET /api/peer-review/queue?cursor=&limit= and GET /api/peer-review/mine (no limit param there, but the shape is shared). */
export const peerReviewQueueQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PeerReviewQueueQuery = z.infer<typeof peerReviewQueueQuerySchema>;

/**
 * POST /api/peer-review/shares/[id]/reviews body. `rating` is required (NOT
 * NULL + check(1..5) on `peer_reviews.rating` — migration
 * 20260714000014_community_admin.sql), despite being commonly modeled as
 * optional elsewhere; the DB constraint is the source of truth here.
 */
export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1, "Comment is required.").max(2000, "Comment is too long (max 2000 characters)."),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
