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

## Verification

Measured in this worktree, never in the main checkout.

The tree matches `master` `a84bd79` apart from this file, so master's gate
stands and nothing needs measuring until Task 1 lands. `verify:protocol` exits
0 — this file sits at the 200-line cap, so keep it there.

⚠️ **1–2 e2e reds per run are the parallel-load flake family** (`display-scale`
/ `settings` / `shadowing-explore`), a DIFFERENT set each run, green run alone,
and firing on `master` too — read `run-state/e2e-failure-repair.md` before
calling one a regression.

**Task 2 e2e, 2026-09-28** (local DB migrated to `20260925000034` first):
`pronunciation.spec.ts` 3/3 green. `shadowing-explore.spec.ts:35` red 2 of 3
runs at REGISTRATION — **not a flake**: auth logs `users_email_partial_key`
duplicate; `e2e_…_${Date.now()}` collides across parallel workers (accounts
created 1–15 ms apart). Specs without `workerIndex`/`testId` in the email all
share it — a separate test-infra ticket, not this branch's code.

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

None. All three open decisions were ruled on 2026-09-28 (rulings 7–9).
⚠️ The Task 3 dispatch of 2026-09-27 died on Codex's usage limit after reading
files only — it wrote nothing; Task 3 restarts from scratch.

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
2. **Task 2 — DONE**, e2e run 2026-09-28 (see Verification). `getHubDiscovery`
   is shared by both hubs; `HubDiscoveryControls` gained `basePath` + `heading`.
   Its narrow case is 1024, not 320 — below 1024 every route is the handoff.
3. **Task 3 — featured course hero** — handed to Codex 2026-09-28; brief
   `.superpowers/sdd/pronunciation-library-port/task-3-brief.md`.
4. **Task 3b — Popular Learning Paths.** Its own step, not a shelf: the first
   consumer of Task 1's ordering + rollup, so a different shape from a plain
   collection shelf. It lands the `collections.kind` / `skill_focus`
   migration (ruling 7) and marks the path rows `kind = 'path'`.
5. **Task 4a — shelves whose data exists today:** Practice by Situation
   (`lesson_situations`) + Shadowing Collections, over `hub-shelves`.
6. **Task 4b — Practice by Goal** per ruling 7 (migration + seed + reads +
   shelf + weakest-metric badge), on the `kind` column 3b landed.
6b. **Task 2b — Sort & display panel + placeholder copy**, per rulings 8–9.
7. **Task 4c — JLPT Speaking**, the aggregation view above. No migration.
8. **Task 5 — right rail:** Today's Speaking + Weekly Improvement (Accuracy,
   Pitch Accent, Rhythm) + AI Sensei Recommendation + Recently Practiced. Every
   value derives from persisted session data or the recommendation engine, and
   **empty-history states are explicit** — never a zero standing for an unknown.
9. Whole-branch review, then `--no-ff` merge. **Owner decision, not taken.**
