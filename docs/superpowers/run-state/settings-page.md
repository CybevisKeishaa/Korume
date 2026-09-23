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
  finish — Codex was still rate-limited) · `c7a9f57` run state.
- **Task 4 — `b15b6d7` `feat(settings): display scale and account reduced motion`** (Claude) ·
  `7e29332` run state.
- **Task 5 — `12ac6ce` `feat(settings): Korume's own microphone and camera switches`** (Claude).
- **Task 6 — `4a5deb5` `feat(settings): export data and learning history`** (Claude).

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
- **Reduced motion has ONE runtime home: `theme-provider.tsx`** (owner ruling, 2026-09-23).
  `appearanceScript` only *seeds* `data-reduce-motion` before paint, the way `themeInitScript`
  already does, adding the one thing that script cannot know — the account preference.
  `PreferencesProvider` applies nothing itself; it calls `setReduceMotion`.
  `reduce-motion-toggle.tsx` was not touched and must stay that way.
  `effectiveReduceMotion = account || OS` in all three places.
- Display Scale needs the factor in **both** unit declarations, `:root` and the
  `[data-density="reference"]` reset. Only a browser measurement proves the second one works;
  `tests/e2e/display-scale.spec.ts` is that proof and the CSS comment points at it.
- ⚠️ **`MobileAppHandoff` renders its own `<main data-density="reference">` into every protected
  page.** Any browser measurement must use `:visible` and assert a count of exactly 1, or it
  measures the replacement app instead of the shell under test.
- ⚠️ **`playwright.config.ts` gives `npm run build && npm run start` a 120s `webServer.timeout`,
  which the build exceeds.** Build first, start the server from the worktree by absolute path, and
  let `reuseExistingServer` pick it up — and check `:3000` is free first, because the owner's dev
  server lives there and `reuseExistingServer` would silently test the main checkout (`L-017`).
- **`canUseDevice` is the one gate for every capture device** (`lib/media/device-gate.ts`). It sits
  in `useRecorder`, which both capture surfaces route through — the shadowing panel and the
  conversation voice button. Every future camera or microphone feature must call it.
  `disabled-in-settings` is a `RecorderState` of its own, deliberately NOT `"error"`: nothing
  failed, so the UI offers the settings link instead of a retry down the same blocked path.
- **`USER_EXPORT_TABLES` is the only enumeration of personal data in the codebase** — account
  deletion relies on the `users` cascade and keeps no list. Its guard reads the migrations and
  computes the one-hop set from the DIRECT set minus the exclusions, never from the list it guards
  (`L-006`). A new table with a `users` foreign key fails the guard until it is exported or
  excluded with a written reason.
- `test/render.tsx`'s `renderHook` takes a `wrapper`, nested inside the intl provider. Use it —
  hand-rolling one means importing `next-intl`, which spec P1 forbids outside `lib/i18n/`.
- `token-scale.test.ts` pins `components/ui` at a hardcoded `sources:` count — **18** as of Task 3.
  Any task that adds a primitive must bump it, and will see it go red first.
- No Radix switch or radio-group package is installed, and neither was added. `Switch` is a native
  `<button role="switch">`; `SegmentedControl` hand-rolls the radiogroup roving-tabindex pattern.
- `erase_companion_memory()` stays `security invoker`: `companion_memories_delete_own` and
  `conversation_sessions_own` are what scope it, and `conversation_messages` goes with the session
  through its `on delete cascade`.

## Verification

Each task's own commit message carries its full evidence — failure-first output, mutation checks and
gate numbers. Claude re-ran every gate itself rather than copying an implementer's report. Headline
figures, full suite via `npm test -- --reporter=dot`:

| Task | Full suite | Other gates |
| --- | --- | --- |
| 1 | 345 files / 3238 tests | `npm run verify:db:settings` exit 0, 5 `PASS` lines |
| 2 | 348 / 3255 | 4 mutation checks red |
| 3 | 350 / 3275 | compiled-CSS check; 5 mutation checks red |
| 4 | 353 / 3294 | Playwright `display-scale` 2/2; 5 mutation checks red |
| 5 | 354 / 3306 | 2 mutation checks red |
| 6 | 359 / 3336 | 9 mutation checks red |

`master` at `e44a4ea` was 340 / 3209. `npx tsc --noEmit` 0 and `npm run lint` 0 errors at every
task. Every mutated source was restored byte-for-byte and re-verified with SHA-256.

⚠️ **Not yet run on this branch:** `npm run verify:db:lesson-jobs`, the C4 Playwright spec, and
`next build` since Task 4 (the worktree's `.next` was deleted after the display-scale measurement).
Task 9 adds `tests/e2e/settings.spec.ts`; run the whole e2e suite before proposing a merge.

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

**Resume here: Task 7 — Erase Korume Memory.** The SQL half already shipped in Task 1:
`erase_companion_memory()` is `security invoker`, granted to `authenticated`, and the live gate
proves it removes only the caller's rows and leaves `user_stats` untouched. Task 7 is the API
(`lib/data/memory-erase.ts`, `app/api/user/memory-erase/route.ts`), the confirmation page
(`app/[locale]/(protected)/(app)/settings/privacy/memory/page.tsx`,
`components/settings/memory-erase-form.tsx`) and the registry entry. Then Task 8 (save hook + the
three control sections) and Task 9 (page assembly, danger zone, daily goal, registry, e2e).

**Plan defects found so far — expect more, and measure before trusting a plan snippet.** Task 1's
`Record<string, string>` did not compile; Task 3's `h-icon-md` generates no CSS and its
`sources: 16` count was stale; Task 6's history section named four SRS tables where there are
three and a column that does not exist. The plan is a strong guide, not an authority over the
repo.

**Codex has not been used since Task 2**, when it hit its ChatGPT usage limit (~15:50 on
2026-09-23, resetting 20:01). Tasks 3–6 are Claude's own work, at the owner's instruction. When
dispatching again: a run that dies partway writes `ERROR: You've hit your usage limit` to its log
and no `-o` file — grep `^ERROR: You.ve hit your usage limit` before diagnosing anything else.

Per task: the task's own tests red → green, `npx tsc --noEmit` 0, `npm run lint` 0 errors, full
`npm test -- --reporter=dot > <file>` exit 0 (read the file), and the task's named live gate or
Playwright spec (Claude runs Playwright; Codex never does).
