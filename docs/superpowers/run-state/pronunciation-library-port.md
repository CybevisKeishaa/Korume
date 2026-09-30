# Branch Run State

## Goal and scope

Port `/pronunciation` — registry `pronunciation-library`, Figma `37:4955`, nav
`practice`/2 — from its `UpcomingScreen` placeholder to the real screen. Only
the frame's right-hand child `37:5331 PronunciationLibraryContent` (1054 of its
1278 px) is in scope; `37:4962 Sidebar` is NOT, because the screen-port
workflow ruled the Figma sidebar is ported ONCE into `AppNav`, never per screen.

⚠️ **Out of scope, deliberately:** the recording studio. This is the LIBRARY
(the frame's own name), a discovery hub. `/api/pronunciation/score`,
`lib/speech-scoring/**` and `lib/pitch/**` already exist and are consumed by
`components/video-player/shadowing-recorder-panel.tsx`; this branch routes TO
that machinery and does not rebuild it.

## Authorities

- **Figma is the frame**: build what the frame shows, backend included. Only a
  Figma-vs-repo CONTRADICTION goes to the owner. Five found, four ruled on.
- `mem:screen_port_workflow_inputs` — the four screen types and the five-step
  checklist. This screen is **type "App page"** (`chrome: "app"`).
- `AGENTS.md` §2 (non-negotiables, incl. WCAG 1.4.10 at 320 CSS px), §6 (one
  fact one home), §7 (mutation-check), §9 (DoD).
- `docs/lessons.md` L-002 (enumerate, never quote a count), L-004 (vacuous
  guards), L-009 (never wave a flake through).

## Accepted commits

`672d507` the contract · `898da5a` the rulings · `fc74c78` the parked Task 1
design · Task 1 `675494f` · Task 2 `f6347c1` · Task 3 `8999492` · Task 3b
(the commit after it).

## Contracts and decisions

**The screen contract** (checklist step A), settled before any code: route
`/[locale]/(protected)/(app)/pronunciation` (exists, placeholder) · App page,
so `AppNav` belongs to the layout · nav `practice`/2, unchanged by this branch ·
data is the shipped taxonomy (`collections`, `lesson_situations`,
`lesson_sources`, `videos`, `user_video_progress`, `shadowing_sessions`) ·
interactions are the search/filter row, shelf "View all", card → lesson.

⭐ **Reuse is the whole plan.** `/shadowing` (frame `149:2`) is the SAME
structural pattern: eyebrow + h1 + subtitle, search row, featured hero with
badge/chips/progress/two buttons, shelves with "View all", multi-card right
rail. So `components/shadowing/hub-*` supplies the family (`hub-featured-hero`,
`hub-shelves`, `hub-section-heading`, `hub-lesson-card`,
`hub-discovery-controls`, `hub-empty-state`). **A second parallel family for
the same shapes is what this branch must NOT produce** — where a hub component
needs a variant it gets a prop, not a fork.

⚠️ **Owner rulings, 2026-09-25.** Deviations from the frame, all deliberate:

1. **A learning path is an ORDERED collection, not a new entity.** The frame
   shows `80 / 120 lessons`, `67% complete`, `8 hours`. `collections` has no
   ordering and no rollup. Add ordering to `lesson_collections` and roll
   progress up from `user_video_progress` — do NOT add a `courses` table that
   would duplicate a seeded `collections`. ⚠️ `20260731000019` warns that
   `featured` is a collections ROW (`slug = 'featured'`), not a boolean; the
   hero reads that row and invents no flag.

2. **Weekly Improvement renders only metrics backed by a persisted
   measurement.** Accuracy → `pronunciation_score`, Pitch Accent →
   `pitch_score`, Rhythm → `rhythm_score` (all on `shadowing_sessions`).
   **Confidence has no measurement and is omitted entirely** — not kept as an
   empty row for the frame's sake. **No value or delta may be fabricated.**

   🚨 **This replaces an earlier ruling that said "Accuracy and Pitch Accent
   only, nothing measures rhythm". That premise was FALSE.** Azure's
   `FluencyScore` maps to `rhythm_score` (`lib/speech-scoring/types.ts:26`) and
   `lib/data/pronunciation.ts:97-100` writes it. The wrong claim came from
   seeing no `components/pronunciation/` directory and inferring no capability.
   **"No component" is not evidence of "no capability"** — grep the persisted
   FIELD. It cost a product ruling that had to be reversed.

3. **The deltas are IMPROVEMENT deltas, not scores.** `+8%` is not a 92 wearing
   a plus sign. Task 5 computes across a real window — this week against last —
   and shows a neutral `—` / "Not enough data" when either period is empty.
   **A fabricated `+0%` is not a stand-in for an unknown.**

4. **One lesson pool, two hubs, no duplicated records.** `/pronunciation` is
   the speaking/pronunciation discovery + progress hub; `/shadowing` is the hub
   for shadowing practice. Pronunciation re-surfaces `Shadowing Collections` as
   one of its shelves — the frame puts that shelf inside Pronunciation Studio
   alongside Situation, Goal, JLPT and Learning Paths — re-shelving the SAME
   records, never copying them.

5. **JLPT Speaking is an aggregation VIEW, not an entity — no table, no
   migration.** `shadowing_sessions` carries `user_id`, `video_id` and
   `created_at`; joining `video_id → videos.jlpt_level_estimate` and grouping
   N5–N1 gives the count, completion and average the frame shows. The same join
   feeds Today's Speaking and Recently Practiced.

6. **AI Sensei Recommendation ships on the real engine**, not as an omission:
   `lib/data/recommendations.ts` is the i+1 scorer, ranking candidates by the
   fraction of content words the caller knows through SRS mastery into
   `ideal` / `too-easy` / `too-hard` bands. Task 5 ports the card against it.

⚠️ **Owner rulings, 2026-09-28** — and a standing one: **build the complete,
well-made version; do not trim toward minimal.** An omitted control or a
filter standing in for a curated program is not an acceptable outcome.

7. **Practice by Goal = ordered collections with a role, no new table.** Add
   `collections.kind` (`shelf` | `path` | `goal`, default `shelf`) and
   `collections.skill_focus` (goal only; maps to a persisted score:
   `pitch` → `pitch_score`, `rhythm`/fluency → `rhythm_score`, `accuracy` →
   `pronunciation_score`). Learning Paths (3b) use `kind = 'path'` too. Seed
   the three frame goals. Duration is DERIVED from member video durations,
   never stored; `Start` opens the first uncompleted lesson in `position`
   order; the card shows the goal's progress rollup. A **"Recommended for
   you"** badge marks the goal whose `skill_focus` is the learner's weakest
   metric this week — no badge when there is no history.
8. **Sliders = "Sort & display" panel** (the funnel keeps *what* to filter).
   Sort: Recommended (the i+1 engine) / Newest / Shortest / In progress;
   duration band (<10 / 10–30 / >30 min); hide completed. State lives in the
   URL (shareable, Back works) **and** persists to the user's profile so the
   next visit restores it — a migration + validated PATCH, URL wins when set.
9. **Search placeholder** becomes honest copy — "Search by lesson title"
   (EN/VI) — rather than widening search.

Earlier rulings, 2026-09-27: the hero features a **course = a `kind = 'path'`
collection chosen by derivation** (recent activity → in progress → first), and
"Preview Course" opens `/pronunciation/collections/[slug]` (repo-only; no frame).
Claude, 2026-09-29: `user_video_progress.last_watched_at` (nullable, trigger-
stamped, no backfill) orders "Continue where you left off", nulls last.
10. (owner, 2026-09-29) **The card's ✦ SAVES a path** (`user_saved_collections`,
    RLS: own rows, `kind = 'path'` only, no UPDATE; in the GDPR export). Saved
    paths feed the hero's choice (order: ruling 13).
