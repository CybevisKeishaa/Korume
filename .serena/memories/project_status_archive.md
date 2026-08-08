# Project status — ARCHIVE of superseded NEXT ACTION blocks

Split out of `mem:project_status` on 2026-08-07 because that file had grown past the point where
it could be read in one call — every session was hitting a token-limit error on the one memory whose
own first line says "Read this first each session".

**Nothing here is current.** Every block below was already labelled `(superseded)` in place. It is kept
verbatim because these blocks carry the reasoning behind decisions that still hold, and several later
corrections point back at them. For what IS current, read `mem:project_status`.

---

## ▶ (superseded) NEXT ACTION (2026-08-06) — **Korume rebrand COMPLETE. Plan A (Docs) `69c4685` + Plan B (Code) `44521bc` both MERGED to master. Next: the Figma Make adoption brainstorm (see `mem:figma_make_design_source`), then Shadowing Hub Plan C (Hub UI).**

### ✅ Plan B (Code) — EXECUTED + MERGED `--no-ff` at `44521bc` (2026-08-06). Branch + worktree deleted.

All 5 tasks via `superpowers:subagent-driven-development` (fresh implementer + independent reviewer
per task, sonnet tier; opus for the final whole-branch review). **Every task review: spec-compliant,
0 Critical / 0 Important.** Tasks 1–2 were done inline in the controller session before the SDD ledger
existed; Tasks 3–5 went through the full loop.

| | Commit | What |
|---|---|---|
| T1 | `f8690c8` | runtime brand strings — i18n catalogs, pin tests, e2e |
| T2 | `1e920f3` | root layout `"%s · Korume"` title template + tailwind comment |
| T3 | `55a8773` | `NAV_ITEMS` → 5-group `NAV_GROUPS` (14 shipped; videos→lessons, conversation→speaking, journal→journey) |
| T4 | `d46f0f9` | Nav Column visibility toggle, visible by default |
| T5 | `c80829b` | `CompanionAnchor` boundary narrowed to Shadowing mode only |

**The final whole-branch review earned its keep again — 1 Critical + 4 Important that no per-task
diff could reveal.** See docs/lessons.md L-011.
- `ef564c7` **Critical:** `tests/e2e/journal.spec.ts` still clicked a link named `"Journal"` after T3
  renamed the nav label to `"Journey"`. Invisible because **`vitest.config.ts:13` excludes
  `tests/e2e`** — `npm test` structurally cannot run Playwright specs, so no task run could catch it.
  See docs/lessons.md L-025. T1 remembered to; T3 did not.
  Same commit also fixed mobile top-bar heading overflow, a sub-24px touch target, 2 stale comments.
- `d5f08b8` **Important:** nav said "Lessons" but `/videos` page `h1` + document title still said
  "Videos" — a label `navigation-system.md:29-38` disqualifies **by architectural invariant**. The
  branch fixed the nav half and thereby *introduced* the mismatch. EN→"Lessons", VI→"Bài học", pin updated.
- `422af2d` **Important:** two `navigation-system.md` claims the code now contradicted — toggle default
  still recorded as "not decided" (branch decided + shipped it), and a streak indicator + "Rain Sound"
  toggle listed as "(shipped)" when neither exists (grep: 0 hits). Landed as its own commit since
  Plan B's Global Constraints forbid `docs/` edits during task execution.

**Out-of-plan fixes folded in:**
- `5924603` kebab-case slug `nihongo-cinema` → `korume` in `package.json`/`package-lock.json` and the
  **Azure Speech TTS `User-Agent`** (a real runtime brand string). They survived because the plan's
  grep pattern was title-case `Nihongo Cinema` only. **`supabase/config.toml` `project_id` deliberately
  NOT renamed** — it drives the local Docker container names (`supabase_db_nihongo-cinema`, referenced
  by a `.claude/settings.local.json` permission), so renaming orphans the local DB volume. Open infra cleanup.
- `cad2cb8` **`.eslintrc.json` now declares `"root": true`.** ⚠️ **THE NESTED-WORKTREE ESLINT GOTCHA IS
  DEAD — stop warning implementers about it.** Root cause was that neither the worktree nor the parent
  config declared `root`, so ESLint's resolution walked up and loaded both. Verified from inside a
  worktree afterwards: `lib/eslint-rules.test.ts` 11/11 (was 11 failures), `npm test` 1960/1960 (was
  1949/1960), `npm run lint` exit 0 (was unrunnable).
- `d37ca58` kuromoji dictionary-load timeout 20s → 60s in `lib/japanese/{furigana,tokenizer}.test.ts`.
  The load measures 16–20s under parallel contention and flaked. **Note for future debugging:** those
  flakes only appeared while a second `vitest` process ran concurrently — three consecutive quiet runs
  were 1960/1960. Don't chase suite flakes without checking what else is running.

**Verified before merge** (from the worktree, all previously impossible there): `npm test` 218 files /
1960 tests, **three consecutive clean runs**; `npm run typecheck` exit 0; `npm run lint` exit 0, 0
errors + 78 warnings = master's pre-existing count. **Re-verified on master after merge: 1960/1960,
typecheck 0, lint 0.**
⚠️ **`npm run test:e2e` NOT run** (needs live dev server + Supabase). The Critical fix in
`journal.spec.ts` is therefore verified by reading the catalogs, not by execution — **run it when a
dev environment is up.**

⚠️ **Gotcha for anyone running the suite from the MAIN repo root:** `vitest.config.ts` excludes
`node_modules`, `.next`, `tests/e2e` — **but NOT `.worktrees/`**. With a worktree present, a root
`npm test` scans both trees (observed: 594 files / 5440 tests instead of 218 / 1960, with dozens of
bogus failures). Pass `--exclude ".worktrees/**"` or remove the worktree first. Not yet fixed in config.

### (historical) Plan A (Docs)

**What happened:** All 8 tasks of `docs/superpowers/plans/2026-08-05-korume-rebrand-shadowing-figma-reconciliation-plan-a-docs.md` executed via `superpowers:subagent-driven-development` (fresh implementer + task reviewer per task, cheap-tier models for the mechanical transcription work, sonnet-tier reviewers). All 8 task reviews clean (0 Critical/Important; 2 pre-existing report-narrative Minors ruled non-blocking). Final whole-branch review (opus) found 3 NEW Important findings only visible at whole-branch scope — cross-file contradictions the per-task lens structurally could not see: (1) `design-reconciliation.md` §4 prose not updated to match §6's Companion-boundary narrowing from Task 6; (2) the new "toggleable Nav Column" paragraph in `navigation-system.md` (Task 4) contradicted 3 other sections asserting a fixed 240px always-visible column; (3) "the shipped navigation... is 5 named groups" overclaimed shipped status the code doesn't have (still a flat 14-item list; Plan B builds the real 5-group `NAV_ITEMS`). One fix-wave commit resolved all 3 (scoped re-review: all ADDRESSED, no new breakage). Merged to master `--no-ff` at `69c4685` 2026-08-05 (branch `korume-rebrand-plan-a-docs` deleted, worktree removed). Product is now renamed Nihongo Cinema → **Korume** across all 36 living files that were in scope; ~20 historical dated specs/plans/journal/migrations correctly untouched.

**Deferred to Plan B or a later docs cleanup (ruled non-blocking by the final reviewer, not yet actioned):** `screen-search.md:110` stale "14-item inventory" count; `navigation-system.md` two "all 14 NAV_ITEMS" mentions now ambiguous next to the 22-row table; `companion-patterns.md` § Learning Boundary still repeats the pre-narrowing loop list (same fix as design-reconciliation.md §4, not yet propagated there); `learning-surfaces.md:709` "Shadowing Practice is Not Supported" now true only of Shadowing mode, not the whole Lesson screen; nav table rows 9/12 (review/challenges) lack the "(Planned)" marker other unwired rows have; `lessons`→`/shadowing` vs. shipped `/videos` route drift (pre-existing, not a regression); §6 Anchor Availability row ordering no longer groups by status (looks deliberate).

**Plan B (Code) — WRITTEN `851f653`, EXECUTED + MERGED `44521bc`. See the block at the top of this section for the outcome; the description below is the pre-execution plan text.**
`docs/superpowers/plans/2026-08-05-korume-rebrand-shadowing-figma-reconciliation-plan-b-code.md` —
written via `superpowers:writing-plans` on **Fable** (user-approved model choice; cost $6.09).
5 tasks: (1) i18n catalog rename + `common.pin.test.ts` + `test/messages.test.ts` +
`tests/e2e/home.spec.ts` in ONE commit (L9a catalog-mutation rule), (2) `app/[locale]/layout.tsx`
title template + `tailwind.config.ts` comment, (3) `NAV_ITEMS` → 5-group `NAV_GROUPS` (14 shipped
destinations only; `videos`→`lessons`, `conversation`→`speaking`, `journal`→`journey`),
(4) Nav Column visibility toggle (built fresh, visible-by-default — user-resolved), (5) narrow
`components/companion/anchor-boundary.test.ts` to Shadowing-mode-only.

