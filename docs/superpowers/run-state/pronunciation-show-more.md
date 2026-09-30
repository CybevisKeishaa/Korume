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
(reviewed; fix: q cut to the schema bound) · `3535787` plan correction · `4d2be4a` **Task 2** `search_learning_collections`
(live gate + 2 live mutations red) · `21a3d4b` **Task 3** data facade
(reviewed; fixes: counts = the shown group's own total, one shelf-visibility rule) ·
`ccd5e56` **Task 4** grid CSS + compact card (reviewed; fixes: min() for 1.4.10, pinned gap).

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
- `*` in q is dropped on every tab (containsPattern cannot escape it through
  PostgREST; the library matcher drops it too) — uniform, not a wildcard.
- The preview-row container breakpoints use the LARGEST display scale (gap
  up to 1.25rem), not 1rem; see the Task 4 packet.

## Verification

`dac0259`: vitest 3644, e2e green. `3eccde0`: tsc/lint/protocol/vitest 0 (3659). `4d2be4a`: db reset,
verify:db pronunciation/settings/lesson-jobs 0; same four gates 0. `21a3d4b`:
four gates 0 (3672), 4 mutations red. `ccd5e56`: four gates 0
(3676), mutations red (1rem breakpoints, nth-child swap, no min(), name).

## Working tree and environment

- Owner: Claude

Worktree `.worktrees/pronunciation-show-more` (own `node_modules`, `.env.local`).
Codex hit its usage limit during Task 4 (back 06:45); Claude implements
Task 5 itself (standing rule). Codex never commits, never runs Playwright or Docker; Claude runs DB steps,
reviews, commits. Untracked `tests/e2e/.probe/` and 30 local rows
`showmore-probe-%` rows were wiped by the Task 2 db reset; Task 6 deletes `.probe/`.

## Blockers

None.

## Next actions

1. Claude: Task 5 (page, three states, tabs), packet `.superpowers/sdd/pronunciation-show-more/task-5-brief.md`;
   a lesson renders once per page (the card's element ids rely on it).
2. Claude: independent `code-reviewer`, commit; then Tasks 2-5 the same way;
   Task 6 (Playwright) by Claude.
