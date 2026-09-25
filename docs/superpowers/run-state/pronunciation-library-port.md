# Branch Run State

## Goal and scope

Port `/pronunciation` — registry `pronunciation-library`, Figma `37:4955`, nav
`practice`/2 — from its `UpcomingScreen` placeholder to the real screen.

The frame is **1278 wide and 1927 tall**, and only its right-hand child
`37:5331 PronunciationLibraryContent` (1054 wide) is in scope. `37:4962
Sidebar` is NOT: the screen-port workflow ruled the Figma sidebar is ported
ONCE into the real `AppNav` and never re-imported per screen.

⚠️ **Out of scope, deliberately:** the recording studio itself. This is the
LIBRARY (the frame's own name), a discovery hub. `/api/pronunciation/score`,
`lib/speech-scoring/**` and `lib/pitch/**` already exist and are consumed by
`components/video-player/shadowing-recorder-panel.tsx`; this branch routes TO
that machinery and does not rebuild it.

## Authorities

- **Figma is the frame** (port doctrine): build what the frame shows, backend
  included. Only a Figma-vs-repo CONTRADICTION goes to the owner. Five were
  found and two were ruled on this session — see Contracts.
- `mem:screen_port_workflow_inputs` — the four screen types and the five-step
  per-screen checklist (contract → read frame → reuse check → build → four
  checks). This screen is **type "App page"**: standard shell + nav, `chrome:
  "app"` in the registry.
- `AGENTS.md` §2 (non-negotiables, incl. rule 5 / WCAG 1.4.10 at 320 CSS px),
  §6 (one fact one home), §7 (mutation-check a guard over existing code), §9 (DoD).
- `docs/lessons.md` L-002 (never quote a count — enumerate), L-004 (a guard no
  command invokes, and vacuous guards), L-009 (never wave a flake through).

## Accepted commits

| Commit | What |
|---|---|
| *(none yet)* | |

## Contracts and decisions

**The screen contract** (checklist step A), settled before any code:

- **Route** `/[locale]/(protected)/(app)/pronunciation` — exists, placeholder.
- **Type** App page. `chrome: "app"`, so `AppNav` is the layout's, not ours.
- **Navigation** `practice`/2, already in the IA. No nav change in this branch.
- **Data** the lesson taxonomy that already ships — `collections`,
  `lesson_situations`, `lesson_sources`, `videos`, `user_video_progress`,
  `shadowing_sessions` — plus the two rulings below.
- **Interactions** search/filter row, shelf "View all", card → lesson.

⭐ **Reuse is the whole plan.** `/shadowing` (frame `149:2`) is the SAME
structural pattern as this frame: eyebrow + h1 + subtitle, a search row, a
featured hero with badge/meta-chips/progress/two buttons, shelves with "View
all", and a multi-card right rail. `components/shadowing/hub-*` therefore
supplies the family — `hub-featured-hero`, `hub-shelves`, `hub-section-heading`,
`hub-lesson-card`, `hub-discovery-controls`, `hub-empty-state`. A second,
parallel component family for the same shapes is the thing this branch must
NOT produce. Where a hub component needs a variant, it gets a prop, not a fork.

⚠️ **Two owner rulings, 2026-09-25.** Both are deviations from the frame and
both are deliberate:

1. **A learning path is an ORDERED collection, not a new entity.**
   The frame shows `80 / 120 lessons`, `67% complete`, `8 hours`, `JLPT N3–N2`.
   `collections` is a curated set with NO ordering and no progress rollup, and
   `lesson_collections` is a bare join. The ruling: add ordering to
   `lesson_collections` and roll progress up from `user_video_progress` — do
   NOT introduce a `courses` table that would duplicate a seeded `collections`.
   ⚠️ `20260731000019`'s own comment warns that `featured` is a collections ROW
   (`slug = 'featured'`), not a boolean and not a fourth `library_access`
   value. The featured hero reads that row; it does not invent a flag.

2. **Weekly Improvement renders only metrics backed by a persisted
   measurement.** The frame lists Accuracy **+8%**, Pitch Accent **+13%**,
   Rhythm **+6%**, Confidence **+11%**.

   | Row | Backing | Ships |
   |---|---|---|
   | Accuracy | `shadowing_sessions.pronunciation_score` | ✅ |
   | Pitch Accent | `shadowing_sessions.pitch_score` | ✅ |
   | Rhythm | `shadowing_sessions.rhythm_score` | ✅ |
   | Confidence | *nothing* | ❌ omitted entirely |

   **No metric value or delta may be fabricated to match Figma.** Confidence
   disappears from the UI until a real measurement exists — it does not ship as
   an empty row kept for the frame's sake.

   🚨 **An earlier version of this ruling said "Accuracy and Pitch Accent only,
   nothing measures rhythm". That premise was FALSE and the ruling above
   replaces it.** Azure's `FluencyScore` maps to `rhythm_score`
   (`lib/speech-scoring/types.ts:26`) and `lib/data/pronunciation.ts:97-100`
   writes it. The wrong claim came from noting that no `components/pronunciation/`
   directory exists and inferring the capability was missing. **"No component"
   is not evidence of "no capability"** — grep the persisted FIELD. This one
   cost a product ruling that had to be reversed.

3. **The deltas are IMPROVEMENT deltas, not scores.** `+8%` is not a score of
   92 rendered with a plus sign. Task 5 defines a real comparison window — the
   current week against the previous one — and computes the change across it.
   When either period lacks data, the row shows a neutral `—` / "Not enough
   data". **A fabricated `+0%` is not an acceptable stand-in for an unknown.**

4. **One lesson pool, two hubs, no duplicated records.** `/pronunciation` is
   the speaking/pronunciation discovery + progress hub; `/shadowing` is the hub
   for shadowing practice. Pronunciation re-surfaces `Shadowing Collections` as
   one of its shelves — the frame puts that shelf inside Pronunciation Studio
   alongside Situation, Goal, JLPT and Learning Paths — and it re-shelves the
   SAME lesson and content records. It never copies them.

5. **JLPT Speaking is an aggregation VIEW, not an entity.** No table, and no
   migration. `shadowing_sessions` carries `user_id`, `video_id` and
   `created_at`; joining `video_id → videos.jlpt_level_estimate` and grouping
   N5–N1 yields the practice count, the completion figure and the average score
   the frame shows. The same join feeds Today's Speaking and Recently Practiced.

6. **AI Sensei Recommendation ships on the real engine.**
   `lib/data/recommendations.ts` is the i+1 comprehensible-input scorer — it
   ranks candidates by the fraction of content words the caller already knows
   through SRS mastery, in `ideal` / `too-easy` / `too-hard` bands. Task 5 ports
   the card against it. It is **not** a deliberate omission.

▶ **One data contract is still genuinely open:**
- **"Practice by Goal"** (Improve Pitch Accent / Improve Fluency / Native
  Rhythm Training). The frame gives each a title, a description, a duration and
  a `Start` — which reads as three **curated practice programs**, not as a
  filter. ⚠️ Do NOT mint an entity for it reflexively. The plan must first test
  whether an ordered collection plus a classification / semantic role can
  express it, now that `collections` is becoming ordered content. What this
  branch must not produce is `learning_paths` AND `practice_goals` AND
  `collections` all holding lessons. Only if that test fails does it become an
  owner decision.

## Verification

Measured in this worktree, never in the main checkout.

**No production code has been written on this branch yet.** Two commits, both
documentation. The tree is clean and identical to `master` `a84bd79` apart from
this file, so the branch inherits master's green gate and nothing here needs
re-measuring until Task 1 lands.

| Gate | Result |
|---|---|
| `npx vitest run` | *(not yet run on this branch)* |
| `npm run typecheck` | *(not yet)* |
| `npm run lint` | *(not yet)* |
| `npm run verify:protocol` | *(not yet)* |
| `npm run test:e2e` | *(not yet — see the flake note below)* |

⚠️ **The e2e suite leaves 1–2 red per run from the parallel-load flake family**
(`display-scale` / `settings` / `shadowing-explore`), a DIFFERENT set each run,
all green run alone, and they fire on `master` too. Read
`docs/superpowers/run-state/e2e-failure-repair.md` before reading any e2e
figure here as a regression.

## Working tree and environment

`.worktrees/pronunciation-library-port`, branch `pronunciation-library-port`,
cut from `master` `a84bd79`. Its own `node_modules` and a copied `.env.local`.

⚠️ **Serena's editing tools write to the MAIN CHECKOUT.** They resolve
`relative_path` against the activated project root and ignore the shell cwd, so
in a worktree they silently patch `master` and still report `OK`. Use
`Read` + `Edit`/`Write` or `sed` here.

⚠️ **Never build or serve in the main checkout** — it shares `.next` with the
owner's dev server. Build and serve only in this worktree, by absolute path.

- Owner: Claude  <!-- exactly one; the handoff is the commit that changes this line -->

## Blockers

**One open data contract remains — "Practice by Goal".** It does not block
Tasks 1–3 or the existing-data shelves, but it blocks Task 4b. Nothing else is
open: JLPT Speaking, the AI Sensei card and the shared lesson pool are all
settled above.

## Next actions

1. **Task 1 — migration + rollup, GENERIC. ▶ START HERE; the design below is
   already settled, do not re-derive it.**
   ⚠️ **Nothing pronunciation-specific goes in this migration** — no `goal`, no
   JLPT, no speaking semantics. It is ordered-collection machinery that any
   caller can use, and the pronunciation screen is merely its first consumer.

   Written once and reverted deliberately on 2026-09-25, because the data-layer
   half selects a column the migration had not yet added — leaving it in the
   tree would have broken `/shadowing/explore`, which calls the same function.
   **Land the migration and the reads in ONE commit.**

   *Migration* `supabase/migrations/20260925000034_collection_ordering.sql`:
   add `position int not null default 0` to `lesson_collections`. Default 0
   means every existing row keeps working and Explore's shelves do not move.
   Add the SQL-contract test beside it — `20260922000033_user_preferences.test.ts`
   is the pattern (read the file, strip comments, assert the text; it also
   asserts the subsystem lives in exactly ONE migration).

   *`lib/data/collections.ts`*:
   - Extract `listMemberships(collectionId)` — selects `lesson_id, position`,
     `.order("position")` then `.order("lesson_id")`. The second order is not
     decoration: two rows at the same position must still return stably.
   - `listCollectionLessons` reapplies that order after the `videos` query.
     The member query reads a DIFFERENT table through `.in()` and cannot order
     by a membership column, so build a `Map(id → index)` and sort by it. The
     sort must be STABLE, which is what keeps an unordered collection on its
     existing `created_at`/`id` order and leaves Explore untouched.
   - `getCollectionProgress(collectionId) → { total, completed }`. `total` is
     the MEMBERSHIP count, never the RLS-visible count — a path is 120 lessons
     long whether or not a PLUS lesson is hidden from this viewer, and a
     per-viewer denominator would make the percentage mean something different
     for each of them. `completed` counts `completed_at !== null` only: a
     `user_video_progress` row with a null `completed_at` is a lesson STARTED.
     No user id is passed — `video_progress_own` is owner-only RLS.

   *Tests* (all four were written and seen RED before the revert, so TDD order
   is already established): memberships ordered by `position`; member lessons
   returned in editorial order **with the fixture handing the videos back in
   the opposite order**, so the reordering cannot pass by coincidence; the
   rollup ignoring started-but-unfinished; and an empty collection returning
   `{0, 0}` **without** a `user_video_progress` resolver registered, which
   proves the second query is skipped (the mock throws on an unresolved table).
2. **Task 2 — the page shell.** Eyebrow / h1 / subtitle + the discovery row,
   over the existing `hub-discovery-controls`.
3. **Task 3 — the featured hero**, from the `featured` collections row
   (`slug = 'featured'`, never an invented boolean).
4. **Task 3b — Popular Learning Paths.** Its own step, not a shelf: it is the
   first real consumer of Task 1's ordering + progress rollup, which makes it a
   different shape from a plain collection shelf.
5. **Task 4a — shelves that have their data today:** Practice by Situation
   (`lesson_situations`) and Shadowing Collections (`collections`), over
   `hub-shelves`.
6. **Task 4b — Practice by Goal.** ONLY after its data contract is settled
   (see Blockers).
7. **Task 4c — JLPT Speaking**, as the aggregation view described above. No
   migration.
8. **Task 5 — the right rail:** Today's Speaking + Weekly Improvement
   (Accuracy, Pitch Accent, Rhythm only) + AI Sensei Recommendation + Recently
   Practiced. Every value derives from persisted session data or the
   recommendation engine, and **empty-history states are explicit**, never a
   zero standing in for an unknown.
9. Whole-branch review, then `--no-ff` merge. **Owner decision, not taken.**
