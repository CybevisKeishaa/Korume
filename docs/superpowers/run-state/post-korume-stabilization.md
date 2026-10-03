# Branch Run State

Branch `post-korume-stabilization`.

## Goal and scope

Close the known follow-ups of Shadowing 1b (review M5–M9) and Ask Korume (M5 URL, m3 focus, selection-span e2e,
live Gemini smoke), and compare the landing e2e timeouts with master — before Summary/Analysis starts. Bug fixes only.

## Authorities

- Plan: `docs/superpowers/plans/2026-10-03-post-korume-stabilization.md` (tasks S1–S6, diagnosis section).
- `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md` §8.
- Owner 2026-10-03: this branch before Summary; live Gemini smoke pre-approved ("API free") — seeded demo data only.

## Accepted commits

- (none yet)

## Contracts and decisions

- Packets: `.superpowers/sdd/post-korume-stabilization/task-S<n>-brief.md` (gitignored). Codex never commits, never
  runs Docker / supabase / Playwright / next; Claude runs db reset, `verify:db:*`, e2e, and commits.
- `npx supabase db reset` is owner-approved on this branch (needed after the in-place migration edits). A reset wipes
  the local dictionary and the Ep.729 demo lesson: re-import with the 1b worktree's `.tmp/import.sh` and
  `scripts/seed-real-lesson.ts` before any Chrome or live check.

## Verification

- (none yet)

## Working tree and environment

- Owner: Codex
- Worktree `.worktrees/post-korume-stabilization`, from master `ea456b8`; `.env.local` copied from the main checkout.

## Blockers

- None.

## Next actions

- S1 (Codex) → S2 → S3 → S4 → S5 → S6 (Claude).
