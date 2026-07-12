/**
 * Client-safe shared types for the sentence-mining feature (CLAUDE.md §5
 * differentiator #3). These mirror the JSON shapes returned by
 * `lib/data/mining.ts` (`GET /api/mining`, `GET /api/mining/queue`) —
 * structurally identical to `MiningQueueItem`/`MiningCardListItem` there, so
 * server components can pass that module's return values straight through as
 * props without a cast. This module has NO runtime imports, so it is safe to
 * import from client components — unlike `lib/data/mining.ts`, which is
 * `server-only`.
 */
export interface MiningQueueItem {
  id: string;
  sentenceJp: string;
  targetWord: string;
  reading: string | null;
  translation: string | null;
  videoId: string;
  startTime: number | null;
  endTime: number | null;
}

export interface MiningCardListItem extends MiningQueueItem {
  createdAt: string;
  srsStage: number;
  intervalDays: number;
  easeFactor: number;
  nextReviewAt: string | null;
  lastReviewedAt: string | null;
}
