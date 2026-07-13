/**
 * Client-safe mirror of `lib/data/user-stats.ts`'s `BadgeSummary` /
 * `UserStatsData` (that module is `server-only`) — same shape
 * `GET /api/user/stats` returns, declared locally so client components can
 * import the type without pulling in the data layer. `LevelInfo` itself is
 * reused directly from `lib/gamification` since that module has no runtime
 * imports and is already client-safe. Same duplication convention as
 * `lib/video-types.ts` vs `lib/data/videos.ts`.
 */
import type { LevelInfo } from "@/lib/gamification";

export interface BadgeSummary {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  earnedAt: string | null;
}

export interface UserStatsData {
  xp: number;
  level: LevelInfo;
  streakCurrent: number;
  streakLongest: number;
  lastActiveDate: string | null;
  badges: BadgeSummary[];
  srsDueCount: number;
}
