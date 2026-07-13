import { z } from "zod";

/** GET /api/videos/recommendations?limit=12 — optional cap on rows returned. */
export const recommendationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(24).default(12),
});
export type RecommendationsQuery = z.infer<typeof recommendationsQuerySchema>;