13. (owner, 2026-09-29) **A saved path outranks recent activity**: featured =
    saved → activity → in progress → first.
11. (owner, 2026-09-29) **Practice by Situation shows the REPO taxonomy**, not
    the frame's eight; only situations tagging a visible lesson; no "View all".
12. (owner, 2026-09-29) **Shadowing Collections = the explore `kind='shelf'`
    collections** (`SHADOWING_COLLECTION_SLUGS`), not `lesson_sources`; card →
    `/pronunciation/collections/[slug]`, "View all" → `/shadowing/explore`.

## Verification

Measured in this worktree, never in the main checkout.

**Task 4a+4b gate, 2026-09-29** (Codex review + 2 Claude review passes): vitest
383 / 3534, tsc 0, lint 0, protocol 0; fresh reset; both RPCs proven live as
two users + anon denied; the same three e2e specs 13/13.

⚠️ **1–2 e2e reds per run are the parallel-load flake family** (`display-scale`
/ `settings` / `shadowing-explore`), a DIFFERENT set each run, green run alone,
and firing on `master` too — read `run-state/e2e-failure-repair.md` before
calling one a regression.

🚨 **Registration reds were `Date.now()` emails**, fixed on master and merged in.
**Task 5 gate, 2026-09-29:** vitest 385/3576, tsc/lint/protocol 0; fresh reset;
`verify:db:pronunciation` + 7 SQL mutations red; e2e pronunciation+hub+settings 21/21.
**Task 4c gate, 2026-09-29:** vitest 384/3562, tsc/lint/protocol 0; fresh reset;
`npm run verify:db:pronunciation` (then `…:jlpt-speaking`) live, mutation-checked; e2e 19/20, the red `settings:179`.
🚨 `fa65eba` was NOT green: a pin was edited after its last vitest run. Gate after the LAST edit.
🚨 **A Client Component takes strings, never catalog formatters** — passing one
blanked the page in e2e while jsdom stayed green; `path-card-copy.test.ts` guards.