**Two user decisions already baked into the plan file (committed, don't re-ask):** `appNameJp`
becomes romaji **"Korume"** (not katakana コルメ); Nav Column default visibility **outside** the
Lesson Workspace is **visible**.

**Fable's reality-check findings written into the plan (read its "Reality-check findings" §):** the
shipped Hub route is **`/videos`, not `/shadowing`** — Plan B renames the key/label only and keeps
`href: "/videos"`, route rename deferred to the Hub UI plan; **no Lesson-Workspace nav-hide
mechanism exists in code** (doc-only mandate), so Task 4 builds the toggle fresh; `tailwind.config.ts`
confirmed comment-only; INSIGHTS group renders nothing yet (all 3 rows unbuilt).

**(superseded) Execution state:** the resume-point / open-finding / worktree-gotcha blocks that used
to sit here described mid-execution state and are now all resolved by the `44521bc` merge — see the
outcome block at the top of this NEXT ACTION section. Three points worth carrying forward:
`package.json` was renamed to `korume` in `5924603`; the **nested-worktree ESLint gotcha is FIXED**
(`cad2cb8`, `"root": true`) so do not warn implementers about it any more; and Tasks 1–2 were run
inline while Tasks 3–5 went through the full SDD loop.

**Not done / explicitly deferred:** only Shadowing Hub + Shadowing Practice were reviewed against the
~20-screen Figma file — the other ~18 screens are unreviewed, a natural follow-up once this
reconciliation lands (spec §7). Filename `docs/design/nihongo_page_playbook.md` and classification of
`docs/reference/GRAND_PLAYBOOK.md` (historical vs. living) are open, not resolved by this spec or Plan
A. Community/Leaderboard omission from the Figma nav redraw — confirmed an oversight by the user,
also tracked in Claude's own cross-session memory system (`figma-nav-redesign-community-leaderboard-gap`,
not a Serena memory) — Plan A Task 4 already re-added both to the STUDY group, resolved.

**Shadowing Hub Lesson Workspace Plan C (Hub UI) — still pending, now UNBLOCKED.** This reconciliation
has landed, so Plan C can now be built against the new nav/branding without needing a second pass.
Detail below unchanged.

## ▶ (superseded 2026-08-05) — **Shadowing Hub Lesson Workspace: Plan A (Docs) MERGED `a6a7617` + alignment `b9873ab`; Plan B (Backend) MERGED `b36c455` (pushed). NEXT = Plan C (Hub UI), after the Figma Make brainstorm. Detail below.**
> ⚠ The old heading here said "Resume with Plan B" — stale since 2026-08-01, corrected 2026-08-06.
> Plan B is done (see its block below). Plan C and Plan D are what remain.

**What happened 2026-07-31 (supersedes the L9b Plan 1 brainstorm block below — that item was absorbed, see next paragraph):** A new spec
`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` (LOCKED, committed
`249c442`) extends the still-unexecuted 2026-07-29 Shadowing Hub Consolidation spec with a full
Lesson domain model (§1: `library_access`, `user_lesson_library`, `collections`), a Create Lesson
pipeline (§2, supersedes L9b Plan 1's "transcript-submit UI" item — backlog #14 in
`mem:feature_backlog_deferred` is now resolved BY THIS SPEC, not by Plan 1), a monetization model
(§3), and the Lesson Workspace itself (§6: three-layer model — Learning Mode ×4 / View Mode ×3 /
Reading Settings / Analysis). L9b Plan 1 narrows to just: GDPR delete-all-my-data, persist voice
pronunciation score, badge icons (see `mem:l9b_plan1_launch_blocker_debt_status`, updated
separately). The spec split into **4 plans: A Docs / B Backend / C Hub UI / D Lesson UI.**

**Plan A (Docs) — DONE, executed via `superpowers:subagent-driven-development` in a git worktree**
(`docs/superpowers/plans/2026-07-31-shadowing-hub-lesson-workspace-plan-a-docs.md`, 22 tasks, one
implementer+one reviewer per task on Opus 5 for complex tasks / Haiku for mechanical ones). Renamed
`screen-video-library.md`→`screen-shadowing-hub.md`, `screen-shadowing-detail.md`→
`screen-shadowing-practice.md`, deprecated `screen-video-detail.md`, executed the Consolidation
spec's full 17-file change list AND layered in the Lesson Workspace spec's new content + its own
7-file gap audit in the same pass. Final whole-branch review (opus): 0 Critical, 4 Important
(1 mechanical fix wave applied+re-reviewed clean; 3 surfaced to user, not silently patched — bare
"Videos" strings outside plan scope, a spec-level core-loop wording self-contradiction, a
spec-verbatim citation nit). Merged `--no-ff` `a6a7617`.
**⚠ Incident, resolved:** one subagent (Task 20) briefly committed onto `master` in the main checkout
instead of the worktree branch (relative-path/cwd confusion in its Edit/git-commit calls) — caught
before proceeding (review-package showed BASE==HEAD), user confirmed cleanup, content
cherry-picked onto the worktree branch cleanly, master fully restored (`git reset --hard`), verified
clean by both the controller and the final review. **Mitigation that worked for the rest of the
plan:** every subsequent dispatch prompt required an explicit `cd "<worktree>" &&` prefix on EVERY
Bash command, absolute paths for Edit/Write/Read, and a self-verification step
(`git rev-parse --show-toplevel && git branch --show-current`) pasted into the report BEFORE
committing — zero recurrences after adopting this. **Apply this prompt pattern from the start next
time a worktree-based SDD run dispatches implementers**, not only after a first incident.

