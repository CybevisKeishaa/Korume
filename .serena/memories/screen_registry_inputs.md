# Screen Registry — product inputs (user adjudications, 2026-08-11)

> ⚠️ **CORRECTION (2026-08-13).** Two claims below are stale. **A10 shipped in Phase 1b**, not
> Phase 2 — all four routes carry `navGroup: null` at HEAD. And `legacy-unreviewed` was renamed to
> `no-frame-at-last-pass` in Phase 2a, which also measured that 21 of the 23 entries it labelled
> were never debt. **The registry at HEAD is the current inventory; this file is historical input.**

Inputs for writing the **Phase 1 plan** against
`docs/superpowers/specs/2026-08-08-screen-registry-design.md` (approved, committed `e861150`),
and for the **Phase 2 backlog** that plan will produce. Background: `mem:project_status`
§ NEXT ACTION, and the auto-memory `korume-screen-registry-decision`.

These are rulings on the **repo-only side** of the 44↔56 divergence — routes the repo has with no
Figma frame. The user went down that list on 2026-08-11 and adjudicated most of it.

## ⚠️ The structural finding that governs how these rulings get used

**None of these rulings can be encoded in the Phase 1 registry, because the registry has no field
for them.** `ScreenEntry` (spec §3.1) carries exactly `screenId · name · kind · variantOf ·
figmaNodeId · repoOnlyReason · figmaCheckedAt · route · chrome · impl · navGroup · navOrder`.
`kind` = `screen | state-variant | deprecated | repo-only`; `impl` = `built | placeholder | none`;
`repoOnlyReason` = a **closed two-value enum** (`out-of-design-scope`, restricted by R13 to
`chrome:'admin'`, else `legacy-unreviewed`). There is **no `deferred`, no `hidden`, no `drop`.**

The controller asserted mid-conversation that Phase 1 would "record these as declared states
(`redirect`/`deferred`/`drop`)" — **that vocabulary was invented and does not exist in the spec.**
Corrected before any plan was written. This is `L-013` caught early for once: the wrong assumption
was upstream, in the controller's own framing, not in an implementer.

**The only lever that could express "hidden" is `navGroup: null` — and using it fails Phase 1 by
construction.** Phase 1 acceptance is zero visual diff, machine-checked as *derived `NAV_GROUPS`
deep-equals a snapshot of today's literal captured before the refactor*. Today's literal
(`components/layout/app-nav.tsx:23`) contains `/reading` (group `learn`), plus `/community` and
`/leaderboard` (group `study`). Nulling their `navGroup` makes derived ≠ snapshot → red.

**Therefore: every ruling below is Phase 2 work.** Phase 1 inventories these routes as
`kind:'repo-only'` + `repoOnlyReason:'legacy-unreviewed'` + `impl:'built'` with their nav rows
**unchanged**. R13's rationale is exactly this — `legacy-unreviewed` makes the debt *named and
countable* so Phase 2 can report on it. These rulings are the **content of that Phase 2 ruling**,
decided ahead of time. User agreed to this boundary explicitly.

When Phase 2 does remove nav rows, note `components/layout/app-nav.test.tsx` holds a hardcoded
per-group `expectedCounts` record — it moves with the literal, or it goes red.

## The rulings

1. **`/reading` — hide, keep the code, build no further.** Not a deletion: the module (2 routes, DB
   tables, API, the `reading` i18n namespace translated in L9a Plan 3 Task 14, its components) stays
   in the repo untouched. The user will reconsider the feature later. So Phase 2 removes the nav row
   only; the registry entry persists and is *not* `deprecated`.
2. **`/leaderboard` — hide.** Reason is product, not technical: with no users, a leaderboard exposes
   that the system is empty.
3. **`/community` and `/community/peer-review` — hide, same reason as leaderboard**, and the user
   noted it is stronger here: peer review only works once there are enough users. (`/community/[id]`
   rides along.)
4. **JLPT — not a divergence at all, and this one discredits the method.** The user confirmed
   (2026-08-11) that **Figma has both a test-picker frame and test-taking frames**. The repo matches:
   `/jlpt` renders `JlptTestList` + `JlptAttemptList` + `LevelTabs` (= pick a test, filtered N5–N1,
   with attempt history) and `/jlpt/[id]` renders `JlptTestRunner` with a `section` search param
   (= sit the test). Designed **and** built.

   It was counted as repo-only purely because a route named `/jlpt-test` exists — and that route is
   an 8-line dead `redirect()` to `/jlpt`, commented as superseded in Layer 5.
   ⚠️ `ScreenKind` has no `redirect` member; decide `deprecated` vs out-of-scope per §3.3. Small.

## ⚠️⚠️ The divergence list was built by matching ROUTE STRINGS, and JLPT proves that is unsound

A screen that is fully designed and fully built was counted as a gap because its route string and
its frame name did not match. **This is exactly what R3 exists to prevent** — `screenId` is the join
key, the route is not.

**Consequence for the plan: the "7 repo-only routes" figure must NOT be inherited. Phase 1 has to
re-derive the divergence from screen identity.** The five rulings above survive because each was
verified individually against schema/components this session; the *method* that produced the list
did not. Treat any other count carried over from the 2026-08-08 pass the same way (`L-002`).

