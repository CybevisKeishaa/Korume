/**
 * The nav shape Phase 1b's registry MUST derive to — T6's independent oracle.
 *
 * ⛔⛔ NEVER REGENERATE THIS FILE FROM `deriveNavGroups()`.
 * It is the only reason T6 means anything. Dump the derivation in here and the
 * test becomes self-referential: it will pass forever while asserting nothing,
 * and it takes the nav-completeness guards down with it. Every row below was
 * transcribed BY HAND from `docs/product/ia-proposal.md` §2 (LOCKED, user
 * approval 2026-08-12). If the derivation and this file disagree, read both —
 * do not "fix" the disagreement by copying one into the other.
 *
 * Phase 1a's version of this file froze the nav as it shipped BEFORE the
 * registry refactor, defects included, so that 1a could prove zero visual
 * diff. That job is done: 1a proved the engine, and this file now states the
 * product decision instead. The old `journey → /journal` row is gone because
 * the IA moved that label to `/roadmap` (A8), not because the engine changed.
 *
 * ⚠️ ONE DELIBERATE DEVIATION from `ia-proposal.md` §2, and it is not a typo:
 * the third `practice` row is `jlpt` at `/jlpt`, while the IA table shows
 * `Certification` at `/certification`. A9 defers that rename to Phase 2
 * because it carries a schema migration (three exam families with different
 * section structures, so `jlpt_section`'s enum cannot be the shared
 * abstraction). Phase 1b moves the row's GROUP only. When Phase 2 lands the
 * rename, this row and the catalog key change together.
 *
 * Keys are screenIds (R9) — `pronunciation-library` and `companion-home` read
 * oddly next to their "Pronunciation"/"Companion" labels, and that is correct:
 * the key is identity, the label is catalog content.
 */
export const NAV_BASELINE = [
  {
    key: "learn",
    items: [
      { href: "/dashboard", key: "dashboard" },
      { href: "/shadowing", key: "lessons" },
      { href: "/kanji", key: "kanji" },
      { href: "/grammar", key: "grammar" },
    ],
  },
  {
    key: "practice",
    items: [
      { href: "/conversation", key: "speaking" },
      { href: "/pronunciation", key: "pronunciation-library" },
      { href: "/jlpt", key: "jlpt" },
    ],
  },
  {
    key: "remember",
    items: [
      { href: "/review", key: "review" },
      { href: "/mining", key: "mining" },
      { href: "/playlists", key: "playlists" },
    ],
  },
  {
    key: "journey",
    items: [
      { href: "/roadmap", key: "roadmap" },
      { href: "/companion", key: "companion-home" },
    ],
  },
  {
    key: "account",
    items: [
      { href: "/profile", key: "profile" },
      { href: "/settings", key: "settings" },
    ],
  },
] as const;
