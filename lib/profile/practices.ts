// Closed taxonomy, stored as codes, never localized labels (R8).
export const PREFERRED_PRACTICES = [
  "shadowing", "listening", "pronunciation", "vocabulary", "kanji", "grammar", "reading", "conversation",
] as const;
export type PreferredPractice = (typeof PREFERRED_PRACTICES)[number];
