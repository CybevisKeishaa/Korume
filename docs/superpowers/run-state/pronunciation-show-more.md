# Branch Run State

## Goal and scope

Turn the `/pronunciation` result surface into a compact lesson browser (no
query) and a grouped, tabbed search (query), leaving the default Figma screen
unchanged. Also carries `dac0259` (Show more + one resume lesson).

## Authorities

- Spec: `docs/superpowers/specs/2026-10-01-pronunciation-search-surface-design.md`
  (the acceptance test; owner approved).
- Plan: `docs/superpowers/plans/2026-10-01-pronunciation-search-surface.md`
  (Tasks 1-6; its code blocks are unverified drafts).
- `AGENTS.md` §2, §6, §7, §9; `docs/lessons.md`; `.codex/docs/workflow.md` §8.

## Accepted commits

`dac0259` Show more + resume lesson · `aebe7a0` `fd58d6f` `c64a4e6` spec ·
`84fd661` plan.

## Contracts and decisions

- Owner chose columns over card width: at 1280x529 the result pane is 704 px
  (nav shown) / 876 (hidden) → 3 cols ≈225 / 4 cols ≈208; acceptance is cards
  200-235 px at 1280, ≤300 anywhere, no overflow.
- Build the complete version; never trim toward minimal.

## Verification

`dac0259`: vitest 3644, e2e green. Tasks 1-6 not started.

## Working tree and environment

- Owner: Codex

Worktree `.worktrees/pronunciation-show-more` (own `node_modules`, `.env.local`).
Codex never commits, never runs Playwright or Docker; Claude runs DB steps,
reviews, commits. Untracked `tests/e2e/.probe/` and 30 local rows
`showmore-probe-%` are measurement leftovers; Task 6 deletes both.

## Blockers

None.

## Next actions

1. Codex: Task 1 (URL contract), packet `.superpowers/sdd/pronunciation-show-more/task-1-brief.md`.
2. Claude: independent `code-reviewer`, commit; then Tasks 2-5 the same way;
   Task 6 (Playwright) by Claude.
