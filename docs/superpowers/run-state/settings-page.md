# Branch Run State

Branch `settings-page`.

## Goal and scope

Port Figma Global settings `220:16032` onto `/settings` with a real consumer behind every control,
and build Erase Korume Memory. Nine tasks, one commit each, one `codex exec` dispatch per task,
Claude review between tasks. Reminders ship in the next branch, `study-reminders`.

## Authorities

- Spec: `docs/superpowers/specs/2026-09-22-settings-page-design.md` (owner-reviewed 2026-09-22)
- Plan: `docs/superpowers/plans/2026-09-22-settings-page.md`
- Task packets: `<main checkout>/.superpowers/sdd/2026-09-22-settings-page/task-N-brief.md`
- Rules: `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md` §8

## Accepted commits

- `87ebac7` spec · `8786544` spec review contracts · `0632308` keep /settings/privacy, Erase Memory
  in scope · plan + this run state (the commit that adds this file)

## Working tree and environment

- Worktree: `.worktrees/settings-page`, branch `settings-page` off `master` `e44a4ea`.
- `.env.local` copied from the main checkout. `node_modules` not installed yet: run `npm ci`.
- Docker Desktop is NOT running (checked 2026-09-22); start it and `npx supabase start` before
  Task 1's live gate or any Playwright run.
- Never build or serve from the main checkout; the owner's dev server uses its `.next`.

- Owner: Claude

## Blockers

- None.

## Next actions

**Resume here:** plan written. Waiting for the owner to approve the plan, then dispatch Task 1.

Per task: the task's own tests red → green, `npx tsc --noEmit` 0, `npm run lint` 0 errors, full
`npm test -- --reporter=dot > <file>` exit 0 (read the file), and the task's named live gate or
Playwright spec (Claude runs Playwright; Codex never does).