⚠️ **`cmd | tail` hides the exit code.** This file was committed once over a
RED `verify:protocol`, because the check was piped and `tail` exits 0.

## Working tree and environment

`.worktrees/pronunciation-library-port`, cut from `master` `a84bd79`. Own
`node_modules`, copied `.env.local`.

⚠️ **Serena's editing tools write to the MAIN CHECKOUT** — they resolve paths
against the project root and ignore the shell cwd, so here they silently patch
`master` and still report `OK`. Use `Read` + `Edit`/`Write` or `sed`. And
⚠️ **never build or serve in the main checkout** (shared `.next` with the
owner's dev server) — build only in this worktree, by absolute path.

- Owner: Codex  <!-- exactly one; the handoff is the commit that changes this line -->

## Blockers

None.

⚠️ **Protocol exception, owner-approved 2026-09-29:** Codex hit its usage limit
mid-Task 3; Claude finished it, and the owner then had Claude implement 3b
itself ("do not wait for Codex"). Each task got an independent `code-reviewer`.

## Next actions

1–8. **Tasks 1–5 DONE** (last `bddb22a`). Paths AND goals share `getCollectionViews`; sort by
   `position`, `slice` after sorting; the narrow case is 1024. Ruling 14 (owner): JLPT "View all"
   omitted. The heading row spans the rail (`TwoColumnShell` `header`, controls `part`).
9. **Whole-branch review — RUN** (two reviewers, 0 Critical); fixes: Codex A1–B7 + Part C, then
   quota; Claude finished B8 and re-gated.
10. **Rulings 15–20 (owner, 2026-09-29)**, verbatim in `docs/superpowers/specs/2026-09-29-pronunciation-owner-decisions.md`:
   15 engine: context loaded once, scored once, many consumers; skip useless runs; no cache ·
   16 rail may hold unique info (rewrite the shell invariant; no duplication) · 17 one
   `lastActivityAt = max(last_watched_at, latest session)` for hero AND resume · 18 non-default
   search/filter/sort/display → an All-lessons result surface; default = curated shelves ·
   19 no aggregate over an unpaginated select; >1000-row regression tests · 20 merge only after
   15–19 + full gates, **then the owner looks in Chrome, then decides.**
   15–17 DONE `3c9ec5e`. 18 DONE (Codex + Claude review fixes: `hasMore` on candidate overflow, count = shown,
   heading/empty copy from what the data layer applied). ⚠️ Result mode caps at 24, no "Show more" — owner question.
   Learner orders still rank only 100 candidates — page them in ruling 19. 19 → Codex, packet `.superpowers/sdd/pronunciation-library-port/ruling-19-brief.md`.
