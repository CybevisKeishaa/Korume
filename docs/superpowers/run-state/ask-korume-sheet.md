# Branch Run State

Branch `ask-korume-sheet`, worktree `.worktrees/ask-korume-sheet`, base master `63e42083`.

## Goal and scope

Ask Korume resizable sheet: resize/move, small and large layouts, splitter, draggable mascot, a relevant rail,
chat column to Figma `215:15164`, quiet scrollbars.

## Authorities

- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md`.
- Spec `docs/superpowers/specs/2026-10-31-ask-korume-resizable-sheet-design.md` (owner-approved 2026-10-31).
- Plan `docs/superpowers/plans/2026-11-03-ask-korume-resizable-sheet.md` (8 tasks, rulings R1–R7). Waiting for the
  owner's review.

## Accepted commits

| Task | Status | Commit |
|---|---|---|

## Contracts and decisions

- Rulings R1–R7 in the plan.
- Measured 2026-11-03 on the owner's DB (read only): thread `37234c71…` stores 11 grounding rows and none has
  `seenCount`. Cards reference `ent:1006610` そう, `ent:2833406` ピン留め and `ent:1513940` 保存.

## Verification

## Working tree and environment

- Owner: Claude
- `.env.local` copied from main; `npm ci` done in the worktree.

## Blockers

## Next actions

- The owner reviews the plan, then Task 1.
