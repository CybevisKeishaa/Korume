/**
 * `badges.name` in the database is a stable key (`week_streak`), not display copy. These are the keys the
 * seed migrations insert; each has a name and a description under `common.badges` in every locale.
 * A badge seeded later without copy falls back to its humanized key rather than showing raw snake_case.
 */
export const BADGE_KEYS = [
  "first_steps", "week_streak", "month_streak", "hundred_kanji", "dictation_50", "shadowing_50",
  "reading_10", "n5_mock", "n4_mock", "xp_1000", "xp_10000",
] as const;

export type BadgeKey = (typeof BADGE_KEYS)[number];

export const isBadgeKey = (key: string): key is BadgeKey => (BADGE_KEYS as readonly string[]).includes(key);

/** "first_steps" -> "First steps". */
export const humanizeBadgeKey = (key: string): string => {
  const words = key.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