**Follow-up commit `b9873ab` (same day, small branch `domain-model-alignment`, no SDD machinery —
direct edit + one code-reviewer pass):** user picked 3 of the final review's surfaced items to fix
immediately (their own scoped decision, explicitly declining the rest to avoid scope creep):
(1) rewrote `docs/design/patterns/study-modes.md`'s stale flat 7-mode taxonomy to point at the new
Three-Layer Model, propagated through every cross-reference in the file; (2) synced the core-loop
wording in `business-model.md` (3 disagreeing occurrences → 1); (3) created
**`docs/product/domain-model.md`** — new canonical glossary (Video/Lesson/My Lessons/Library/
Collection/Learning Mode/View Mode/Analysis + the "Lesson is canonical, everything else is a
projection" test), registered in `design-reconciliation.md`'s Authority Order alongside
business-model.md. Deliberately NOT touched: leftover bare "Videos" strings in
`adaptive-layouts.md`/`learning-surfaces.md`/`screen-search.md`, the `§2/§3.1`→`§2/§5` citation nit,
anything in Search/Dashboard/Adaptive Layout beyond what's needed — all still open, low-priority,
candidates for whenever those files are next touched (not blocking).

**Plan B (Backend) — DONE, merged `master` `b36c455` (2026-08-01), pushed to origin.** Executed via
`superpowers:writing-plans` → `superpowers:subagent-driven-development` in a git worktree
(`docs/superpowers/plans/2026-07-31-shadowing-hub-lesson-workspace-plan-b-backend.md`, 18 tasks,
2 required a fix round — Task 13 Create Lesson pipeline, Task 16 Promotion Queue backend — plus a
final whole-branch review on Opus with one combined fix wave, re-reviewed clean). Delivered: 6
migrations (`lesson_access_level` enum replacing `status`, `user_lesson_library` dedup/quota ledger,
`collections`/`lesson_collections`, RLS rewrite, `promotion_starred`, plus 2 more from the final
review — widened `videos_read` PLUS-metadata visibility, restored indexes Task 6 silently dropped);
`lib/data/subscriptions.ts`, `lib/data/lesson-library.ts`, `lib/data/lesson-creation.ts` (the Create
Lesson pipeline, both learner + admin-seed entry points), `lib/data/transcript-providers.ts`
(`youtubeCaptionProvider` real, `aiTranscriptProvider` a deliberate 501 stub — real AI transcription
deferred pending a CLAUDE.md §2 audio-access decision, per the user's explicit call during
brainstorming), `lib/youtube/timedtext.ts`; `lib/data/admin-videos.ts` rebuilt as the Promotion Queue
backend (`listNeedsReview`/`promoteVideo`/`demoteVideo`/`starVideo`/`listTrendingLessons`/
`listReadyToPromote`/`listPublishedLessons`/`computePromotionScore`) + 7 admin routes. Final state:
tsc 0, vitest **1954/1954, 218/218 files** (verified from the clean main checkout post-worktree-
cleanup — an 11-test ESLint-plugin-conflict failure seen mid-session was a nested-worktree artifact,
not a real regression, confirmed gone once the worktree was removed).
**Deferred, tracked here for the next plan that touches this area (not silently dropped):** Free-tier
quota is enforced only in app code, not at the DB/RLS level (a client with its own JWT could in
principle bypass `createLesson`'s quota check via direct PostgREST calls) — real enforcement belongs
with Layer 8 (PayOS billing), not bolted on early. `promoteVideo`'s PRIVATE-only guard makes direct
FREE↔PLUS re-tiering impossible (only demote-then-promote works, with an access-loss window) —
belongs to the future Promotion Queue UI plan. `createLessonAsAdmin` (spec §4.1 Phase 1's admin-seed
entry point) has zero route/caller yet — intentionally parked like `aiTranscriptProvider`'s stub,
needs a minimal admin route when that UI plan starts.
**⚠ Incident, resolved (recurred despite the Plan A mitigation, then fixed harder):** one Task 9
implementer (haiku-tier) committed its `lib/video-types.ts` change straight onto `master` in the main
checkout instead of the worktree branch, AND its report file, DESPITE the exact `cd`+absolute-path+
self-verification prompt pattern Plan A's incident taught. Caught immediately by the controller
independently running `git worktree list`/`git log` after every dispatch rather than trusting the
implementer's self-report — cherry-picked the commit onto the worktree branch, restored master via
`git reset --soft` + single-file `git checkout` (not `--hard`, to avoid destroying this file's own
pre-existing uncommitted edit that was sitting in the main checkout the whole time). **Mitigation
escalated for the rest of the plan:** implementer model floor raised from haiku to sonnet, AND the
controller independently re-verified `git worktree list`+`git log` after every single dispatch for
the remaining 9 tasks, not just when something looked off — zero recurrences after both changes
landed together. **Apply both from the start next time**, not just the prompt-pattern half — a
strengthened prompt alone was not sufficient to prevent a repeat.

**→ NEXT: Plan C (Hub UI).** Needs its own `superpowers:writing-plans` pass building the learner-
facing Shadowing Hub screen (`screen-shadowing-hub.md`, collection-driven grid, My Lessons section,
Create Lesson modal) against Plan B's now-live API surface. Then **Plan D (Lesson UI)** (the
three-layer Lesson Workspace: Learning Mode / View Mode / Reading Settings / Analysis). The deferred
items above (quota DB-enforcement, FREE↔PLUS re-tiering, admin-seed route) are NOT Plan C's job
unless Plan C's own design surfaces a hard dependency on one of them — read this block fresh before
assuming otherwise. `mem:shadowing_hub_consolidation_status` remains stale (superseded by Plan A,
now also by Plan B) — read this memory (`mem:project_status`) as current.

<details><summary>(superseded 2026-07-31) L9b Plan 1 brainstorm block — historical, mostly absorbed above</summary>

## (superseded) L9b Plan 2 MERGED to master. L9b Plan 1 brainstorm IN PROGRESS (mid-session, not yet written to a spec file) — resume there.</details>

<details><summary>(historical) original NEXT ACTION detail, 2026-07-30, kept for context</summary>

**Merge done 2026-07-30**: `layer-9b-companion-presence` → `master` `--no-ff` at `61416bd` (message:
"Merge branch 'layer-9b-companion-presence' (L9b Plan 2 — Companion Presence)"). Post-merge re-verify:
tsc 0, **213 files / 1901 tests green** (unchanged from pre-merge — clean merge, no conflicts, `master`
was already an ancestor of the branch via an earlier in-branch merge). Local branch and its earlier
divergent Korume-mascot commit (`bb69897`, added out-of-scope sphere/ring/orb props) were reconciled —
`master`'s disciplined 9-task Korume build won; the leftover `phase2_final.png` preview was removed
(`bee2b8f`). **Master is 16 commits ahead of `origin/master`, NOT pushed** (never push unasked).

**⚠ Session-start hazard, seen this session, worth knowing if resuming cold:** while working on this
branch, another concurrent process/session was observed switching branches and committing directly
(`729e1cc "[LongTNP]: mascot"`, an in-branch `Merge branch 'master' into layer-9b-companion-presence`)
— all already reconciled and merged, nothing broken, but if `git status`/`git log` looks different than
this memory expects, check for a concurrent session before assuming corruption.

### L9b Plan 1 (launch-blocker debt) — brainstorm in progress, NOT yet written to `docs/superpowers/specs/`

Using `superpowers:brainstorming`. Scope (user confirmed keep all 4, don't split out badge icons):
transcript-submit UI, GDPR delete-all-my-data, persist voice pronunciation score, badge icons.
**Decisions locked in so far (all user-approved, do not re-litigate without new information):**

1. **Transcript sourcing — pivoted away from user-paste.** User corrected the initial plan (a paste
   textarea) after pointing at `transcript_source` enum already having 3 values since the first
   migration (`youtube_caption | user_submitted | ai_generated`) — `youtube_caption` was never
   implemented. **Decision: build ONLY auto-fetch `youtube_caption` now** (best-effort, never-throw,
   hooked into `lib/data/videos.ts::importVideo` right after the video row insert; reuses the existing
   `parseTranscript`/furigana pipeline via a new shared ingest helper, `source: 'youtube_caption'`).
   No fetch mechanism exists keylessly via the official Data API (`captions.download` needs OAuth as
   the content owner) — the only keyless option is YouTube's unofficial public `timedtext` endpoint;
   flagged to the user as a stability risk (Google could change/block it), not a §2 legal risk (text
   only, no video). **`ai_generated` (paid/AI transcript generation) explicitly deferred to L8** —
   ties into the Knowledge Generation quota (`business-model.md` §4), not built now.
2. **Empty-state copy** (no transcript available) follows `empty-states.md`'s **Content Error** pattern
   (Acknowledge → Explain → Offer recovery — link back to browse other lessons), replacing the old
   dead-promise "Transcript submission is coming soon" copy. **No Companion** in this state — Learning
   Loop Boundary (`design-reconciliation.md` §4) overrides `empty-states.md`'s general Companion-in-
   empty-state allowance. **No "Generate subtitles" button** — `screen-shadowing-detail.md`'s existing
   Empty States section describes that as the eventual (L8 `ai_generated`) state, not Plan 1's.
3. **GDPR delete-my-data — 3-stage lifecycle, user-specified, more complex than a simple confirm dialog:**
   Day 0 request → **7-day cancelable grace window** (banner + Cancel, app usable normally) → Day 7
   (if not canceled) hard-delete all user-owned data (recordings storage, shadowing/mining/conversation/
   SRS/xp_events/notifications/peer-review/companion/journal/reading/JLPT tables; forum posts →
   `user_id = null`, existing convention) + **ban** (not delete) the Supabase auth user, keep a
   `public.users` tombstone (id + deleted_at only) → **Day 97 (90 days after the data purge)**: hard-
   delete the auth user for real, freeing the email for reuse. Needs a **new in-process scheduler**
   (`setInterval` in the existing long-running almostgone.vn Node process, hourly sweep, two jobs:
   purge-at-day-7, release-email-at-day-97) — first user of infra that `srs_due`/push notifications
   (`feature_backlog_deferred.md` items 2/3) were already waiting on; treat as durable infra, not
   throwaway. **UI location corrected mid-brainstorm**: NOT a card in `/profile` (first answer) —
   `settings-patterns.md`'s "Dangerous Settings Separation" rule (never mix learning prefs/account
   info with account destruction) plus `navigation-system.md`'s existing "Settings Entry Point" section
   (already anticipates a future `/settings` top-level nav item near `profile`) means **a genuinely
   new `/settings` route**, linked from `/profile`, not a section within it.
4. **Persist pronunciation score** — trivial, mechanical. `conversation-app.tsx` already updates
   `pronunciation_score` into CLIENT state after scoring but never PATCHes `conversation_messages`
   (column exists, unused). Fix = add the PATCH call, best-effort like the rest of that flow.
5. **Badge icons** — content/asset work only (`badges.icon_url` all null, SVG fallback fine today);
   kept in Plan 1's scope per user's explicit choice, no design questions needed.

**Doc-update tasks Plan 1 must carry (not just code), per "Documentation follows reality"
(`docs/design/README.md`):** edit `screen-shadowing-detail.md` Empty States section (real Plan 1
copy, note the "Generate subtitles" offer is L8-future); **write new** `screen-settings.md` (backlog
item in `design-reconciliation.md` §12 — must follow full §8 Screen Documentation Rules; scope it to
what Plan 1 actually ships — Account + Privacy/Danger-Zone — mark Preferences/Subscription/Device
settings Planned); add `settings` to `navigation-system.md`'s `NAV_ITEMS` table (#15, `/settings`),
remove its "no route yet" caveat; remove the matching stale caveat in `screen-architecture.md`'s
Settings row; `settings-patterns.md` stays Draft (Plan 1 only ships a slice of its full vision).

**🔷 OPEN QUESTION FOR THE USER, asked, not yet answered — resume here:** a documentation-alignment
pass (triggered by the user, see below) surfaced `docs/superpowers/specs/2026-07-29-shadowing-hub-
consolidation-design.md` (Draft, decided-with-user-but-**unexecuted** — verified zero of its 17 file
edits have landed: `screen-video-library.md`/`screen-video-detail.md`/`screen-shadowing-detail.md`
all still under old names/titles/Approved status). That spec renames `screen-shadowing-detail.md` →
`screen-shadowing-practice.md` (among other IA changes: Video Library/Detail → Shadowing Hub, nav
`videos`→`shadowing`, **docs-only, explicitly defers actual route/code renames to a separate later
task**). Plan 1 independently already plans to edit `screen-shadowing-detail.md`'s Empty States
section (point 2 above) — same file, two separate efforts. **Asked the user: land the consolidation's
docs-only pass (17 files, no code/build/test dependency) FIRST to avoid a double-edit, before writing
Plan 1's spec? Answer pending — ask again on resume, don't assume.** Everything else substantive
holds regardless of this answer (points 1–5 above are unaffected either way).

**Full alignment-pass findings (authority order, principles discovered, conflict list) were delivered
in-conversation, not written to a file** — if resuming in a fresh session where that message is gone,
either re-run the same alignment pass (governance → architecture/navigation → patterns → screens, per
`design-reconciliation.md` §1) or ask the user to confirm the open question above stands.

**Original Plan 2 (Companion Presence) completion detail below, kept for history:**

**Branch `layer-9b-companion-presence`** (off master `ca0f5cf`), merged as `61416bd` above. Its own
HEAD before merge was **`dcc1338`**.

**Task 13 (whole-branch verification) done this session, same day as the Task 1–12 work below.**
Full gates: `tsc --noEmit` 0 · `npx vitest run` **213 files / 1901 tests green** · `npm run lint` exit 0
at **77 warnings / 22 files, 0 new** vs repo baseline · `npm run build` OK (`/journal` present in both
`/vi` and `/en` manifests) · `npx playwright test` 6/6 (a NEW standing flake was found and confirmed
non-regression: under 6-way parallelism, one of the three register→dashboard e2e specs
(`auth-locale-round-trip`/`journal`/`review`) intermittently times out waiting for the post-register
redirect right after a fresh `npx supabase db reset` restarts containers — always green standalone,
serial, or at `--workers=2`; add to the known-flake list alongside `pitch-contour.test.tsx`/
`waveform.test.tsx`/`lib/japanese/furigana.test.ts`, which is CPU-contention not auth-related).
Spec-coverage sweep: every §1 in-scope item + §9 test-list item mapped to a shipped task; 2 pre-existing
Minors confirmed harmless (`anchor-boundary.test.ts` stale allowlist entry; untested one-line
`requestReflection()` stub — proportionate, not fixed). Mutation-testing report (catalog + wiring, the
plan's own convention #1): found and fixed 2 real survivors — 9 unpinned `companion.json` VI leaves
(5 fully unpinned + 4 `companionGrew` phasings only digit-guarded) closed to 29/29 exact pins on both
locales, and the `videoId` thread from `TranscriptPane`→`PinLineControl` had NO test proving it actually
reached the POST payload through the real parent (only the leaf component was tested directly) — commit
`97e46e5`.

**Whole-branch independent review (scoped to `ca0f5cf..dcc1338`, excluding ~25 unrelated interleaved
`docs/design/` commits from a separately-merged effort): verdict READY TO MERGE = YES-WITH-FIXES.**
No §2 non-negotiable violation, §5.4 boundary traced and held, pure core (arbitration/state-machine)
mechanically correct, failure isolation verified end-to-end. **2 Major findings, both fixed**
(commit `c35d095`): (1) `pinMemory` trusted client-supplied `videoId`/`lineTextJp`/`timestampSeconds`
instead of deriving them from the `transcriptLineId` lookup the way `createMiningCard` already does —
a learner could assert a line said something it never said, violating §4.3 "the Journal records only
what truly happened." Fixed: `pinMemorySchema` now only accepts `transcriptLineId`+`note`; `pinMemory`
looks up `transcript_lines`→`transcripts` server-side for `video_id`/`timestamp`/`text`; the now-dead
`videoId` prop threading through `TranscriptPane`/`PinLineControl`/`shadowing-view.tsx`/
`dictation-view.tsx` was removed entirely. (2) Re-pinning an already-kept line reported plain success
while silently discarding the learner's new note (memories are immutable, no UPDATE grant) — the app
was lying about the learner's own keepsake. Fixed: a `23505` unique-conflict on insert now returns
`{ok:true, duplicate:true}`, surfaced in `PinLineControl` as its own `pin.alreadyKept` status/copy
(en+vi) instead of reusing `pin.success`, and `emitContext("memory_created")` is skipped on a duplicate
since no new memory actually exists. 10 Minor/Nit findings recorded, not fixed (all pre-existing-quality
or genuinely low-value — see the review transcript if resuming this exact thread; not re-summarized here
to avoid drift from the source).

**Scoped re-review of `c35d095` (the fix above): verdict APPROVE WITH NITS / safe to merge
YES-WITH-FIXES.** Confirmed both Majors genuinely closed in production code (line-by-line against the
`createMiningCard` precedent and the actual RLS policies) but flagged the fix itself was under-guarded
by tests — closed in commit `dcc1338`: `pinMemorySchema` is now `.strict()` (a stale client sending the
removed fields now gets a 400, not a silent strip) with a test asserting the parsed OUTPUT not just
`.success`; `pin-line-control.test.tsx` now asserts `emitContext("memory_created")` fires on a genuine
new pin and does NOT fire on a duplicate (via `CompanionContext.Provider`, mirroring
`shadowing-recorder-panel.test.tsx`'s pattern); a duplicate pin's HTTP status is `200` not `201`
(nothing was created); the `companion.test.ts` server-derivation test now uses an adversarial payload
(forged `videoId`/`lineTextJp`/`timestampSeconds`) and asserts the `transcripts` lookup is filtered by
the LINE's own `transcript_id`, not anything client-supplied. Re-verified after this round: tsc 0 ·
**1901/1901 tests** (net +1 from this round's new schema test) · lint 77/22 unchanged · build OK ·
e2e 6/6 (confirmed clean at reduced parallelism per the flake note above).

**Branch is DONE and gate-clean. Nothing further blocks merge — it is purely the user's call whether to
merge now or later.** If resuming cold: read this block, confirm `git log --oneline -5` still shows
`dcc1338` as HEAD (if the user merged since, this whole block is superseded — check `git log master` for
a Companion Presence merge commit first), then ask the user directly rather than re-deriving state.

<details><summary>(historical) Task 1–12 narrative — kept for detail, superseded by the Task 13 completion above</summary>

**🔷 OPEN DECISION RESOLVED (2026-07-29):** the `line_mastered` divergence from spec §4.3 flagged since
Task 4 is closed. User chose spec-alignment: `line_mastered` is a ONE-TIME milestone per transcript
line, not a repeatable recovery event; a future "relearning after regression" moment, if ever wanted,
should be a separate producer. Fixed in `lib/companion/mastery.ts` (commit `0223a3a`, controller-applied
directly — one-line, already fully scoped by an earlier task's review, no existing test contradicted
it): `qualifiesAsLineMastered` now also requires the line has never been at target before. New
regression test pins the exact carried scenario (`[90, 60]` then 85 → now correctly does NOT fire).
`lib/companion` + `lib/data/companion.test.ts` re-verified 118/8 green, tsc 0; no consumer test needed
changes. **NEXT ACTION is now purely Task 13 — nothing else blocks it.**
Spec `docs/superpowers/specs/2026-07-24-l9b-companion-presence-design.md` (D1–D9) ·
plan `docs/superpowers/plans/2026-07-24-l9b-companion-presence.md` (13 tasks) ·
**live run state + every carried item: `.superpowers/sdd/progress.md`** (gitignored scratch —
if lost, reconstruct from `git log`; the "Task 11: complete" block at its end is the resume point).
Executed via `superpowers:subagent-driven-development`, one implementer + one independent reviewer per
task, both on **Opus 5** (was Opus 4.8 — session default moved to Opus 5 2026-07-29, no change to the
plan's model policy otherwise; see `mem:model_selection_policy`).

**Done: Tasks 1–12 complete**, each task-reviewed clean (Task 3 had 1 Critical migration gap fixed
in-task; Tasks 4/5/7/11/12 each needed one fix round + scoped re-review for a single Important/behavioral
finding; Tasks 6, 8, 9, 10 clean with zero fix rounds — each had Minors parked instead). **Task 12**
(commits `4fa72fa`..`9e76fb5`) shipped the live Ambient-Layer anchors: dashboard (sitting), videos
empty-state (standing, `empty_library`), mining-deck empty-state (standing, `empty_mining_deck`), plus
`shadowing-recorder-panel.tsx` emitting `finished_shadowing` on session-save success (no anchor on the
shadowing route itself — the context waits, TTL-bounded, for the next anchored surface, per §5.4/§5.5).
Review: Approve-with-nits, 6 Minor; 1 fixed in-round (dashboard anchor was nested inside `{stats && …}`,
so a stats-fetch failure silently vanished the Companion from its landing surface — contradicting the
provider's own "a stats outage must not make the creature vanish" invariant; hoisted above the
conditional). 5 Minors parked to Task 13 (empty-state `items-start`/`items-center` inconsistency vs
mining deck; anchor `<button>` precedes actionable copy in DOM/tab order on both empty states; two
comments cite §5.5 instead of §5.4 for the loop-boundary rule; `anchor-boundary.test.ts`'s allowlist
still carries a stale `journal/page.tsx` entry — Task 10 put the anchor in `journal-view.tsx` instead;
no page-level render test for dashboard/videos pages, anchors verified only by tsc + the boundary scan).
Shipped since Task 8:
**Task 9** — shadowing `?line=<id>` deep link seeks + activates the line (`shadowing-view.tsx`); the
implementer caught a real bug the brief's own snippet would have shipped (`handleReady`'s early-return
would have made the deep link dead on every video with an already-reported duration — restructured,
behavior-preserving, test-pinned). **Task 10** — the `/journal` page, nav entry, first-meeting-on-open,
e2e smoke. Resolved the carried "doubled-auth-round-trip" design call (controller decision, confirmed
with the user): widened `recordFirstMeeting()` to accept an optional pre-resolved `{supabase, user}`
pair rather than folding capture into `getJournal()` — `getJournal()` already had a live consumer
(the journal API route) that must not gain an undirected side effect, while `recordFirstMeeting()` had
zero production callers yet, making it the cheap side to widen. Page now makes exactly **one** Supabase
auth round-trip per render. The implementer also caught a second real bug beyond the brief: an
unpinned `format.dateTime()` timezone would have hit next-intl's `ENVIRONMENT_FALLBACK` path — a
genuine server/client hydration mismatch — fixed with the repo's existing VN-timezone convention.
**Task 11** — gifted-pin UI (`pin-line-control.tsx`) in shadowing + dictation transcripts, POSTing to
the already-shipped `POST /api/companion/memories`. Review approved but flagged the brief's own
non-429→generic-network-error mapping as an Important, plan-mandated gap (a 401 from an expired
session was indistinguishable from a network failure); **user chose to fix rather than ship the
brief's copy as-is** — added a `pin.signedOut` catalog leaf (en+vi) + a swap-proof test proving the
new message appears and the generic one doesn't. Fix round 1/1 addressed, no new breakage. 5 Minors
parked (untested `emitContext` call; Save stays clickable + note doesn't clear post-success; dictation
pin could show after a scored attempt too, not just after `revealed`; N identically-labeled pin
buttons per pane, same shape as `MineLineControl`; report-quality nit).
Full suite **213 files / 1891 tests green** (post-Task-12) · tsc 0 · lint exit 0 at **77 warnings /
22 files, 0 new** · e2e 6/6 (not re-run since Task 10; Task 13 should) · **16 migrations**.
~~**NEXT ACTION: Task 13**~~ — DONE, see the top of this memory; this paragraph is a historical
snapshot from before Task 13 ran. **Carried item still open for Task 12**
(multi-anchor duplication — Task 10 mounted only one anchor on `/journal`, no conflict there; Task 12
must resolve it if it mounts a second simultaneously-visible `CompanionAnchor` — full detail in the
ledger, not repeated here). The `companion.ts ⇄ videos.ts` import-cycle trap (Task 5) remains a
standing risk for any future producer hooking a module `companion.ts` transitively imports.

**🔴 The review caught a CRITICAL plan gap already fixed — remember the lesson:** the plan had NO
migrations, but `companion_memories.memory_type` has a CHECK enumerating its 7 values and `first_meeting`
was not one. Since every Companion write is best-effort/never-throw, it would have failed SILENTLY
(23514) forever. Fixed = **migration #16** `20260724000016_companion_first_meeting.sql`.
**Migration count is now 16** (the "15 built" line below is stale). Any further enum/column/grant change
in this plan needs its own migration — the plan does not anticipate them.

(Historical gate snapshot as of Task 12, since superseded by Task 13's final numbers at the top of this
memory: unit 1891/213 · tsc 0 · lint 77/22 · e2e 6/6 not re-run since Task 10.)

~~**🔷 ONE OPEN DECISION FOR THE USER**~~ — RESOLVED 2026-07-29, see the top of this memory
("OPEN DECISION RESOLVED" above); this paragraph is the historical open-question snapshot.

</details>

<details><summary>(superseded) previous NEXT ACTION — L9a merge, 2026-07-24 morning</summary>

## ▶ (superseded) — **L9a fully DONE + MERGED.** Tree clean.
**✅✅ ALL OF L9a COMPLETE — Plan 3 MERGED to master `--no-ff` `d7b158c` (2026-07-24).** Branch
`layer-9a-string-extraction` merged then deleted (user chose local merge, branching policy). NOT pushed
(origin/master 78 commits behind — never push unasked; prune stale origin/layer-9a-* refs when a push happens).
All 21 namespaces extracted + fully translated to VN, adaptive-furigana/mining/etc. shell now runs
VN under `/vi` and EN under `/en`, and every page's `<title>` is localized via per-page `generateMetadata`
(Task 18). Task 19 closed the plan: string sweep clean (1 genuine miss fixed = admin nav aria), `common.player.*`
demoted to `shadowing.*` (by-surface audit), `common.errors.network`/`states.loading` kept. Pre-merge baseline
(tree identical to merge result, master had not diverged from fork-point e5893e9):
**tsc 0 · vitest 1731/1731 / 202 files · lint exit 0 (80-23 baseline, 0 new) · build OK (25 pages SSG per-locale)
· e2e 5/5** (needed `npx supabase db reset` to migrate+seed the local DB; not a code regression). Details in
`mem:l9a_localization_run_state` (Task 18 + Task 19 blocks).
**→ NEXT = L9b surfaces** (Companion Plans 2/3 + missing feature UIs + landing/cinematic + transcript-submit UI
+ GDPR delete-my-data + tutorial). Start with `superpowers:brainstorming` before plan mode. ⚠ Model policy
(`mem:model_selection_policy`): default Opus 4.8, but PAUSE + ASK before Fable for the L9b brainstorm,
plan-decomposition, or the hardest long-horizon builds (cinematic scroll orchestration, companion state machine).

</details>


</details>


---

## ▶ (superseded) NEXT ACTION (2026-07-20, before execution began)
**Style-guide manual pass = ✅ DONE (the debt Plan 2 left). Plan 3 = ✅ WRITTEN, NOT executed.**
Three commits on master: `66ea4b7` (Plan 3 doc), `b4b4fcb` (contrast fix), `300ee94` (style-guide
palette + enforcement). Gates: tsc 0 · **1305/1305 (175 files)** · lint 80 pre-existing warnings,
0 new · build ✓.
**→ NEXT: execute Plan 3** — `docs/superpowers/plans/2026-07-19-l9a-string-extraction-vietnamese.md`
(19 tasks), via `superpowers:subagent-driven-development`. Branch off master as
`layer-9a-string-extraction` per branching policy. **Task 1 first and non-negotiable**:
`test/render.tsx` must serve the real EN catalogs or every later task breaks its own tests.
**Full findings from the style-guide pass — READ `mem:l9a_localization_run_state` before touching
colour tokens.** Headlines: a NEW `--*-strong` text-tone tier now exists (brand `--primary`
deliberately UNCHANGED); 93 sites migrated `text-X` → `text-X-strong`; pitch-contour/waveform
deliberately excluded (their `text-primary` is a CANVAS colour, not text — do not "finish" that
migration); dark-theme elevation measured at 1.005:1 between levels = shadows convey nothing on
ink-950, deferred to L9c as a design fix.
NOTE: remote still has STALE refs `origin/layer-9a-design-system` AND
`origin/layer-9a-localization-architecture` — prune both when pushing (never push unasked).
Local dev: `admin@almostgone.vn` / `styleguide-local-dev-2026` now exists as the bootstrap admin;
creating it signed the user's own `shamt2004@gmail.com` dev session out (just log back in).
CRITICAL gotcha (unchanged, load-bearing): `lib/utils.ts` cn() = `extendTailwindMerge` configured
with every custom token scale — plain twMerge silently STRIPS text-body/text-caption; any new
Tailwind scale must be added there too (`lib/utils.test.ts` guards, now also covering the
`-strong` tones from the opposite direction).
Sau L9a xong cả 3 plan → L9b surfaces (Companion Plans 2/3 + feature UIs + landing + transcript-
submit UI + GDPR delete) → L8 PayOS → L9c polish/perf.


---

## Progress — layer-by-layer build log L1–L7 (moved here 2026-08-07)

- **Layer 1 (Foundation): DONE, merged.** Next 14 migration, full spec §4 schema (RLS on all),
  Supabase auth (email+Google) + middleware, design system + reduce-motion, layout shell, motion.
- **Layer 2 (Static content): DONE, APPROVED, merged.** SM-2 SRS engine (`lib/srs`, 9 tests) +
  due-queue (`getReviewQueue` in `lib/data/srs.ts`); review API `POST /api/srs/review`; content
  APIs `GET /api/{kanji,kanji/[id],vocab,grammar}`; original content migrations (45 kanji/88
  readings/60 vocab/10 grammar) + `interval_days` col + `grants.sql` (table GRANTs to
  authenticated/service_role — RLS still row gate); pages `/kanji`(+detail)/`/vocab`/`/grammar`
  + flashcard review UI; kanji stroke-order animation (5 hand-authored glyphs + fallback).
- **Layer 3 (Video/Shadowing): DONE, APPROVED, merged.** Foundation libs: `lib/youtube`
  (URL parse + keyless oEmbed — NO Data API key, NO download), `lib/transcript` (SRT/VTT/plain
  parse + XSS sanitize), `lib/japanese` (kuromoji `0.1.2` tokenizer + furigana, server-only,
  dict at `node_modules/kuromoji/dict`), `lib/dictation` (LCS diff score), `lib/pitch` (client
  F0/YIN extraction + contour — user audio only), `lib/difficulty` (i+1 % known-words scorer),
  `lib/rate-limit` (in-memory, per-instance). APIs: `/api/videos/{import,[id],[id]/transcript,
  [id]/progress,[id]/difficulty}`, `/api/dictation/attempt`, `/api/shadowing/session`,
  `/api/mining{,/review,/queue}` (all zod-validated, rate-limited on writes). Migrations 7–9:
  private `recordings` bucket (owner-path RLS), `sentence_mining_cards` (+SM-2 cols, owner RLS),
  video/transcript write policies (owner-only, column-scoped `duration_seconds` grant).
  UI: `/videos` (import+list), `/videos/[id]/shadowing` (IFrame sync, A–B loop, speed, adaptive
  furigana 3-state, tap-to-mine), `/videos/[id]/dictation`, `/mining` (deck+SM-2 review).
- **Layer 4 (AI features): DONE, APPROVED, merged (`63b965f`).**
  - `lib/ai`: Claude wrapper on official SDK — model `claude-opus-4-8` (single source
    `lib/ai/constants.ts`), `messages.parse` + `output_config.format` + `zodOutputFormat`, NO
    temperature/top_p (Opus rejects), typed SDK error mapping (`lib/ai/errors.ts`), stable
    system prompts first for prompt caching. Chatbot (scenario roleplay + corrections),
    video summaries, example-sentence generation.
  - `lib/speech-scoring`: Azure Speech pronunciation assessment (JA), STT, TTS — every entry
    point degrades to a clean 503 "not configured" result when keys are absent. (Keys WERE
    absent during L4; Azure was configured at L5 start, 2026-07-13 — features now live.)
  - `lib/audio`: pure PCM/WAV encode (`pcm-encode.ts`) + decode (`wav-decode.ts`),
    `blobToWav16kMono` (`blob-to-wav.ts`), shared `read-blob.ts`. **Azure short-audio uploads
    must be WAV/PCM or OGG/Opus — recorder webm/opus is converted client-side before every
    Azure-bound upload (STT + both pronunciation call sites); stored recordings stay webm.**
  - `lib/pitch`: `scorePitchAccent` (`score.ts`, deterministic, register-shift + offset
    invariant, 0–100 + overlay points + lowConfidence), `contourFromSamples` (`pipeline.ts`),
    `reference.ts` (TTS of line TEXT → `riff-16khz-16bit-mono-pcm` → contour, cached per
    sentence; 503 cached forever, transient failures retried).
  - Pitch overlay (差別化 #1): `components/video-player/pitch-contour-overlay.tsx` (SVG,
    reference dashed + user line with `.stroke-draw` reveal → reduced-motion-safe via
    globals.css kill switch) + `pitch-comparison.ts`. Recorder panel attaches `pitch_score`
    to the session POST (only accepted at creation — no PATCH) racing a 3s budget
    (`pitchScoreUploadBudgetMs` prop) so saving never blocks on TTS.
  - APIs: `/api/conversation/{session,session/[id],session/[id]/end,message}`,
    `/api/pronunciation/score`, `/api/speech/{stt,tts}`, `/api/videos/[id]/summary`,
    `/api/vocab/[id]/examples` — all zod-validated + rate-limited; writes to shared content
    (video_summaries, vocab_examples) go through `lib/supabase/service.ts` (service-role,
    server-only).
  - Migration 10: `video_summaries` (RLS, SELECT-only policy for authenticated + explicit
    revoke of write grants), `vocab_examples.source` ('curated'|'ai_generated' — AI content
    labeling), conversation-table grants audit.
  - UI: `/conversation` (scenario picker, chat, voice mode, corrections, history),
    video summary panel, vocab example generation panel (`/vocab/[id]`), pronunciation score
    display in recorder panel.
  - Test harness additions in `test/`: `claude-mock`, `azure-speech-mock`, `audio-context-mock`,
    `blob-utils` (`readBlobBytes` — jsdom Blob lacks `arrayBuffer()`), fixtures.
- **Layer 5 (JLPT + Reading): DONE, APPROVED, merged (`74514cd`, 2026-07-13).**
  - Migration 11: `reading_passages`/`reading_questions`/`user_reading_attempts` + JLPT hardening —
    `jlpt_questions.correct_answer`+`explanation` UNREADABLE by authenticated (revoke SELECT then
    column-scoped grant; CRITICAL: migration-6 default-privileges blanket-grants new tables, so
    revoke-first or the column grant is a silent no-op); `user_test_attempts` += started_at/answers/
    mode('full'|'section')/section. Migration 12: original content — 2 tests (N5+N4, 34 câu each,
    12v/10g/6r/6l), 7 passages (4 N5 + 3 N4) + 21 questions; listening = `audio_text` in
    question_data, played via `/api/speech/tts` (NO audio files); answers round-robined 0–3.
  - `lib/jlpt`: deterministic scoring — pillar structure (N5/N4 combined LK+Reading 0-120 min 38 +
    Listening 0-60 min 19; N3–N1 three pillars 0-60 min 19), pass thresholds N5 80/N4 90/N3 95/
    N2 90/N1 100 (official), scaled = linear approx (labeled estimate), `passed: boolean|null`
    (null = insufficient data or section mode), `weaknessStats` by question_type weakest-first.
  - APIs: `/api/jlpt/tests{,/[id],/[id]/submit}`, `/api/jlpt/attempts`, `/api/reading{,/[id],
    /[id]/submit}` — GET strips answers (column grant = backstop, `select *` would fail); submit
    fetches answers via service-role, scores server-side, reveals correctAnswer+explanation only
    post-submit; rate-limit 20/60s on submits. Logic lives in `lib/data/jlpt.ts`/`reading.ts`
    (routes are thin, untested per repo convention; `test/supabase-mock.ts` = new reusable mock).
    Score column: full mode → scaledTotal (nullable), section mode → totalPercent. `started_at`
    client-supplied — timer is a study aid, NOT authoritative (commented in code).
  - Reading furigana: lazy generate-on-first-read (kuromoji `toFurigana`) cached into
    `furigana_json` via service client; failure → null, UI falls back to sentence-level lookup.
  - UI: `/jlpt` (list + attempts history), `/jlpt/[id]` (pre-start → timed runner w/ navigator,
    1–4 shortcuts, aria-live timer warnings, TTS listening + 503 degrade → results w/ pillar bars +
    weakness links), `/reading` + `/reading/[id]` (furigana toggle, tap-to-lookup popover,
    translation disclosure, quiz). ENGLISH shell (convention: shell EN, DB content VN). Old
    `/jlpt-test` placeholder → redirect `/jlpt`; middleware protects `/jlpt` + `/reading`.
  - code-reviewer: approve-with-nits, both fixed pre-merge (Reading shell VN→EN; timer comment).
- **Layer 6 (Gamification + Notifications): DONE, APPROVED, merged (`3fe741b`, 2026-07-14).**
  - **Principles G1–G3 formalized** in `business-model.md` §1.1 (decision filter, same rank as the 6):
    G1 XP = completed learning outcomes not app activity; G2 self-improvement before social
    comparison (→ leaderboard deferred to L7 as a PRODUCT decision); G3 notifications support
    learning not attention (no FOMO copy anywhere).
  - Migration 13: `xp_events` ledger (unique `(user_id, source_type, source_id)` = idempotency;
    source_id = natural-unit-per-VN-day, e.g. `{lineId}:{yyyy-MM-dd}`; conversation = sessionId only),
    `notifications` (type check badge_earned/level_up/srs_due; UPDATE grant column-scoped to
    `read_at`), +8 badges (11 total), belt-and-suspenders revokes on user_badges AND user_stats
    (the latter = review nit #1, fixed pre-merge). All writes service-role only.
  - `lib/gamification` (pure, clock-injected): XP table (srs_review 5, mining 5, dictation 10,
    shadowing 15, reading 20, conversation 25, jlpt section 30/full 50), triangular level curve
    (threshold L = 100·L·(L−1)/2), streak in fixed UTC+7 (VN no DST since 1975 — hardcoded shift,
    commented), badge evaluator zod-parses criteria jsonb and SKIPS malformed (forward-compat).
  - `lib/data/gamification.ts` `recordActivity()`: service-role award pipeline — NEVER throws into
    callers (best-effort), duplicate outcome = 0 XP but streak still advances, badge-snapshot
    aggregate skipped on duplicate+unchanged-streak, "learned kanji" reuses MASTERY_THRESHOLD
    (srs_stage>=2) from lib/data/difficulty.ts. Wired into all 7 lib/data write success paths.
  - `lib/notifications`: emit/deliver split (deliberately minimal — emitNotification → deliverer
    list, today only in-app insert; push/email later = new deliverer, zero business-logic change).
    NO srs_due producer wired yet (UI computes due count live; producer comes with push/email).
  - APIs: GET /api/user/stats (stats+level+badge catalog+srsDueCount), GET+PATCH /api/notifications
    (limit≤50; mark-read ids|all, rate-limited 30/60s), GET /api/videos/recommendations (i+1:
    known-vocab fetched ONCE, SCAN_LIMIT=100 approved videos, completed excluded, ideal→too-easy→
    too-hard, insufficient-data dropped).
  - UI: dashboard rebuild (level/streak/SRS-due/badges/recommendation rail), notification bell+
    panel in app-nav (optimistic mark-read w/ rollback, 429-aware, focus-return Esc/outside-click),
    profile stats, rail also on /videos. Client-safe type mirrors in lib/*-types.ts (repo
    convention). Motion: 4 pure-CSS one-shot keyframes + useUnreadIncreasePulse hook (no pulse on
    mount, only on live increase); all covered by existing reduced-motion kill-switch.
  - code-reviewer: approve-with-nits; nit #1 (user_stats revoke) fixed pre-merge; #2 (mark-read
    maps DB errors to 400 not 500) + #3 (recommendations tokenizes ≤100 transcripts/request,
    no cache — fine behind Suspense) left as noted follow-ups.
- **Layer 7 (Community + Admin CMS): DONE, APPROVED, merged (`01ae59d`, 2026-07-14).**
  - Migration 14: `users.is_admin` (client CANNOT write — users UPDATE grant re-scoped to exactly
    9 self-editable columns incl. new `leaderboard_opt_in`; email/created_at remain client-writable
    = pre-existing carryover, flagged for hardening) · forum `topic` (check: general/grammar/vocab/
    listening/speaking/jlpt/study-tips) + `updated_at` trigger · `user_playlists.is_public` +
    `description` + public-read policies · `peer_review_shares` (unique session_id = one explicit
    revocable consent per recording; owner INSERT/DELETE, no UPDATE anywhere) + `peer_reviews`
    (unique (share_id, reviewer_id), RLS backstop blocks self-review) · `idx_xp_events_created_at`.
  - Community backend: `lib/data/{forum,playlists,peer-review,leaderboard}.ts` + thin routes.
    Peer-review audio = the ONLY cross-user recording read path: verify share row exists → mint
    5-min service-role signed URL, rate-limited; storage policies untouched. Leaderboard = weekly
    (Monday 00:00 UTC+7, `lib/leaderboard/week.ts` clock-injected), service-role aggregation of
    xp_events, opt-in rows only, top 20, NO userId in payload (consent = name/avatar/weeklyXp only),
    callerWeeklyXp always returned. G1 enforced: zero recordActivity in community code.
  - Admin backend: `lib/admin/guard.ts` — `requireAdmin()` (401/403; DB `is_admin` = source of
    truth; `ADMIN_EMAILS` env = bootstrap-only self-heal promotion, fires ONLY inside requireAdmin)
    + side-effect-free `isAdmin()`. Video approve/reject/transcript-attach via service role
    (reject = HARD DELETE — no 'rejected' enum value; reason not persisted). Generic content CRUD
    `lib/data/admin-content.ts` (per-type config: kanji/vocab/grammar/jlpt_tests/reading_passages)
    + dependency-free CSV parser `lib/csv/parse.ts` + per-row-error import. `admin-stats.ts` w/
    labeled retention methodology, NO revenue (L8).
  - UI: `/community` (forum board/thread/composer), `/community/peer-review` (queue/mine tabs,
    on-demand signed-URL <audio>, share+revoke in shadowing recorder w/ consent copy), `/playlists`
    (own + public browse + save-to-playlist popover on videos), `/leaderboard` (**own week FIRST,
    then opt-in community ranking — user-mandated G2 UX order**), `app/(admin)/admin/**` (separate
    AdminShell; layout gates via `requireAdmin()` — NOT `isAdmin()`, so the ADMIN_EMAILS bootstrap
    completes on a plain /admin visit; this was review finding #1, fixed pre-merge). Middleware:
    +/admin (auth-only, admin check in layout), +/playlists, +/leaderboard.
  - code-reviewer: approve-with-nits; #1 (bootstrap reachability) + #2 (leaderboard userId leak)
    fixed pre-merge; #3 (admin dialog focus trap) + #4 (stroke_order_svg raw SVG, admin-trust) +
    #5 (users.email/created_at client-writable) = follow-ups below.
  - **L6 flaky test RESOLVED**: it was `components/video-player/pitch-contour.test.tsx` — waitFor
    1s default timeout under full-suite CPU contention; bumped to 5s.
- **Spec A (AI provider abstraction): DONE, APPROVED, merged (`201a9b4`, 2026-07-16).** 26 commits,
  15 TDD tasks, 1098 → **1166 tests**. Design + D1–D9 decisions live in the version-controlled spec
  `docs/superpowers/specs/2026-07-15-ai-provider-abstraction-design.md` (§3 known limits, §4 decisions);
  plan `docs/superpowers/plans/2026-07-15-ai-provider-abstraction.md`. (The separate
  `design_checkpoint_ai_provider_abstraction_2026-07-15` memory was pruned 2026-07-16 — merged work,
  its content folded here.) **Binding L8 constraint** (user, spec §2): abstraction must NOT narrow the
  product — deferring/disabling when `none` is fine, redesigning the AI API around Gemini-Free is NOT;
  `REQUIRED_CAPABILITIES` deliberately demands `promptCaching`+`reasoning` the only runnable provider
  (Gemini) reports false — that is correct, not a gap. Principle: **"Explicit config. Fail fast. Never
  infer. Never silently fall back."** **Hardest-won lesson (saved 6 times):** *when reality contradicts
  what a plan/spec/review says, the INSTRUCTION is wrong, not reality — verify, report, don't force.*
  (e.g. real `GEMINI_API_KEY` is 53-char `AQ.`-prefixed not `AIza`; `AZURE_SPEECH_KEY` 84 alphanumeric
  not 32-hex — both would have false-crashed boot if the rule had been written from memory.) Two
  load-bearing constructs a review twice wrongly called "redundant" (`EnvSource` union; the `?.` in
  `lib/ai/env.ts`) — do NOT "clean" them, removing them breaks typecheck.
  - `lib/ai` speaks a **provider-agnostic port** (`lib/ai/port.ts`, 2 operations); adapters live in
    `lib/ai/providers/` (`anthropic.ts`, `gemini.ts`, `fake.ts`). `client.ts` + `run.ts` deleted;
    `toAiError` moved into the Anthropic adapter. `AiErrorKind` + `lib/http-status.ts` UNCHANGED (D1).
  - **Provider selection is explicit, never inferred**: `AI_PROVIDER` (`none`|`anthropic`|`gemini`) +
    `SPEECH_PROVIDER` (`none`|`azure`) + `APP_ENV` (`dev`|`production`) are all REQUIRED. `none` =
    intentionally off → keeps the L4/L5 503 path byte-for-byte. Unset/invalid = **startup crash**.
    `APP_ENV=production` + `gemini` = crash (free tier trains on data — CLAUDE.md §2).
  - `instrumentation.ts` + `lib/env/validate.ts` validate ALL registered specs once at boot and report
    ONE aggregated error (the 2026-07-14 audit found two bugs at once — stopping at the first hides
    the second). `lib/env.ts` → `lib/env/index.ts` (`@/lib/env` still resolves).
  - `GET /api/admin/health` = on-demand liveness (D2: boot NEVER depends on a third party's uptime).
  - `.eslintrc.json` forbids provider-SDK imports outside `lib/ai/providers/` — verified the rule
    actually fires, not just that it exists.
  - **Env keys now (supersedes the audit rows below)**: `GEMINI_API_KEY` **VALID** (live 200; real
    shape is 53-char `AQ.`-prefixed, NOT `AIza`). `AZURE_SPEECH_KEY` **VALID** (user's fix worked;
    real shape 84 alphanumeric, NOT 32-hex). `ANTHROPIC_API_KEY` still absent → prod = `AI_PROVIDER=none`.
  - **LAUNCH CONFIG BOOT-VERIFIED**: `APP_ENV=production AI_PROVIDER=none SPEECH_PROVIDER=none` →
    Ready in 524ms, `GET /` → 200. almostgone.vn is deployable today with all AI intentionally off.
  - **KNOWN LIMIT, accepted (spec §3), deferred to scope D**: "fails at boot" is TRUE for `next dev`
    (crashes before the port opens) and **FALSE for `next start`** — it opens the port, prints Ready,
    then serves a permanent HTTP 500 per request WITHOUT exiting. So a crash-restart supervisor never
    sees a failure; only an HTTP health check would. Decide `process.exit(1)` when the almostgone.vn
    supervisor is set up.
  - **Deferred to a follow-up (final review finding, recorded)**: `gemini.test.ts` module-mocks the
    whole SDK, so `toContents`' `role: "ai"→"model"` translation has NO assertion — emit the wrong
    role and every test still passes while the live API 400s. V1 verified `@google/genai` routes
    through global `fetch`, so a fetch-level `test/gemini-mock.ts` mirroring `test/claude-mock.ts`
    IS possible. Gemini is dev-only, so this is low-risk but real.
  - PayOS env: renamed to `PAYOS_CLIENT_ID`/`PAYOS_API_KEY`/`PAYOS_CHECKSUM_KEY` and committed to
    `.env.local.example` (2026-07-16, `c3bd686`) — this open item is now CLOSED. Actual PayOS wiring = L8.
- **L6 flake NOT actually resolved** (project_status previously claimed it was): 
  `components/video-player/pitch-contour.test.tsx` failed once again during the Spec A merge
  verification, then passed in isolation AND on a full-suite re-run. The 5s `waitFor` bump reduced
  but did not eliminate it — it is CPU-contention-sensitive under the full suite. Re-run before
  believing it.
- **Session 2026-07-16 — doc reconciliation + Layer 9 (Companion) DESIGNED & PLANNED (not built).**
  - **Doc fixes committed (`c3bd686`)**: CLAUDE.md §3 CRA→Next reality; workflow.md/backend-engineer
    Stripe→PayOS; `.env.local.example` env renamed to `PAYOS_CLIENT_ID/PAYOS_API_KEY/PAYOS_CHECKSUM_KEY`
    (the old bare `CLIENT_ID/…` open item is now CLOSED); spec §4 dropped `stripe_customer_id`; README
    rewritten from CRA boilerplate. Spec now version-controlled at repo root.
  - **L8/L9 RE-SCOPE (user decision)**: **L8 = PayOS billing ONLY.** "site-wide animation polish +
    performance audit" and ALL new UI/UX MOVED OUT of L8 into a **new Layer 9**. Reason: the app is
    functional but the UI is bare frames — landing/cinematic never built, F-002/004/006/010 UI orphaned,
    12 of 16 F-00x features UI-less, shell still English. Polishing/auditing a UI that doesn't exist = wasted.
  - **L9 split into 3 sequential specs (user-approved)**: **L9a** = foundation (i18n + design system) —
    **NOT BUILT, and it is the prerequisite for L9b/L9c**; **L9b** = surfaces (landing, feature UIs,
    tutorial) incl. the Companion; **L9c** = polish + perf audit (audit runs on the FINAL UI).
  - **Companion System spec = DONE** (`docs/superpowers/specs/2026-07-16-companion-system-design.md`,
    commits `24bbf1c`→`2773e8a`→`3d5a8c4`→`cd828dd`→`8ba42c1`→`10dae79`→`3eb0037`). The mascot as a
    product mechanism, NOT decoration. Spec 1 of 2 = **mechanism**; Spec 2 (Character Identity: name,
    lore, look) deliberately deferred so art never blocks engineering. Locks: North Star axiom (P0:
    exists only to make the journey meaningful, never engagement) + P1–P12 + supporting principles;
    two tracks — growth (`relationship_phase = f(xp)`, 4 phases, monotonic, hidden thresholds) vs memory
    (`companion_memories`: discovered vs gifted, NO media §2, immutable, owner-only); capture gate
    (idempotent, best-effort, hooks `recordActivity`); Ambient Layer + per-surface anchors + context bus
    + state machine + arbitration/cooldown + 4-verb Companion API; Free/Premium AI boundary (AI reads
    Journal never writes it; canon hierarchy; silent degradation with AI off = launch state; model
    independence); placeholder-first + Character Swap Invariant (replace all of Spec 2 → zero data/logic
    migration). Companion exists even with `AI_PROVIDER=none`.
  - **Companion Core (Plan 1 of 3) = BUILT, MERGED** (`--no-ff` merge `9f09cf2` → master, 2026-07-16;
    subagent-driven-development, 8 commits `d66c0c1`→`4183f73`). The data+logic core, deliberately
    INDEPENDENT of the unbuilt L9a and of AI. Ships: **migration #15** `20260716000015_companion_memories`
    (immutable via `revoke update from authenticated` — the migration-6 default-privileges gotcha bites,
    plain grant is additive; owner-only RLS + gifted-only INSERT; no-media, pointers + line text only);
    `lib/companion/*` (pure `relationshipPhaseForXp` w/ hidden `PHASE_THRESHOLDS=[0,500,2500,10000]` +
    fast-check monotonicity property; `dedupeKeyFor`/`titleFor` non-AI VN template titles; types + barrel);
    `lib/data/companion.ts` (`recordDiscoveredMemory` insert-or-ignore, `listJournal`/`getAnchorMemories`
    ordered by `occurred_at`, the `captureCompanionMemories` gate, `pinMemory`/`getJournal`); gate wired
    best-effort into `recordActivityInner` (service-role client, never throws — double-guarded); Zod
    `pinMemorySchema` + `POST /api/companion/memories` (gifted pin, user-client/RLS, 400 on bad line
    mirroring `createMiningCard`) + `GET /api/companion/journal`. Full suite **1190/1190**, tsc/lint/build 0.
  - **Producers wired now:** `companion_grew` (anchor, on hidden phase-threshold crossing), `mining_saved`
    (on mining_review), `jlpt_passed` (anchor, **gated on an actual pass** — `passed` threaded
    RecordActivityInput→gate→jlpt.ts as `result.passed===true`; a FAILED/insufficient JLPT records NOTHING).
    This gating was a **final-review catch** (`fix` commit `4183f73`): the plan's verbatim code fired
    jlpt_passed on every submit incl. fails = a failed-N4→"N4 milestone" anchor = North-Star violation;
    user chose fix-in-branch. **`first_shadow` DEFERRED to Plan 2** (fires only on first line to REACH
    TARGET SCORE — the score isn't available at recording-upload time; `resolveLinePointer` removed with it).
  - **Deferred to Plan 2/3:** `first_shadow` + `line_mastered` + `first_video_completed` producers (need
    score/completion reads); Ambient Layer, anchors surfacing, context bus, state machine, arbitration,
    Companion API, placeholder sprite, Journal UI (Plan 2, needs L9a); adaptive voice + AI reflection +
    move template titles into i18n (Plan 3). Minor cleanups carried: dedupe.ts switch `never`-guard,
    phase.ts redundant `!`, dead `@/lib/supabase/service` mock in companion.test, pinMemory 400/401/429
    unit coverage (repo-wide gap — no harness for `createClient()`/`requireUser()`-style fns), and the
    `companion_grew` title says "giai đoạn 2" (a raw phase index / "stage" — P12 forbids; fix in i18n Plan 3).
- **Layer 8: NOT STARTED.** Now scoped to **Billing (PayOS) ONLY** (polish + perf audit moved to L9c
  above). Per `business-model.md`: single tier 49k/490k + Founding 39k, no trial, Contextual Discovery,
  Knowledge-Gen quotas + global kill-switch FIRST. Lead: backend (+ tech-lead). Start: `git checkout
  master`, branch `layer-8-<slug>`. **Spec A's port is the billing/AI-metering foundation**: model
  tiering, the Knowledge Economy cache and the kill-switch all plug into `lib/ai/port.ts`. **SEQUENCING
  (user decision 2026-07-16): L8 is DEFERRED to near the end — after L9a/L9b — right before publish. Do
  NOT start L8 next; NEXT ACTION is L9a. See the ⭐ ROADMAP SEQUENCING block at the top.** Independence
  still holds technically (L8 core only needs Spec A's port), but its conversion mechanism wants L9b
  surfaces and cost-defense isn't urgent while AI is off in prod.

- **Business model / monetization = DECIDED** → `docs/product/business-model.md` (product manifesto +
  operational model; commits `3fb3232`→`14aafba`). Layer 8 reference; supersedes spec §3.12 Stripe/trial.
  Canonical detail in Serena `monetization_brainstorm`. Key: VN/PayOS/free-first · value-based Free/Premium
  (computed-from-your-data = free, AI-authored-over-it = premium) · Knowledge Economy (sentence+word-level
  cache, quota on generating not reading) · single tier 49k/490k, Founding 39k locked, no lifetime ·
  Contextual Discovery (no trial) · KPI = Knowledge Reuse Ratio.
- **docs/features registry reconciled with real build state** (it was authored post-L4). `README.md` now
  marks **F-002 / F-004 / F-006 / F-010 = 🟨 Partial** (foundations shipped L3/L4: `lib/difficulty` +
  `/api/videos/[id]/difficulty`; `shadowing_sessions`+pitch; `/mining`+`vocab_examples`; known-words+
  adaptive-furigana). Every feature's Free/Premium home is mapped in `business-model.md` **§2.1**. When
  building F-010, keep §2 "mining stores NO media" (thumbnail = YouTube URL reference, don't store images).

