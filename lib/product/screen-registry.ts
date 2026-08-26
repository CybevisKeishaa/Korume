import type { ScreenEntry } from "./screen-registry-types";

/**
 * The screen registry — one row per product screen, joined to the frame that
 * designed it (Figma) and the route that ships it (repo), as of the Phase 0
 * inventory (`docs/product/screen-inventory.md`, all 57 frames read
 * 2026-08-12) and today's `components/layout/app-nav.tsx`.
 *
 * ✅ Phase 1b APPLIES the LOCKED IA (`docs/product/ia-proposal.md` §2,
 * `docs/product/decision-register.md` A1–A13). Phase 1a deliberately recorded
 * navigation exactly as it shipped, defects included, so that the engine and
 * the product decision never shared a diff. This is the product decision.
 *
 * Applied: the five IA groups (A1) · `/vocab` `/reading` `/community`
 * `/leaderboard` HIDDEN — row removed, code kept (A10) · `/sensei`
 * `/journal` `/weekly-report` absorbed into Companion (A2), `/statistics`
 * `/achievements` into Dashboard/Profile (A4), `/challenges` into Roadmap
 * (A5) · the `Journey` label moved off the Diary onto `/roadmap` (A8) ·
 * `/companion` (A2) and `/pronunciation` (A6) given real routes.
 *
 * ✅ APPLIED in Phase 2b: `/jlpt` → `/certification` (A9). The rename covers
 * the MODULE only — route, API and the two module tables. The JLPT exam family
 * keeps its names (`jlpt_level`, `jlpt_section`, `components/jlpt/**`), and the
 * schema generalisation A9 anticipated is deliberately NOT done: the repo
 * implements one exam family, so it has no consumer to validate it.
 *
 * Sourcing, per the brief's authority order:
 *   1. `docs/product/figma-frame-map.md` — figmaNodeId + `name` (verbatim
 *      frame name, trimmed — never the on-screen headline or the inventory's
 *      discovered "true identity").
 *   2. `docs/product/screen-inventory.md` Part II §6–§20 — `kind`, and for
 *      state-variants, `variantOf`.
 *      ⚠️ Citation convention: the per-entry comments below cite that file by
 *      SECTION and row, never by line number. Line citations written into this
 *      file went stale twice inside Phase 2a alone — once when a later task in
 *      the same phase inserted a line above them, and again when the final fix
 *      wave struck two rows from §3's table. A section survives both.
 *   3. `listPageRoutes(process.cwd())` — `route` + `chrome`. Count it, never
 *      quote it (`docs/lessons.md` L-002); Phase 1b added two pages, so the
 *      44 recorded by Phase 1a is already stale.
 *   4. `docs/product/ia-proposal.md` §2 — `navGroup` + `navOrder`. ⚠️ Phase 1a
 *      sourced these from `components/layout/app-nav.tsx`; that is no longer
 *      true and must not be reinstated. `app-nav.tsx` has held no nav data
 *      since 1a, and the IA is the source now.
 *
 * `impl` is measured, not asserted. The placeholder set is whatever this
 * prints — never a number copied from here (`docs/lessons.md` L-002):
 *
 *   grep -rln "UpcomingScreen" app/
 *
 * At the Phase 1b pass that was achievements, challenges, companion, review,
 * pronunciation, roadmap, sensei, settings, shadowing/explore, statistics and
 * weekly-report (1b added companion + pronunciation). Those routes are
 * `impl: "placeholder"`; every other existing route is `impl: "built"`.
 *
 * ---------------------------------------------------------------------------
 * FRAMES DELIBERATELY NOT REGISTERED
 * ---------------------------------------------------------------------------
 * No test can catch a frame that was simply never typed in here (final
 * whole-branch review FIX 2), so the exclusions are listed by node id and the
 * classification that excluded each. That makes this list the ONLY hand-check
 * there is — so it carries a recipe that still runs.
 *
 * THE INVARIANT — a partition of every node id the frame map records as being
 * on the Figma page:
 *
 *   registered ids
 *     + the first-capture exclusions listed below
 *     + `335:1588`  — second-capture exclusion, classified below
 *   = every node id in a table row of `docs/product/figma-frame-map.md`
 *     § "Captured — all 57 of 57" and § "Second capture batch (2026-08-23)",
 *     deduplicated (`65:2` and `218:15740` appear in both sections).
 *
 * ⚠️ This replaces an earlier form — "registered ids + the 6 exclusions below
 * = the frames captured in § 'Captured — all 57 of 57'" — which held only
 * while every registered id came from that first capture. It stopped holding
 * the moment ids from OUTSIDE the original 57 were registered: `337:3323` and
 * `339:3612` by L9b Plan 1 (stamped 2026-08-20), then this branch's batch
 * (stamped 2026-08-23). It then failed silently, which is the worst failure
 * mode for the one check nothing automates. Do not restate it in a form that
 * names a total; run the recipe instead (`docs/lessons.md` L-002).
 *
 * Re-run it (POSIX shell — the `[0-9]` anchors keep these comment lines
 * themselves out of the results; the obvious pattern counts its own
 * documentation):
 *
 *   grep -o 'figmaNodeId: "[0-9][^"]*"' lib/product/screen-registry.ts \
 *     | sed 's/.*"\([^"]*\)"/\1/' | sort -u > /tmp/registered
 *   awk '/^## .*Captured/{s=1} /^## Dead/{s=0} /^## Second capture batch/{s=1} s' \
 *     docs/product/figma-frame-map.md \
 *     | grep -o '^| `[0-9][^`]*`' | tr -d '|` ' | sort -u > /tmp/mapped
 *   comm -13 /tmp/registered /tmp/mapped   # mapped but NOT registered
 *   comm -23 /tmp/registered /tmp/mapped   # registered but NOT mapped
 *
 * The first command must print exactly the ids named above — the first-capture
 * exclusions, plus `335:1588` — and nothing else. The second must print
 * nothing at all. Both held when this was re-run on 2026-08-26, after the
 * `landing-page` identity ruling registered `347:6277` and so removed it from
 * the deferred line this invariant used to carry.
 *
 * The first-capture exclusions, each with the classification that excluded it:
 *
 *   `46:2`      Popup create conversation   — interaction (modal wizard),
 *                                             screen-inventory.md §15.3
 *   `181:3525`  Gentle suggestion drawer    — interaction (drawer), §12.2
 *   `182:3859`  Today's reflection          — interaction (overlay panel), §12.1
 *   `203:13813` Footer                      — component, not a screen, §19.5
 *   `210:14338` Loading state               — style-guide catalogue, NOT a
 *                                             screen, §19.6
 *   `218:15740` Error state                 — style-guide catalogue, NOT a
 *                                             screen, §19.6
 *
 * The registered total INCLUDES `90:1985`, recorded at the bottom of this file
 * as `kind: "deprecated"` — a dead frame kept so it is not rediscovered, not a
 * live screen.
 *
 * Frames the map records as NO LONGER on the page are outside the invariant
 * entirely: `5:1718` (Unuse), `71:2` (Pricing-remove) and `243:14906` live in
 * the map's § "Dead / stale ids from earlier sessions" table — which is
 * exactly why the recipe's `awk` stops at that heading. The map's own
 * arithmetic proves the first two were already deleted and the third was never
 * matched to a frame.
 *
 * ---------------------------------------------------------------------------
 * SECOND BATCH EXCLUSION — 2026-08-23 capture
 * ---------------------------------------------------------------------------
 * ⚠️ ONE FACT, ONE HOME (`CLAUDE.md` §6). The ACCOUNTING for that batch —
 * which ids this branch added, which were already registered, which are
 * excluded, which is deferred — lives in `docs/product/figma-frame-map.md`
 * § "Second capture batch (2026-08-23)" and the ✅ Registered note at the top
 * of that file. It is deliberately NOT restated here: it was, once, and the
 * two copies immediately disagreed. This block owns only the CLASSIFICATION
 * that excluded a frame, which no other file records:
 *
 *   `335:1588`  Error state (right font) — pixel-identical to `218:15740`
 *               except one card's CTA label; a font/typography QA pass over
 *               the same style-guide sheet, not a distinct screen. Same
 *               classification that already excludes its twin above.
 *
 * The `346:6275` "Homepage" rectangle is not a Figma frame and is not a
 * screen, so it has no table row in the map and is outside the invariant.
 * It is NOT canvas noise, which is what this note claimed until 2026-08-26:
 * `get_metadata` shows a single 864×1821 rounded-rectangle with an image
 * fill and ZERO children, and the user confirmed it is the **visual quality
 * bar** for the landing page — a picture of a design, not a design. It was
 * hidden when the 2026-08-23 pass screenshotted it, which is why that pass
 * got a 149-byte blank render and mis-filed it as decoration. Being a flat
 * image is exactly why it stays out: nothing can be derived from it, only
 * compared against. See the `landing-page` row for how it is used.
 *
 * `347:6277` (the marketing-landing frame) WAS deliberately unregistered
 * pending an identity ruling. The user ruled it on 2026-08-26 — it is the
 * design for `/` — so it is now registered on the `landing-page` row and no
 * longer appears in the invariant's deferred line above.
 */
