/**
 * Triangular XP-to-level curve. Cumulative XP threshold to REACH level L
 * (L >= 1) is 100·L·(L−1)/2: level 1 @ 0, 2 @ 100, 3 @ 300, 4 @ 600, 5 @ 1000…
 * Pure and deterministic — no I/O, no clock.
 */

export interface LevelInfo {
  level: number;
  /** Cumulative XP at which the current level began. */
  levelFloorXp: number;
  /** Cumulative XP required to reach the next level. */
  nextLevelXp: number;
  /** Progress toward the next level, in [0, 1). */
  progressRatio: number;
}

/** Cumulative XP required to reach level `level` (level >= 1). */
export function thresholdForLevel(level: number): number {
  return (100 * level * (level - 1)) / 2;
}

/**
 * Resolve a total XP amount to its level and progress within that level.
 * Negative input is clamped to 0 (treated as level 1, no progress).
 */
export function levelForXp(xp: number): LevelInfo {
  const clamped = Math.max(0, xp);

  // Walk up from level 1 while the next level's threshold is already met.
  let level = 1;
  while (clamped >= thresholdForLevel(level + 1)) {
    level += 1;
  }

  const levelFloorXp = thresholdForLevel(level);
  const nextLevelXp = thresholdForLevel(level + 1);
  const span = nextLevelXp - levelFloorXp;
  const progressRatio = span === 0 ? 0 : (clamped - levelFloorXp) / span;

  return { level, levelFloorXp, nextLevelXp, progressRatio };
}
