# Pronunciation search surface — run state (2026-10-01, end of day)

## ⭐ MERGED to master `4c2d983` (2026-10-01) after the owner's Chrome look. Post-merge: tsc 0,
## vitest 3691. Local DB keeps demo rows prefixed `demo-search` (40 videos, 3 paths, 2 goals). History only.

## Where things stood before the merge
- Branch `pronunciation-show-more`, worktree `.worktrees/pronunciation-show-more`, tip **`71ed603`**,
  ALL 6 TASKS DONE, whole-branch review MERGEABLE (minors fixed in `71ed603`). **NOT merged.**
- Canonical branch facts: `docs/superpowers/run-state/pronunciation-show-more.md` (on the branch).
- Gates at the tip: fresh db reset; verify:db pronunciation/settings/lesson-jobs 0; tsc/lint/protocol 0;
  vitest 3691; e2e pronunciation-search + pronunciation + shadowing-hub + shadowing-explore 24/24 on a
  worktree build served on port 3000.

## Commits (master...branch)
`dac0259` Show more + resume lesson · spec `aebe7a0 fd58d6f c64a4e6` · plan `84fd661` · `3eccde0` T1 URL
contract · `4d2be4a` T2 SQL `search_learning_collections` · `21a3d4b` T3 data facade · `ccd5e56` T4 grid
CSS + compact card · `83340ba` T5 page (Claude — Codex hit its quota mid-T4) · `8c8a38c` T6 e2e ·
`71ed603` review minors. Plus run-state/plan-correction doc commits.

## Next — the OWNER's two steps
1. Look in Chrome, nav shown AND hidden: `?q=ramen`, each tab, Show more, Hide navigation.
2. Merge decision: `git merge --no-ff pronunciation-show-more` on master (owner pushes by hand).

## Things the plan got wrong (caught by grep/measurement, not by reading)
- PLUS lessons are NOT hidden from Free learners (`20260731000023_plus_metadata_visible.sql`): a PLUS-only
  path is listed and counted. The SQL gate uses another learner's PRIVATE lesson for "hidden".
- The grid gap is NOT bounded by 1rem: `--space-md` scales with the Display size setting up to ×1.25, so
  the preview container-query breakpoints are n×12rem + (n−1)×1.25rem (pinned in lib/design-tokens.test.ts).
- Codex's first facade duplicated the shelf-visibility rule for counts; now a shown group's own total is
  its count, other groups are counted by the same functions.

## Known, not scheduled
`isPronunciationResultMode`'s q branch unreachable (tested, harmless); `p_offset` always 0; a search still
reads curated-shelf data it does not render (as master did); the e2e seed's 30 FREE lessons are visible
to parallel specs (no count assertion depends on it). Older follow-ups: `collections.ts` "in progress"
second home; `getKnownVocabLemmas` one paged read.

## Session end (2026-10-01)
The Claude Code wrapper for the port-3000 server was reaped for low memory; an orphan `next start`
(PID 41088, built from the worktree at 71ed603) may still hold port 3000 — check `netstat -ano | grep :3000`
and `taskkill /PID <pid> /T /F` before running Playwright again. Codex quota resets 06:45.