export const SCREEN_REGISTRY: readonly ScreenEntry[] = [
  // ===================================================================
  // Nav destinations — kind/impl/figma vary per row; navGroup/navOrder now
  // come from the LOCKED IA (ia-proposal.md §2), no longer from app-nav.tsx.
  //
  // Entries that LOST their row in Phase 1b stay in this section, each with
  // the decision that removed it. That is the point of HIDE/ABSORB: the
  // screen, its route and its code all survive — only the sidebar row goes.
  // Count the live rows with a command, never from a number written here.
  // The `^    ` anchor keeps this line itself out of the result — without it
  // the pattern counts its own documentation and reads one too high (the same
  // trap the `figmaNodeId: "[0-9]` anchor avoids in the header):
  //   grep -c '^    navGroup: "' lib/product/screen-registry.ts
  // ===================================================================

  // learn/1 — designed, built. Frame name is "Homepage"; the SCREEN is the
  // Dashboard (§19.1 — the picture, not the layer name, is the evidence).
  {
    screenId: "dashboard",
    name: "Homepage",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "111:515",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/dashboard",
    chrome: "app",
    impl: "built",
    navGroup: "learn",
    navOrder: 1,
    specRef: null,
  },
  // learn/2 — designed, built. Frame not renamed despite the rename pass
  // targeting it (figma-frame-map.md); name recorded as it stands today.
  {
    screenId: "lessons",
    name: "Shadowing hub after changes",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "149:2",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/shadowing",
    chrome: "app",
    impl: "built",
    navGroup: "learn",
    navOrder: 2,
    specRef: null,
  },
  // learn/3 — JUDGEMENT CALL: /kanji matches NEITHER designed kanji screen
  // (screen-inventory.md §6.0 — "the shipped screen is a thin catalogue that
  // neither design describes"). Recorded repo-only rather than borrowing
  // either frame's id. The two real kanji screens get their own entries
  // below (kanji-explorer, kanji-library), unattached to any route.
  {
    screenId: "kanji",
    name: "Kanji",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/kanji",
    chrome: "app",
    impl: "built",
    navGroup: "learn",
    navOrder: 3,
    specRef: null,
  },
  // HIDDEN in Phase 1b (A10) — the 2026-08-11 "hide, reversibly" ruling, now
  // applied. Route, schema, API, the `vocab` i18n namespace and every
  // component stay untouched; only the nav row goes. Deliberately NOT
  // `deprecated` — the user intends to reconsider the feature.
  // No frame in the 57 covers Vocab (§4).
  {
    screenId: "vocab",
    name: "Vocabulary",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/vocab",
    chrome: "app",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // learn/4 — JUDGEMENT CALL: `Grammar analysis` (284:1464) is a sentence
  // parser, explicitly NOT the /grammar catalogue (§17.1: "the two are not
  // comparable"). So /grammar itself has no frame; 284:1464 gets its own
  // entry below (grammar-analysis), route null.
  {
    screenId: "grammar",
    name: "Grammar",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/grammar",
    chrome: "app",
    impl: "built",
    navGroup: "learn",
    navOrder: 4,
    specRef: null,
  },
  // HIDDEN in Phase 1b (A10) — same terms as /vocab: row removed, code kept,
  // not deprecated. No frame anywhere in the 57 covers Reading.
  {
    screenId: "reading",
    name: "Reading",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/reading",
    chrome: "app",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // practice/1 — designed (≈), built. `/conversation` renders the library shell
  // (170:9364); the live-session frame (44:7289) has no route of its own
  // (§15.6 — "session UI exists in-page") and gets a separate entry below.
  {
    screenId: "speaking",
    name: "Conversation practice library",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "170:9364",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/conversation",
    chrome: "app",
    impl: "built",
    navGroup: "practice",
    navOrder: 1,
    specRef: null,
  },
  // practice/3 — designed (≈), built. Frame's layer name is "JLPT Practice";
  // its on-screen identity is "Certification Practice" (§10.0) — name field
  // stays the layer name, per the Dashboard precedent above.
  // A9 APPLIED in Phase 2b (2026-08-14): the route is `/certification`. The
  // `name` stays "JLPT Practice" because it is frame 232:2's name, copied
  // verbatim — the MODULE was renamed, the frame was not. The nav label lives
  // in messages/*/nav.json under the key `jlpt` (R9: screenId is the catalog
  // key, and identity is not renamed to prettify a key).
  {
    screenId: "jlpt",
    name: "JLPT Practice",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "232:2",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/certification",
    chrome: "app",
    impl: "built",
    navGroup: "practice",
    navOrder: 3,
    specRef: null,
  },

  // remember/1 — no frame; the cross-type SRS review hub. `ia-proposal.md`
  // §2's `remember` group (line 120) rules `KEEP` — settling what
  // `screen-inventory.md` §3 still lists as "not yet adjudicated".
  {
    screenId: "review",
    name: "Review",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/review",
    chrome: "app",
    impl: "placeholder",
    navGroup: "remember",
    navOrder: 1,
    specRef: null,
  },
  // remember/2 — no frame; sentence mining (§3). A7 relabels this row to
  // "Collection" in the catalog; the screenId stays `mining` because A7 is a
  // LABEL ruling and the feature itself still needs its own spec.
  {
    screenId: "mining",
    name: "Mining",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/mining",
    chrome: "app",
    impl: "built",
    navGroup: "remember",
    navOrder: 2,
    specRef: null,
  },
  // remember/3 — built, no frame at this pass (R6). A11 keeps this its own
  // screen rather than folding it into Explore.
  {
    screenId: "playlists",
    name: "Playlists",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/playlists",
    chrome: "app",
    impl: "built",
    navGroup: "remember",
    navOrder: 3,
    specRef: null,
  },
  // ABSORBED into Roadmap in Phase 1b (A5) — no nav row; the route and its
  // placeholder stay. No frame; a gamification surface (§3).
  {
    screenId: "challenges",
    name: "Challenges",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/challenges",
    chrome: "app",
    impl: "placeholder",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // HIDDEN in Phase 1b (A10) — the adjudication is now applied. The reason is
  // product, not technical: with no users yet, a community surface mostly
  // advertises that the system is empty. Code kept. No frame (§3).
  // `/community/[id]` and `/community/peer-review` ride along below.
  {
    screenId: "community",
    name: "Community",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/community",
    chrome: "app",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // HIDDEN in Phase 1b (A10), same reason as /community. Code kept. No frame.
  {
    screenId: "leaderboard",
    name: "Leaderboard",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/leaderboard",
    chrome: "app",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },

  // ABSORBED into Companion in Phase 1b (A2) — one intelligent presence, not
  // two. No nav row; the route and its placeholder stay. Designed.
  // §11.3 Companion Knowledge Assistant.
  {
    screenId: "sensei",
    name: "Companion Knowledge Assistant",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "215:15164",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/sensei",
    chrome: "app",
    impl: "placeholder",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // journey/1 — designed, honest placeholder (Plan C1).
  // ⭐ This row now carries the "Journey" LABEL (A8). Figma's `journey` names
  // the Roadmap, while the nav had pinned that label on the Diary — the
  // defect Phase 1a recorded verbatim and this phase fixes. The catalog key
  // stays `roadmap` (screenId is identity); only its VALUE becomes "Journey".
  // Also absorbs /challenges (A5).
  {
    screenId: "roadmap",
    name: "Roadmap",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "64:2061",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/roadmap",
    chrome: "app",
    impl: "placeholder",
    navGroup: "journey",
    navOrder: 1,
    specRef: null,
  },
  // ABSORBED into Companion in Phase 1b (A2) — no nav row; route stays.
  // No frame. §12.4 explicitly rules OUT `Growth Areas` as the
  // match for this route ("No. This is a persistent skill-progress map, not
  // a periodic report").
  {
    screenId: "weeklyReport",
    name: "Weekly Report",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/weekly-report",
    chrome: "app",
    impl: "placeholder",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },

  // ABSORBED into Companion in Phase 1b (A2/A8) — this screen IS the
  // Companion Diary, so it stops being a top-level row and is reached from
  // /companion. Route, chrome and code all stay.
  // The screenId stays `journey`: that is identity (R3), not a label. The
  // "Journey" LABEL it wrongly carried moves to /roadmap — the §13.0
  // collision Phase 1a recorded on purpose is closed here.
  // Designed, built; chrome contract already matches (§11.2).
  {
    screenId: "journey",
    name: "Companion Diary",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "190:7376",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/journal",
    chrome: "immersive",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // ABSORBED into the Dashboard in Phase 1b (A4) — no nav row; route stays.
  // No frame; a gamification surface (§3, §19.1's third
  // skill-taxonomy sighting notwithstanding — that lives on the Dashboard).
  {
    screenId: "statistics",
    name: "Statistics",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/statistics",
    chrome: "app",
    impl: "placeholder",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // ABSORBED in Phase 1b (A4) — summary on the Dashboard, gallery on Profile.
  // No nav row; route stays. No frame; a gamification surface (§3).
  {
    screenId: "achievements",
    name: "Achievements",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/achievements",
    chrome: "app",
    impl: "placeholder",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },

  // account/1 — designed, built (far simpler than the frame — §18.2).
  {
    screenId: "profile",
    name: "Profile",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "66:166",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/profile",
    chrome: "app",
    impl: "built",
    navGroup: "account",
    navOrder: 1,
    specRef: null,
  },
  // account/2 — designed, placeholder. Frame's current name is "Global
  // settings" (rename pass verified 2026-08-12; figma-frame-map.md records
  // the trimmed string). Re-checked 2026-08-20 alongside its child privacy
  // screen below — genuinely compared, not carried forward by habit.
  {
    screenId: "settings",
    name: "Global settings",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "220:16032",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-20",
    route: "/settings",
    chrome: "app",
    impl: "placeholder",
    navGroup: "account",
    navOrder: 2,
    specRef: null,
  },
  // 337:3323 — reached from Settings, not a nav destination of its own
  // (navGroup/navOrder null, same convention as the certification detail
  // route below). Danger Zone lives here per settings-patterns.md's
  // Dangerous Settings Separation, satisfied by structure rather than a
  // heading — Figma's own "Global settings" frame inlines everything into
  // one 3758px page; this repo gives Privacy its own route instead.
  {
    screenId: "data-privacy",
    name: "Data privacy (for delete)",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "337:3323",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-20",
    route: "/settings/privacy",
    chrome: "app",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // The Danger Zone's `Delete Korume Memory` destination. NO frame designs
  // it: `337:3323` draws the ROW, and spec §13 (a user ruling) says the row
  // ships now with its behaviour deferred behind an honest "not built yet"
  // surface. So this is `repo-only`/`no-frame-at-last-pass` — a route the
  // repo needs and the design file has never covered — with `impl:
  // "placeholder"` because that is exactly what it renders. `navGroup` is
  // null: it is reached from the Danger Zone, never from the sidebar.
  //
  // Added by the whole-branch review (I3): the row linked here with no page
  // behind it, so it 404'd into Next's default English error page, outside the
  // app chrome. T1 below is what forces a registry entry to exist for it.
  //
  // `figmaCheckedAt: null` — NOT a stamp. R7 defines the field as the date of
  // the last HUMAN Figma↔registry comparison, and no human opened Figma for
  // this row: the plan's §1 explicitly puts frame-map re-capture out of scope,
  // and this entry was written from the repo side during a fix wave. Stamping
  // it would claim a comparison that did not happen, which is the same class of
  // false claim C1 exists to punish. The five existing nulls are all
  // out-of-design-scope admin rows; this is the first `no-frame-at-last-pass`
  // one, and it is null for the honest reason rather than the same one.
  {
    screenId: "privacy-memory",
    name: "Delete Korume Memory",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: null,
    route: "/settings/privacy/memory",
    chrome: "app",
    impl: "placeholder",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // 339:3612 — the delete-all-my-data confirmation dialog: an overlay, not a
  // route (port-workflow spec §5.4), so `route` is null the same way every
  // other state-variant's is.
  {
    screenId: "delete-data",
    name: "Delete data",
    kind: "state-variant",
    variantOf: "data-privacy",
    figmaNodeId: "339:3612",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-20",
    route: null,
    chrome: null,
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },

  // -------------------------------------------------------------------
  // Phase 1b's two NEW nav destinations. Both were already registered as
  // designed-with-no-route; 1b gives them a route and a row rather than
  // inventing entries, so the Figma join (R3) is inherited, not re-made.
  // They are moved here out of the "Designed, no route yet" section below,
  // which would otherwise describe them falsely.
  //
  // ⚠️ Their screenIds double as message-catalog keys (R9, and
  // `deriveNavGroups` maps `key: entry.screenId`), so the catalog gains
  // `companion-home` / `pronunciation-library` rather than `companion` /
  // `pronunciation`. Identity is not renamed to prettify a key — `weeklyReport`
  // set that precedent in the other direction.
  // -------------------------------------------------------------------

  // practice/2 — designed, honest placeholder. A6: Pronunciation earns its own
  // row despite being a T2 sub-skill; it is NOT a leaf of Shadowing.
  {
    screenId: "pronunciation-library",
    name: "Pronunciation library",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "37:4955",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/pronunciation",
    chrome: "app",
    impl: "placeholder",
    navGroup: "practice",
    navOrder: 2,
    specRef: null,
  },
  // journey/2 — designed, honest placeholder. A2: Companion is ONE destination
  // over six screens (home · diary · sensei · memory · growth), which is what
  // absorbs /sensei, /journal and /weekly-report above.
  {
    screenId: "companion-home",
    name: "Companion home",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "156:1310",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/companion",
    chrome: "app",
    impl: "placeholder",
    navGroup: "journey",
    navOrder: 2,
    specRef: null,
  },

  // ===================================================================
  // Non-nav routes with a matching frame (screen or state-variant), not a
  // nav destination itself — navGroup/navOrder null throughout.
  // ===================================================================

  // 232:2's exam-runner detail. §10.8: Route "/certification/[id]" ≈.
  {
    screenId: "jlpt-practice-phase-1",
    name: "JLPT practice (phase 1)",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "237:1690",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/certification/[id]",
    chrome: "app",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // §6.4 — drawn as a modal overlay in Figma, built as a page in the repo;
  // §6.5's cluster verdict classifies it a screen, not an excluded modal.
  {
    screenId: "kanji-inspect",
    name: "Kanji inspect",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "28:2041",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/kanji/[id]",
    chrome: "app",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // §6.3 — chrome contract diverges in the design (Figma wants focus/
  // immersive); this repo's actual route sits under (app) — recorded as
  // measured, not as the design intends.
  {
    screenId: "kanji-lesson-practice-flashcard",
    name: "Kanji lesson practice (flashcard)",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "280:1314",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/kanji/review",
    chrome: "app",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // §18.1.
  {
    screenId: "login",
    name: "Login",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "65:2",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/login",
    chrome: "auth",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // §9.1 — the Shadowing Learning Mode workspace (Shadowing mode is built).
  {
    screenId: "shadowing-practice",
    name: "Shadowing Practice",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "105:3088",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/shadowing/[id]",
    chrome: "focus",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // §9.3 — a state-variant (a Learning Mode of the workspace) that HAS a
  // real, distinct route: shipped named for its sub-mode (Dictation) rather
  // than its mode (Listening Practice), per §9.0.
  {
    screenId: "dictation-in-shadowing",
    name: "Dictation (in shadowing)",
    kind: "state-variant",
    variantOf: "shadowing-practice",
    figmaNodeId: "123:2835",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/shadowing/[id]/dictation",
    chrome: "focus",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // §8.1 — designed in full, shipped as a pure UpcomingScreen placeholder.
  {
    screenId: "explore-lessons",
    name: "Explore Lessons",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "200:7705",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: "/shadowing/explore",
    chrome: "app",
    impl: "placeholder",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },

  // ===================================================================
  // Routes that had NO matching frame at Phase 1, and are not nav
  // destinations. Most are still `repo-only` (no-frame-at-last-pass unless
  // chrome is admin) — but the 2026-08-23 capture batch gave two of them a
  // frame, so `register` and `landing-page` now sit here as `kind: "screen"`.
  // The section is defined by "not a nav destination", not by kind: read each
  // row's own `kind`, never this heading.
  // ===================================================================

  // §19.0 once read "there is NO marketing landing frame anywhere in the
  // 57... the public front door of Korume is undesigned", and P16 recorded
  // that as known and accepted — the user would design it later. They did:
  // the 2026-08-23 batch brought `347:6277`, a full 1280×4028 marketing
  // landing page (figma-frame-map.md § "New marketing homepage").
  //
  // ✅ RULED by the user 2026-08-26: `347:6277` IS the design for this route.
  // `/` is the landing page; the authenticated user's home stays `dashboard`
  // at `/dashboard`, unrenamed (the user declined a `/home` rename in the
  // same ruling). So this row converts — exactly as `register` did — rather
  // than a second destination being created. That closes
  // `2026-08-23-screen-registry-phase-3-design.md` §9.1.
  //
  // ⚠️ `impl: "built"` is NOT a claim that the built `/` matches this frame.
  // It never was: `impl` records that a route exists and renders, and the
  // existing `(marketing)` page predates the frame by months. A section-by-
  // section comparison of the two ran on 2026-08-26 and found the frame's own
  // render below the quality bar of the reference image `346:6275` (missing
  // photography and mascot art, missing connector/graph linework, a bar chart
  // where the design calls for a dual pitch contour, and a broken 5-step row
  // in "Don't study Japanese in isolation"). Whoever ports this screen builds
  // to `346:6275`'s bar using `347:6277`'s structure — and keeps the frame's
  // footer and its "A quieter way to keep going." section, which the user
  // ruled authoritative over the reference image on 2026-08-26.
  {
    screenId: "landing-page",
    name: "Landing Page",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "347:6277",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-26",
    route: "/",
    chrome: "marketing",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "admin",
    name: "Admin",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "out-of-design-scope",
    figmaCheckedAt: null,
    route: "/admin",
    chrome: "admin",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "admin-content",
    name: "Admin — Content",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "out-of-design-scope",
    figmaCheckedAt: null,
    route: "/admin/content",
    chrome: "admin",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "admin-content-type",
    name: "Admin — Content Type",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "out-of-design-scope",
    figmaCheckedAt: null,
    route: "/admin/content/[type]",
    chrome: "admin",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Tooling Figma will never cover — the ONLY legal use of out-of-design-scope
  // (R13/T10). Worked example.
  {
    screenId: "admin-style-guide",
    name: "Admin — Style Guide",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "out-of-design-scope",
    figmaCheckedAt: null,
    route: "/admin/style-guide",
    chrome: "admin",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "admin-videos",
    name: "Admin — Videos",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "out-of-design-scope",
    figmaCheckedAt: null,
    route: "/admin/videos",
    chrome: "admin",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Inherits /community's ruling (A10): hidden, code kept, not deprecated.
  // Not an independent decision — a community sub-route is reached by
  // drilling into its parent and is never a nav row of its own.
  // Frameless per `screen-inventory.md` §3's "Already adjudicated by the user
  // 2026-08-11" list, which names this route explicitly.
  {
    screenId: "community-detail",
    name: "Community — Detail",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/community/[id]",
    chrome: "app",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Inherits /community's ruling (A10): hidden, code kept, not deprecated.
  // Not an independent decision — a community sub-route is reached by
  // drilling into its parent and is never a nav row of its own.
  // Frameless per `screen-inventory.md` §3's "Already adjudicated by the user
  // 2026-08-11" list, which names this route explicitly.
  {
    screenId: "community-peer-review",
    name: "Community — Peer Review",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/community/peer-review",
    chrome: "app",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Inherits /mining's ruling (A7): a label change to `Collection`, not an
  // identity change — screenId stays `mining`-scoped. Not an independent
  // decision: reached by drilling into its parent, never a nav row of its
  // own. Frameless per `screen-inventory.md` §3's table, row `/mining`.
  {
    screenId: "mining-review",
    name: "Mining — Review",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/mining/review",
    chrome: "app",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Inherits /playlists's ruling (A11): stays its own screen, not folded
  // into Explore. Not an independent decision — reached by drilling into
  // its parent, never a nav row of its own. Frameless per
  // `screen-inventory.md` §3's table, row `/playlists` ("IA question still
  // open" before A11 settled it).
  {
    screenId: "playlists-detail",
    name: "Playlists — Detail",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/playlists/[id]",
    chrome: "app",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Inherits /reading's ruling (A10): hidden, code kept, not deprecated.
  // Not an independent decision — a reading sub-route is reached by
  // drilling into its parent and is never a nav row of its own.
  // Frameless per `screen-inventory.md` §3's "Already adjudicated by the user
  // 2026-08-11" list, which names this route explicitly.
  {
    screenId: "reading-detail",
    name: "Reading — Detail",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/reading/[id]",
    chrome: "app",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // R6 fires: a Figma frame now exists for /register, captured in the second
  // batch (figma-frame-map.md § "Second capture batch (2026-08-23)" — Auth
  // flow table). Converted from repo-only. The has-a-ruling axis is
  // untouched by this conversion — decision-register.md still says nothing
  // about /register itself.
  // ⚠️ The frame shows a "Continue with GitHub" button. That is NOT an open
  // question: `decision-register.md` P14 rules "Auth = email + Google +
  // Apple. GitHub: no" (confirmed still standing by the user 2026-08-25).
  // Registering the frame records what Figma designed, never what may be
  // built — the frame's content LOSES to P14 at port time, so whoever ports
  // this screen must not build the GitHub button. `65:2` (login) shows the
  // same button and the same ruling governs it.
  {
    screenId: "register",
    name: "Register",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "332:3",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: "/register",
    chrome: "auth",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Inherits /vocab's ruling (A10): hidden, code kept, not deprecated. This is
  // not an independent decision — an acquisition-loop sub-route is reached by
  // drilling into its parent and is never a nav row of its own.
  // Frameless per `screen-inventory.md` §3's "Already adjudicated by the user
  // 2026-08-11" list, which names this route explicitly.
  {
    screenId: "vocab-detail",
    name: "Vocabulary — Detail",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/vocab/[id]",
    chrome: "app",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Inherits /vocab's ruling (A10): hidden, code kept, not deprecated. This is
  // not an independent decision — an acquisition-loop sub-route is reached by
  // drilling into its parent and is never a nav row of its own.
  // Frameless per `screen-inventory.md` §3's "Already adjudicated by the user
  // 2026-08-11" list, which names this route explicitly.
  {
    screenId: "vocab-review",
    name: "Vocabulary — Review",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/vocab/review",
    chrome: "app",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },

  // ===================================================================
  // Designed, no route yet (R5) — legal and meaningful, NOT an error.
  // ===================================================================

  {
    screenId: "kanji-explorer",
    name: "Kanji explorer",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "29:2890",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "kanji-library",
    name: "Kanji library",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "280:3",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // §7.2 — the ⌘K command palette. Heading tags it `CONFIRMED` (the screen
  // of record); the cluster verdict table (§7.3) agrees. Recorded as a
  // screen even though the surrounding prose muses it is "a panel, not a
  // canonical screen" — the two structured tags outweigh the aside.
  {
    screenId: "search-lesson",
    name: "Search lesson",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "212:14610",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "summary-in-shadowing",
    name: "Summary (in shadowing)",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "125:1030",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "jlpt-phase-test",
    name: "JLPT Phase test",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "234:618",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "practice-result",
    name: "Practice result",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "242:14234",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "review-mistake-after-jlpt-practice",
    name: "Review mistake (after JLPT practice)",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "243:14899",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "learning-memory",
    name: "Learning memory",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "180:1770",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "growth-areas",
    name: "Growth Areas",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "187:6556",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "roadmap-detail",
    name: "Roadmap detail",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "180:2",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "conversation-memory",
    name: "Conversation memory",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "184:3974",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "welcome-companion-page",
    name: "Welcome Companion page",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "220:16766",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "generate-sensei",
    name: "Generate sensei",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "111:1877",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // The live-session frame — see the "speaking" entry above for why this
  // has no route of its own (§15.6: "none (session UI exists in-page)").
  {
    screenId: "conversation-practice",
    name: "Conversation practice",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "44:7289",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "pronunciation-detail",
    name: "Pronunciation detail",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "36:4117",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // JUDGEMENT CALL: the frame's layer name is "Grammar analysis" (kept
  // verbatim in `name`, per the Dashboard precedent) even though §17.1
  // finds its real identity is a sentence parser ("Sentence Analysis"),
  // distinct from the /grammar catalogue. See the "grammar" repo-only entry
  // above.
  {
    screenId: "grammar-analysis",
    name: "Grammar analysis",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "284:1464",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "edit-profile",
    name: "Edit profile",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "67:595",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Worked example.
  {
    screenId: "pricing",
    name: "Pricing",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "74:564",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "checkout",
    name: "Checkout",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "209:14032",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "faq",
    name: "FAQ",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "75:1424",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "quickstart",
    name: "QuickStart",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "111:1556",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },

  // ===================================================================
  // State-variants with no route (R11) — never promoted to screens.
  // ===================================================================

  // Worked example.
  {
    screenId: "explore-lessons-with-preview",
    name: "Explore Lessons (with preview)",
    kind: "state-variant",
    variantOf: "explore-lessons",
    figmaNodeId: "200:10726",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "search-lesson-searched",
    name: "Search lesson (searched)",
    kind: "state-variant",
    variantOf: "search-lesson",
    figmaNodeId: "212:14753",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "pronunciation-in-shadowing",
    name: "Pronunciation (in shadowing)",
    kind: "state-variant",
    variantOf: "shadowing-practice",
    figmaNodeId: "120:2027",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "finish-phase-1",
    name: "Finish phase 1",
    kind: "state-variant",
    variantOf: "jlpt-practice-phase-1",
    figmaNodeId: "237:6708",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "to-phase-2-ready",
    name: "To phase 2 (ready)",
    kind: "state-variant",
    variantOf: "jlpt-practice-phase-1",
    figmaNodeId: "234:1639",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "to-phase-2-countdown",
    name: "To phase 2 (countdown)",
    kind: "state-variant",
    variantOf: "jlpt-practice-phase-1",
    figmaNodeId: "234:1667",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "jlpt-practice-phase-2",
    name: "JLPT practice (phase 2)",
    kind: "state-variant",
    variantOf: "jlpt-practice-phase-1",
    figmaNodeId: "240:12992",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "review-mistake-more-detail",
    name: "Review mistake (more detail)",
    kind: "state-variant",
    variantOf: "review-mistake-after-jlpt-practice",
    figmaNodeId: "243:15364",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // §11.4 — misnamed frame: it is the Companion DIARY's empty state, not
  // Companion home's. variantOf points at "journey" (the registered
  // screenId for 190:7376 Companion Diary), not a "companion-diary" id.
  {
    screenId: "empty-state-companion-home",
    name: "Empty state (Companion home)",
    kind: "state-variant",
    variantOf: "journey",
    figmaNodeId: "216:15648",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  {
    screenId: "generate-done",
    name: "Generate done",
    kind: "state-variant",
    variantOf: "generate-sensei",
    figmaNodeId: "111:1963",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // variantOf "speaking" — the registered screenId for 170:9364
  // (Conversation practice library), the screen this preview overlays.
  {
    screenId: "quick-preview-panel-conversation-practice",
    name: "Quick preview panel: Conversation practice",
    kind: "state-variant",
    variantOf: "speaking",
    figmaNodeId: "180:1129",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },

  // ===================================================================
  // Phase 3 Stage 1 — the 2026-08-23 frame batch (figma-frame-map.md §
  // "Second capture batch"). impl: "none" for all — no page, no server
  // action, no route exists for any of these yet.
  // ===================================================================

  // Auth flow — Reset password. Same OAuth+email split layout as
  // register/login; Supabase Auth supplies the primitive, no code exists.
  {
    screenId: "reset-password",
    name: "Reset password",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "333:210",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Auth flow — Email OTP (6-digit code entry, resend link). No code exists.
  {
    screenId: "email-otp",
    name: "Email OTP",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "335:306",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Real 404 page design. Repo has no not-found.tsx anywhere — Next's
  // default 404 serves today.
  {
    screenId: "error404",
    name: "Error404",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "335:1976",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Real in-app route-error screen, rendered inside actual app chrome
  // (sidebar + topbar visible in the frame). Repo has no error.tsx anywhere.
  {
    screenId: "error-boundary",
    name: "Error boundary",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "337:2055",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Full /settings/membership page design. Zero PayOS integration code
  // exists yet — Layer 8 territory (CLAUDE.md §3).
  {
    screenId: "membership",
    name: "Membership",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "340:3795",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Same membership page with the "Leave Korume for now?" cancellation
  // dialog open.
  {
    screenId: "unsubscribe-membership",
    name: "Unsubcribe membership",
    kind: "state-variant",
    variantOf: "membership",
    figmaNodeId: "340:4586",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Same membership page with the payment-method dialog open. ⚠️ The frame
  // offers PayOS + SePay + MoMo. That is NOT an open question:
  // `decision-register.md` P13 rules "Payment is PayOS" (confirmed still
  // standing by the user 2026-08-25, who also re-affirmed it on 2026-08-23
  // when this frame surfaced; CLAUDE.md §3 unchanged). SePay/MoMo are design
  // exploration, deferred for merchant-registration reasons — see the note
  // against P13 in the decision register. Registering this row records what
  // Figma designed, not what may be built: whoever ports this screen MUST
  // apply P13, not the frame's provider list.
  {
    screenId: "choose-method",
    name: "Choose method",
    kind: "state-variant",
    variantOf: "membership",
    figmaNodeId: "340:5402",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },

  // ===================================================================
  // Superseded frames still on the Figma page (kind: "deprecated").
  // ===================================================================

  // Final whole-branch review FIX 2. `docs/product/figma-frame-map.md` records
  // this frame as "superseded — dead frame, build against `149:2`. Still on the
  // page as of 2026-08-12; the delete-plus-rename pair was not carried out",
  // and its closing arithmetic confirms it is the only one of the three
  // flagged-for-deletion frames still present. `deprecated` exists for exactly
  // this — a frame recorded so it is not rediscovered and built against by
  // someone who searches Figma for "Shadowing Hub" and finds this one first.
  // The LIVE hub is `149:2`, registered above as `lessons`.
  //
  // screenId is NOT "shadowing-hub": R3 makes screenId product identity, and
  // the product identity of the Shadowing hub belongs to the live screen. This
  // row is the dead artefact, named as such.
  {
    screenId: "shadowing-hub-superseded",
    name: "Shadowing Hub",
    kind: "deprecated",
    variantOf: null,
    figmaNodeId: "90:1985",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
];
