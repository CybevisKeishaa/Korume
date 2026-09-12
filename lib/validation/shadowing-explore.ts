import { z } from "zod";

/** Query contract for the C3 catalogue; values are only used as database filters. */
export const shadowingExploreQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  situation: z.string().regex(/^[a-z0-9-]+$/).max(64).optional(),
});

export type ShadowingExploreQuery = z.infer<typeof shadowingExploreQuerySchema>;
