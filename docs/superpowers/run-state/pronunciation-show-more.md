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
`84fd661` plan · `d8b1cf1` run state · `3eccde0` **Task 1** URL contract
(reviewed; fix: q cut to the schema bound) · `3535787` plan correction.

## Contracts and decisions

- Owner chose columns over card width: at 1280x529 the result pane is 704 px
  (nav shown) / 876 (hidden) → 3 cols ≈225 / 4 cols ≈208; acceptance is cards
  200-235 px at 1280, ≤300 anywhere, no overflow.
- Build the complete version; never trim toward minimal.
- PLUS lessons are visible to every learner (`20260731000023`): a PLUS-only
  path IS listed and counted; only RLS-hidden (another learner's PRIVATE)
  lessons make a path vanish. Task 2's gate follows its packet, not the plan.
- For Task 3 (from the Task 1 review): build `hubQuery` with
  `q: normalizeSearchQuery(raw q)` and parse `filter` on its own, so a long q
  can never make the schema drop the filter; redirect a non-canonical `type`
  whatever the q (no bad `type` may survive on Browse/Default either).

## Verification

`dac0259`: vitest 3644, e2e green. `3eccde0`: tsc/lint/protocol/vitest 0 (3659).

## Working tree and environment

- Owner: Codex

Worktree `.worktrees/pronunciation-show-more` (own `node_modules`, `.env.local`).
Codex never commits, never runs Playwright or Docker; Claude runs DB steps,
reviews, commits. Untracked `tests/e2e/.probe/` and 30 local rows
`showmore-probe-%` are measurement leftovers; Task 6 deletes both.

## Blockers

None.

## Next actions

1. Codex: Task 2 (SQL), packet `.superpowers/sdd/pronunciation-show-more/task-2-brief.md`;
   Claude runs db reset + `verify:db:pronunciation` + live mutations.
2. Claude: independent `code-reviewer`, commit; then Tasks 2-5 the same way;
   Task 6 (Playwright) by Claude.
