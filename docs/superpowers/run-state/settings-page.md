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
  Claude reviewed and committed) · `a7cf5bb` run state + protocol gate · `ababe68` Task 2 dispatch.
- **Task 2 — `5779b88` `feat(settings): SRS, difficulty and streak read the user's preferences`**
  (Codex implemented most of it, hit its usage limit before the handoff; Claude finished, reviewed
  and committed) · `1fffa1a` run state.
- **Task 3 — `49d7043` `feat(ui): Switch and SegmentedControl primitives`** (Claude, start to
  finish — Codex was still rate-limited).

## Contracts and decisions

- Each task is bounded by its task packet, the spec and its own plan section; no other task's scope
  is included.
- **Engine preferences are parameters with today's behaviour as the default**:
  `reviewItem(..., intervalMultiplier = 1)`, `scoreComprehension(..., band =
  DIFFICULTY_BANDS.adaptive)`, `advanceStreak(..., scheduleDays = ALL_DAYS)`. A user with no
  `user_preferences` row is unaffected, and every pre-existing engine test passes unchanged.
- `advanceStreak`'s "consecutive" now means every day strictly between the last active date and
  today is unscheduled. Under `ALL_DAYS` that is the old `gap === 1` rule exactly.
- **Never restate `REVIEW_FREQUENCY_MULTIPLIER` or `DIFFICULTY_BANDS` inside a `vi.mock`.** Spread
  the real module with `importActual` and assert the real constant; the first version of the three
  data-layer tests checked the mock against itself (`L-034`).
- Wiring and value are separate layers (`L-007`): the data-layer tests prove the *right constant
  reaches* the engine, `sm2.test.ts` proves its *value*. Neutralising a multiplier reddens the
  second and correctly leaves the first green.
- One PATCH mutates one logical control, so no request half-succeeds across `users` and
  `user_preferences`. `readPreferences` never throws; any failure yields `DEFAULT_PREFERENCES`.
- `TO_COLUMN` is keyed by the preference union, not `string`. The plan's own snippet indexed a
  `Record<string, string>`, which does not compile under `noUncheckedIndexedAccess`; Codex worked
  around it with a runtime `if (column)` guard, which would silently turn a future preference with
  no column mapping into a PATCH that returns 200 and saves nothing. Typing the record makes that a
  compile error instead. **Tasks 4 and 8 add preferences — expect TS2741 if a column is forgotten,
  and treat it as the guard working.**
- **A Tailwind utility is not real until the compiled CSS says so.** `--icon-md` is in the `size`
  scale and not in `height`, so `size-icon-sm` works and `h-icon-md` emits nothing. Check a class
  with `npx tailwindcss -i app/globals.css -o <file> --content <sources>` and grep the output — with
  a control, because CSS escapes `(`, `)` and `*` in selectors and a naive grep reports a rule that
  is there as missing. That mis-grep happened here and briefly produced a wrong diagnosis.
- Do **not** add an icon token to the `height` scale or a new rung to `--control-*`:
  `lib/design-tokens.test.ts` encodes the split (controls → `height`, icons → `size`), and
  `desktop-density-pass` deleted a rung rather than add one. Read the token through
  `h-[--icon-md]` / `w-[calc(2_*_var(--icon-md))]` instead; both compile.
- `token-scale.test.ts` pins `components/ui` at a hardcoded `sources:` count — **18** as of Task 3.
  Any task that adds a primitive must bump it, and will see it go red first.
- No Radix switch or radio-group package is installed, and neither was added. `Switch` is a native
  `<button role="switch">`; `SegmentedControl` hand-rolls the radiogroup roving-tabindex pattern.
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

Task 2, run by Claude after taking the task over:

