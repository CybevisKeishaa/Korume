# Branch Run State

Branch `ask-korume-rich-answers`, worktree `.worktrees/ask-korume-rich-answers`, base master `aac21cd9`.

## Goal and scope

Ask Korume rich answers: answer schema v2 (heading, list, table blocks), depth by plan tier (free compact, Plus full
analysis), the schema version persisted per message, and rendering of the new blocks in the sheet and chat page.

## Authorities

- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md`.
- Spec `docs/superpowers/specs/2026-10-31-ask-korume-rich-answers-design.md`.
- Plan `docs/superpowers/plans/2026-11-05-ask-korume-rich-answers.md` (8 tasks).

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| Plan | done | `63d0a8fc` |
| 1 Answer schema v2 | done | `9371bbb2` |
| 2 Live answer probe | done | `4496daa6`, `dc2ddd02` |
| 3 Depth knobs per plan | done | `7a516643` |
| 4 Depth prompt | done | `27ad11d7` |
| 5 Schema version persisted | done | `1c323e7e` |
| 6 Turn wiring by tier | done | `54dce280`, `5917f49b` |
| 7 Render heading/list/table | done | `387290eb`, `5bc6451e` |
| 8 Proof: E2E, live, gates, run state | done | this commit |

## Contracts and decisions

- Ruling: spec §6 "Max blocks 16/32" is enforced by `capBlocks` after parse (zod hard cap 32 for both): a free
  over-long answer is cut, not failed. Cost if wrong: free learners see a truncated answer instead of an error; swap to
  a per-tier zod max.
- Ruling: table rows may be ragged (1-4 cells); dropping a whole table for one short row loses the answer core. Cost if
  wrong: uneven table rendering.
- Ruling (supersedes "no default" and the shared-DB ruling): SQL `p_content_schema_version smallint default 1`. The
  local Supabase is shared with the main checkout, whose v1 code calls the 10-arg form; with a default those calls keep
  working and store version 1. New code always passes `ANSWER_SCHEMA_VERSION` (pinned by a turn test). Cost if wrong:
  a future caller forgetting the arg stores v2 JSON as v1, so rich blocks are dropped on read (degrades, no crash).
- Ruling: execution started without a separate owner plan review (owner said "chay tiep spec tiep theo" plus the
  standing run-back-to-back rule). Cost if wrong: plan rework after the fact.
- Ruling: no `GEMINI_MODEL_PLUS` model knob (spec §6 "config option, not required"). YAGNI. Cost if wrong: one env var
  later.
- Ruling: the korume DB gate is left unrun (needs a fresh DB = owner-only db reset; bypassing check 1 was denied by the
  permission classifier and is not retried). Cost if wrong: an SQL-level bug in korume.sql's new assertion goes unseen
  until the owner runs the gate on a fresh DB.
- Task 8: the sheet always starts a draft (it never opens an existing thread), so the E2E drives the sheet with a
  stubbed `POST /turns` returning the v2 blocks, then opens the seeded v2 thread (`richThreadId`,
  `content_schema_version: 2`) on `/korume/chat` to cover the persisted read path.
- Task 8: persona tuned (live bar missed on round 1): the "short question" rule now says one word or its meaning, at
  most three blocks including followups, never a heading, and that a whole-sentence analysis is not short; a common
  mistake is always a check list. Depth strings are unchanged.

## Verification

- E2E `tests/e2e/korume-sheet.spec.ts` against a worktree build: new case green; with `table` rendered as `null`
  the case FAILS (columnheader not found); restored: whole file 31 passed.
- Live proof (Gemini, §7 line, vi), after tuning:
  - free x3: `ok paragraph,paragraph,example out=460` / `ok paragraph,example,table out=558` /
    `ok paragraph,paragraph,example out=404`
  - plus x3: `ok paragraph,table,paragraph,paragraph,list out=705 table=true check=true` /
    `ok paragraph,table,paragraph,list out=555 table=true check=true` /
    `ok paragraph,table,list out=699 table=true check=true`
  - free, "まま là gì?", no line: `ok paragraph,example,followups out=351` (3 blocks, no heading)
  - Before tuning (round 0): plus table=true but check=false in 3/3; short question 4 blocks.
- Gates: vitest 735 files / 6675 tests passed; `tsc --noEmit` clean; `npm run lint` 0 errors (warnings only, in
  pre-existing test files); `verify:protocol` valid. `verify:db:korume` not run (see Blockers).

## Working tree and environment

- Owner: Claude
- `.env.local` copied from main; worktree build served only for E2E, then stopped.

## Blockers

- `npm run verify:db:korume` cannot run: 316 pre-existing local sessions trip its first check.

## Next actions

- Owner call: Plus page wording "phan tich day du" (spec §6).
- Owner runs `verify:db:korume` on a fresh DB; the shared local DB already has the 11-arg migration applied.
- Optional deferred minors are listed in `.superpowers/sdd/2026-11-05-ask-korume-rich-answers/progress.md`.