## Two premises the user held that the repo contradicts — corrected, measured

**Mining is NOT "save kanji".** `/mining` is **sentence mining**, CLAUDE.md §5 differentiator #3.
`mining_cards` (`supabase/migrations/20260712000008_sentence_mining_cards.sql`) stores `video_id`,
`transcript_line_id`, `target_word`, `reading`, `sentence_jp`, `sentence_translation`,
`start_time`, `end_time` **plus its own SM-2 columns**. Flow: tap a transcript line in a video →
mint a card carrying the whole sentence, replayable by seeking the YouTube IFrame (§2: no media
stored). `lib/data/mining.ts`'s header comment states it deliberately never touches
`lib/data/srs.ts`.

What the user *called* save-kanji is the separate SRS-item system: `user_kanji_progress` /
`user_vocab_progress`, keyed `(user, itemType, itemId)`, `itemType` enum = `kanji | vocab` only.
**And there is no explicit "save" action anywhere** — no add-to-deck endpoint, no save button; a
progress row is created implicitly on first review (`submitReview` upserts from `INITIAL_STATE`).
So "deliberately collecting a kanji for yourself" does not exist as a user action today.
→ If Figma's `FlashCard` frame is that idea, it maps to the **SRS side, not `/mining`**, and the two
must be separate `screenId`s.

**The user's actual intent, stated 2026-08-11: a save button EVERYWHERE — including on the
highlight-a-word/inspect popover — with the results collected on the kanji screen.** Half of this
already exists and the missing half is already diagnosed. `components/reading/word-lookup-popover.tsx`
IS that popover (tap a word → reading + meaning), and its header comment records why its
"Add to flashcard" action **ships deliberately disabled**: `POST /api/mining` requires a `lineId`
foreign-keyed into `transcript_lines`, which exist only for video transcripts, so a reading passage
has no schema-legal way to mint a card. It shows the action with a visible explanation rather than
firing a request guaranteed to fail. Unblocking needs a nullable `lineId` + a source discriminator —
already carried in `mem:feature_backlog_deferred` as F-010/F-014.

Also: `/kanji` is the **full catalogue**, with no "kanji I saved" notion; `user_kanji_progress` rows
appear implicitly on first review. A "my saved items" surface does not exist.

**Ruling for scope: this is a cross-cutting FEATURE (lookup → save → SRS → a "mine" surface) that
changes schema. It is not registry data. Keep it out of Phase 1; it belongs in the Phase 2 backlog
and then needs its own spec.**

**What a playlist actually is, measured** (`supabase/migrations/20260712000001_schema.sql:218`):
`user_playlists (id, user_id, name, created_at)` + `user_playlist_items (playlist_id, video_id,
order_index)`, PK `(playlist_id, video_id)`; L7's `20260714000014_community_admin.sql` adds
`is_public bool default false` and `description`, with an additive `playlists_public_read` policy
letting any authenticated user SELECT public rows. So: **a named, ordered, user-owned collection of
videos and nothing else** — a YouTube-style playlist, private by default, opt-in shareable. It is
already wired into the shadowing flow: `SaveToPlaylistButton` renders at
`app/[locale]/(protected)/(app)/shadowing/page.tsx:80` and
`app/[locale]/(protected)/(focus)/shadowing/[id]/page.tsx:35`.

**`/playlists` is not `/shadowing/explore`.** `/shadowing/explore` is today a **stub** rendering
`UpcomingScreen` (one of C1's nine empty-state routes) and already has a planned owner:
**Plan C3 — Explore Lessons**. `/playlists` is genuinely built and community-flavoured — it calls
both `listPlaylists()` and `listPublicPlaylists()`, and its view lives at
`components/community/playlists-page`. Two different concepts: browsing the whole catalog vs a
user-curated, publicly shareable collection. Note the spec's own R2 already uses playlists as its
worked example: `kind: 'repo-only'` + `impl: 'built'`.

The user's underlying model — *explore holds every video including ones the user imported* — is
supported: `POST /api/videos/import` → `createLesson()` is user-scoped with a monthly quota
(403 "Monthly lesson quota reached"), so self-import is a real user feature, not admin-only.

## ⚑ Still open — the user has not answered these

1. **Keep `/playlists` as its own screen, or fold it into Explore as a tab/filter?** Narrowed from
   the earlier framing once the schema was measured: the data model and the save button are
   unaffected either way, so this is purely a screen-identity/IA call. Affects C3's scope.
2. **Which Figma frame carries the save/flashcard idea?** Unidentified — the user said "Figma có
   luôn rồi" while describing mining, but mining ≠ save-kanji. Needs a human Figma pass
   (R7 — no automation reaches Figma). The *feature* is understood (above); the *frame* is not.
3. `/jlpt-test`'s `kind`: `deprecated`, or out of scope per §3.3 (see ruling 4). Small.

## Related

`mem:project_status` · `mem:shadowing_hub_plan_c_run_state` (C3 is the Explore owner) ·
`mem:figma_make_design_source` (student-tier account, Code Connect unavailable) ·
`docs/lessons.md` (`L-013` upstream-defect class; `L-002` never record derived counts)
