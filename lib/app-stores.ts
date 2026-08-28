/**
 * Where the two app-store affordances point.
 *
 * ⚠️ These are the stores' own front pages, not listings for Korume — the app
 * is not published on either store yet. That is the user's explicit ruling
 * (2026-08-28), taken with that fact stated: the marketing page's store badges
 * and the mobile header both send visitors to the store rather than showing a
 * dead label. When Korume does ship, these two constants become its listing
 * URLs and every call site follows (CLAUDE.md §6, one fact one home).
 *
 * Used by the §10 footer's store badges and by `SiteHeader`'s narrow-viewport
 * action, which stands in for a nav the small screen cannot show.
 */
export const APP_STORE_URL = "https://www.apple.com/app-store/";
export const PLAY_STORE_URL = "https://play.google.com/store";