- `npx vitest run lib/srs lib/difficulty lib/gamification lib/data` — exit 0, 40 files / 428 tests.
- `npx tsc --noEmit` exit 0 · `npm run lint` exit 0, 0 errors.
- `npm test -- --reporter=dot` — exit 0, **348 files / 3255 tests** (+3 files, +17 tests over
  Task 1's 345 / 3238: the three new `lib/data/*-preferences.test.ts`).
- No live DB gate: this task changes no SQL.
- Mutation checks, all four red, all three source files restored byte-for-byte and verified with
  `sha256sum -c`:
  - `REVIEW_FREQUENCY_MULTIPLIER.relaxed` 1.4 → 1 → `sm2.test.ts` red.
  - swap `DIFFICULTY_BANDS.easy` and `.challenge` → 3 red, including
    `recommendations.test.ts`'s band case.
  - drop `prefs.scheduleDays` at the `advanceStreak` call site → `gamification.test.ts` red.
  - leak the multiplier into `reviewItem`'s lapse branch → the failed-review case red. It was
    green before Claude changed that case's multiplier from 1.4 to 5.

Task 3, Claude:

- Failure first: both new test files failed to resolve their module before it existed.
- `npx vitest run components/ui` — exit 0, 15 files / 173 tests, including `token-scale`,
  `token-scale-adoption` and `logical-properties`.
- `npx tsc --noEmit` exit 0 · `npm run lint` exit 0, 0 errors.
- `npm test -- --reporter=dot` — exit 0, **350 files / 3275 tests** (Task 2: 348 / 3255).
- Compiled-CSS check: `.h-\[--icon-md\]` → `height: var(--icon-md)` and
  `.w-\[calc\(2_\*_var\(--icon-md\)\)\]` → `width: calc(2 * var(--icon-md))`; control
  `.h-icon-md` absent, as the plan's class would have been.
- Mutation checks, all five red, both sources restored byte-for-byte and verified by SHA-256:
  `onCheckedChange(checked)` instead of `!checked`; no `disabled` attribute; `tabIndex={0}` on
  every option; `move()` without `focus()`; `from + step` without the wrap.

## Working tree and environment

- Worktree: `.worktrees/settings-page`, branch `settings-page` off `master` `e44a4ea`.
- `.env.local` present; `npm ci` has been run here (exit 0) — do not reinstall.
- Docker Desktop and local Supabase are **up** as of 2026-09-23; the DB was `db reset` during the
  Task 1 gate, so local data is the seed set.
- Never build or serve from the main checkout; the owner's dev server on `:3000` uses its `.next`.
- `npm run verify:protocol` is **green** (`Codex protocol: valid`, exit 0) as of `a7cf5bb`, which
  gave `auth-error-ux`'s closed run state the `- Owner: Claude` line the validator requires; it had
  been exiting 1 repo-wide on `- Owner: none`. If it goes red, the commit that turned it red is
  yours.

- Owner: Claude

## Blockers

- None. Task 4 has a design collision to resolve first, recorded under Next actions.

## Next actions

**Resume here: Task 4 — session-wide appearance (display scale and reduced motion).**

⚠️ **Task 4 collides with code the plan does not mention.** `components/ui/reduce-motion-toggle.tsx`
already exists and drives reduce-motion through `components/providers/theme-provider.tsx`
(`useTheme().reduceMotion`), rendered in the `(focus)` nav rail and the admin style guide. The plan
introduces a `PreferencesProvider` and a pre-paint `<html>` script for the same fact. Decide
**one home** before writing code — most likely the existing theme provider reads the preference and
the toggle stays as the compact control — and do not ship a second source of truth (`L-026`).

Then Tasks 5–9 in order. Task 9 wires the registry and the e2e spec.

**Codex was rate-limited from ~15:50 on 2026-09-23, resetting 20:01.** Tasks 3 onward have been
Claude's own work. When Codex is available again, a dispatch dies partway with
`ERROR: You've hit your usage limit` in its log and writes no `-o` file — check the log for
`^ERROR: You.ve hit your usage limit` before diagnosing anything else.

Per task: the task's own tests red → green, `npx tsc --noEmit` 0, `npm run lint` 0 errors, full
`npm test -- --reporter=dot > <file>` exit 0 (read the file), and the task's named live gate or
Playwright spec (Claude runs Playwright; Codex never does).
