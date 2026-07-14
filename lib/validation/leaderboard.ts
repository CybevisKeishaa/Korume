import { z } from "zod";

/** PATCH /api/user/leaderboard-opt-in body. */
export const leaderboardOptInSchema = z.object({
  optIn: z.boolean(),
});
export type LeaderboardOptInInput = z.infer<typeof leaderboardOptInSchema>;
