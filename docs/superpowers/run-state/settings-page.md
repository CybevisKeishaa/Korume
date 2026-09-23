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
  in scope · `45a89f0` plan + this run state · `9edebbb` Task 1 dispatch record
- **Task 1 — `c7526b8` `feat(settings): user preferences storage and API`** (Codex implemented,
  Claude reviewed and committed).

## Contracts and decisions

- Task 1 is bounded by its task packet, the Settings page spec and the Task 1 plan section; no
  Task 2–9 scope is included.
- One PATCH mutates one logical control, so no request half-succeeds across `users` and
  `user_preferences`. `readPreferences` never throws; any failure yields `DEFAULT_PREFERENCES`.
- `TO_COLUMN` is keyed by the preference union, not `string`. The plan's own snippet indexed a
  `Record<string, string>`, which does not compile under `noUncheckedIndexedAccess`; Codex worked
  around it with a runtime `if (column)` guard, which would silently turn a future preference with
  no column mapping into a PATCH that returns 200 and saves nothing. Typing the record makes that a
  compile error instead. **Tasks 4 and 8 add preferences — expect TS2741 if a column is forgotten,
  and treat it as the guard working.**
- `erase_companion_memory()` stays `security invoker`: `companion_memories_delete_own` and
  `conversation_sessions_own` are what scope it, and `conversation_messages` goes with the session
  through its `on delete cascade`.

## Verification

Task 1, re-run by Claude at review on 2026-09-23 (not copied from the implementer's report):

- `npx vitest run lib/preferences lib/validation/preferences.test.ts lib/data/preferences.test.ts
  app/api/user/preferences supabase/migrations` — exit 0, 6 files / 43 tests.
- `npx supabase db reset` exit 0, then `npm run verify:db:settings` — exit 0, 5 `PASS` lines
  (A reads own row · B cannot read or update A · schedule constraints · scoped memory erase ·
  teardown).
- `npx tsc --noEmit` exit 0 · `npm run lint` exit 0, 0 errors (pre-existing warnings elsewhere).
- `npm test -- --reporter=dot` — exit 0, **345 files / 3238 tests** (master at `e44a4ea` was
  340 / 3209).
- Mutation checks, both restored byte-for-byte and re-verified by SHA-256:
  - migration source test: removing `'relaxed'` from the `review_frequency` CHECK → red (Codex).
  - `TO_COLUMN`: removing `cameraEnabled` → `TS2741`, tsc exit 2; restored → exit 0.
  - live gate: deleting user A's `user_stats` row → `FAIL erase: user A memory removal affected
    the wrong data`, gate exit 3. Before the `coalesce` fix that comparison was against NULL and
    the gate passed while proving nothing (`L-004`).

## Working tree and environment

- Worktree: `.worktrees/settings-page`, branch `settings-page` off `master` `e44a4ea`.
- `.env.local` present; `npm ci` has been run here (exit 0) — do not reinstall.
- Docker Desktop and local Supabase are **up** as of 2026-09-23; the DB was `db reset` during the
  Task 1 gate, so local data is the seed set.
- Never build or serve from the main checkout; the owner's dev server on `:3000` uses its `.next`.
- `npm run verify:protocol` exits 1 for a reason outside this branch:
  `docs/superpowers/run-state/auth-error-ux.md` has no `- Owner:` line. That file is on `master`.
  This branch's own run state passes the same gate. **Do not "fix" it from here** — it needs its
  own commit on master, and it is the one thing blocking a clean protocol gate.

- Owner: Claude

## Blockers

- None for Task 2.

## Next actions

**Resume here: dispatch Task 2 — "Engines read the preferences."** Write
`<main checkout>/.superpowers/sdd/2026-09-22-settings-page/task-2-brief.md` from the plan's Task 2
section, flip `- Owner: Codex`, then `codex exec -s workspace-write -C <this worktree> -o <file>`
with the prompt on stdin. Codex leaves the work uncommitted and flips the owner back; Claude
reviews, re-runs the gates and commits.

Per task: the task's own tests red → green, `npx tsc --noEmit` 0, `npm run lint` 0 errors, full
`npm test -- --reporter=dot > <file>` exit 0 (read the file), and the task's named live gate or
Playwright spec (Claude runs Playwright; Codex never does).
