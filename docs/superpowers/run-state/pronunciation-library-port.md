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

2. **The rail shows only the two metrics something actually measures.**
   The frame's "Weekly Improvement" lists Accuracy **+8%**, Pitch Accent
   **+13%**, Rhythm **+6%**, Confidence **+11%**. Azure scoring
   (`lib/speech-scoring`) measures accuracy and `lib/pitch` measures pitch
   accent. **Nothing in this repo measures rhythm or confidence.** Rendering a
   number for them would put a fabricated figure in front of a learner, which
   is worse than an absent row — so the rail ships Accuracy and Pitch Accent
   only. Rhythm and Confidence need a real measurement first; that is their own
   ticket, not a number invented here.

▶ **Three contradictions found and NOT yet ruled on** — each still open:
- **"Practice by Goal"** (Improve Pitch Accent / Improve Fluency / Native
  Rhythm Training) has no entity of any kind behind it.
- **"JLPT Speaking"** N5–N1 with a per-level `Avg score` needs an aggregation
  that does not exist; `videos.jlpt_level_estimate` is the only level fact.
- **Two hubs over one lesson pool.** `/shadowing` already ships a hub over the
  same taxonomy. Whether `/pronunciation` is a second shelf of the same
  lessons or a distinct content domain is a product question, not a port one.

## Verification

Measured in this worktree, never in the main checkout.

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

None. Three open contradictions are recorded above; none blocks the first tasks.

## Next actions

1. Task 1 — migration: ordering on `lesson_collections` + the progress rollup
   read, with its own tests.
2. Task 2 — the page shell: eyebrow/h1/subtitle + discovery row, over the
   existing `hub-discovery-controls`.
3. Task 3 — featured hero from the `featured` collections row.
4. Task 4 — the shelves (Situation, Collections) over `hub-shelves`.
5. Task 5 — the right rail: Today's Speaking, Your Progress (two metrics),
   Recently Practiced.
6. Whole-branch review, then `--no-ff` merge. **Owner decision, not taken.**
