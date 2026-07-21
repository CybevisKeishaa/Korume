/**
 * Catalog namespaces. One namespace per feature = one owner (spec P4).
 * A string needed by several features is promoted to `common`.
 *
 * Plan 3 adds a namespace per module as it extracts strings. `catalog.test.ts`
 * asserts this list matches the files on disk, so the two cannot drift.
 */
export const NAMESPACES = ["common", "nav", "auth", "marketing", "dashboard", "kanji", "vocab", "grammar", "videos", "dictation"] as const;

export type Namespace = (typeof NAMESPACES)[number];
