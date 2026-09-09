import { z } from "zod";

/** Server-rendered Hub discovery controls accept only one bounded term and a known taxonomy axis. */
export const shadowingHubQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  filter: z.string().regex(/^(situation|source):[a-z0-9-]+$/).optional(),
});

export type ShadowingHubQuery = z.infer<typeof shadowingHubQuerySchema>;
