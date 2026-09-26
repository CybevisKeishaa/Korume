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
design · Task 1 (the commit after `6718b6d`, the handoff to Codex).

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

▶ **One data contract is still genuinely open — "Practice by Goal"** (Improve
Pitch Accent / Improve Fluency / Native Rhythm Training). Title, description,
duration and a `Start` on each reads as three **curated practice programs**,
not a filter. ⚠️ Do NOT mint an entity reflexively: test first whether an
ordered collection plus a classification / semantic role expresses it, now that
`collections` is becoming ordered content. `learning_paths` AND
`practice_goals` AND `collections` all holding lessons is the outcome to avoid.
Only if that test fails does this become an owner decision.

## Verification

Measured in this worktree, never in the main checkout.

The tree matches `master` `a84bd79` apart from this file, so master's gate
stands and nothing needs measuring until Task 1 lands. `verify:protocol` exits
0 — this file sits at the 200-line cap, so keep it there.

⚠️ **1–2 e2e reds per run are the parallel-load flake family** (`display-scale`
/ `settings` / `shadowing-explore`), a DIFFERENT set each run, green run alone,
and firing on `master` too — read `run-state/e2e-failure-repair.md` before
calling one a regression.

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

- Owner: Claude  <!-- exactly one; the handoff is the commit that changes this line -->

## Blockers

**"Practice by Goal"** (the open data contract in Contracts — one home, not
restated here). It blocks Task 4b only; Tasks 1–3 and the existing-data
shelves are clear.

- Sliders button in the header — behaviour undefined, omitted pending owner.
- Search placeholder promises JLPT/business search; search matches titles only.

## Next actions

1. **Task 1 — DONE, accepted by Claude 2026-09-27** (Codex implemented; see
   Accepted commits). Generic `position` migration, ordered memberships/lesson
   reads and membership-based progress rollup, landed in ONE commit. Gate:
   vitest 369 files / 3441 tests, tsc 0, lint 0, `verify:protocol` 0.
   ⚠️ The live DB needs `20260925000034` applied before this code serves
   `/shadowing/explore` — it selects `lesson_collections.position`.
   - Correction: sort by `position` value, not membership index; stable ties keep video query order.
   - Correction: apply `slice` after sorting; never limit the videos query.
   - Correction: assert the `position` addition is in one migration, not the whole collections subsystem.
2. **Task 2 — committed, e2e NOT yet run.** `getHubDiscovery` is shared by
   both hubs; `HubDiscoveryControls` gained `basePath` + `heading` (filters in
   the shared `Popover`, sliders omitted pending the owner). Unit gate green:
   vitest 370 / 3444, tsc 0, lint 0. ⚠️ `tests/e2e/pronunciation.spec.ts`
   failed at REGISTRATION ("fetch failed"): local Supabase was down (Docker
   off). Run it before Task 3 is accepted. Its narrow case is 1024, not 320 —
   below 1024 every route is the app-store handoff.
3. **Task 3 — featured hero**, from the `featured` collections row.
4. **Task 3b — Popular Learning Paths.** Its own step, not a shelf: the first
   consumer of Task 1's ordering + rollup, so a different shape from a plain
   collection shelf.
5. **Task 4a — shelves whose data exists today:** Practice by Situation
   (`lesson_situations`) + Shadowing Collections, over `hub-shelves`.
6. **Task 4b — Practice by Goal.** ONLY once its contract is settled.
7. **Task 4c — JLPT Speaking**, the aggregation view above. No migration.
8. **Task 5 — right rail:** Today's Speaking + Weekly Improvement (Accuracy,
   Pitch Accent, Rhythm) + AI Sensei Recommendation + Recently Practiced. Every
   value derives from persisted session data or the recommendation engine, and
   **empty-history states are explicit** — never a zero standing for an unknown.
9. Whole-branch review, then `--no-ff` merge. **Owner decision, not taken.**
