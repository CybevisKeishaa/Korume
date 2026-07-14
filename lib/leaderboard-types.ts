/**
 * Client-safe mirror of `lib/data/leaderboard.ts`'s shapes (that module is
 * `server-only`) — same JSON returned by `GET /api/leaderboard`.
 */
export interface LeaderboardEntry {
  rank: number;
  name: string | null;
  avatarUrl: string | null;
  weeklyXp: number;
  isMe: boolean;
}

export interface LeaderboardPage {
  leaderboard: LeaderboardEntry[];
  callerWeeklyXp: number;
  callerRank: number | null;
}
