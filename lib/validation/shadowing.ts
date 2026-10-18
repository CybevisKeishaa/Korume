import { z } from "zod";

/** POST /api/shadowing/session — non-file fields (multipart form). The audio
 * itself arrives as a file part; createSession inspects its WAV bytes. */
export const shadowingSessionSchema = z.object({
  videoId: z.string().uuid(),
  lineId: z.string().uuid(),
  /** Self-reported pitch-accent score (differentiator #1), computed
   * client-side by `lib/pitch` by comparing the user's recording against a
   * reference contour — the server never recomputes it, only clamps/
   * validates the range before persisting. Optional: the pitch pipeline is
   * newer than the base shadowing flow. */
  pitchScore: z.coerce.number().min(0).max(100).optional(),
});
export type ShadowingSessionInput = z.infer<typeof shadowingSessionSchema>;
