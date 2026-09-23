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

Scaffolding: `87ebac7` spec · `8786544` spec review contracts · `0632308` keep /settings/privacy,
Erase Memory in scope · `45a89f0` plan · `9edebbb`/`ababe68` dispatches · `a7cf5bb`, `1fffa1a`,
`c7a9f57`, `7e29332`, `e1c9b3c`, `6829eed` run states.

| Task | Commit | Title | By |
| --- | --- | --- | --- |
| 1 | `c7526b8` | `feat(settings): user preferences storage and API` | Codex, Claude committed |
| 2 | `5779b88` | `feat(settings): SRS, difficulty and streak read the user's preferences` | Codex part, Claude finished |
| 3 | `49d7043` | `feat(ui): Switch and SegmentedControl primitives` | Claude |
| 4 | `b15b6d7` | `feat(settings): display scale and account reduced motion` | Claude |
| 5 | `12ac6ce` | `feat(settings): Korume's own microphone and camera switches` | Claude |
| 6 | `4a5deb5` | `feat(settings): export data and learning history` | Claude |
| 7 | `3a5dd2e` | `feat(settings): erase Korume memory` | Claude |
| 8 | `2eeb87c` | `feat(settings): settings controls with per-control saving` | Claude |

## Contracts and decisions

- Each task is bounded by its packet, the spec and its own plan section — no other task's scope.
- **Engine preferences are parameters defaulting to today's behaviour** (`intervalMultiplier = 1`,
  `band = adaptive`, `scheduleDays = ALL_DAYS`), so a user with no `user_preferences` row is
  unaffected. `advanceStreak`'s "consecutive" now means every day strictly between the last active
  date and today is unscheduled — under `ALL_DAYS`, the old `gap === 1` rule exactly.
- **Never restate `REVIEW_FREQUENCY_MULTIPLIER` or `DIFFICULTY_BANDS` in a `vi.mock`** — spread the
  real module with `importActual` (`L-034`). Wiring and value stay separate layers (`L-007`): the
  data-layer tests prove the constant REACHES the engine, `sm2.test.ts` proves its value.
- One PATCH mutates one logical control, so no request half-succeeds across `users` and
  `user_preferences`. `readPreferences` never throws; any failure yields `DEFAULT_PREFERENCES`.
- `TO_COLUMN` is keyed by the preference union, not `string`: a runtime `if (column)` guard would
  turn a preference with no column mapping into a PATCH that returns 200 and saves nothing, so a
  forgotten column is a TS2741 instead. If a later task sees that error, the guard is working.
- **A Tailwind utility is not real until the compiled CSS says so** — `--icon-md` is in `size`,
  not `height`, so `h-icon-md` emits nothing. Compile with `npx tailwindcss -i app/globals.css -o
  <file> --content <sources>` and grep, with a control: CSS escapes `(`, `)` and `*`.
- Do **not** add an icon token to `height` or a rung to `--control-*`: `lib/design-tokens.test.ts`
  encodes the split (controls → `height`, icons → `size`). Read it through `h-[--icon-md]` /
  `w-[calc(2_*_var(--icon-md))]` instead; both compile.
- **Reduced motion has ONE runtime home: `theme-provider.tsx`** (owner ruling, 2026-09-23).
  `appearanceScript` only *seeds* `data-reduce-motion` before paint; `PreferencesProvider` applies
  nothing itself, it calls `setReduceMotion`; `reduce-motion-toggle.tsx` stays untouched.
  `effectiveReduceMotion = account || OS` in all three places — Korume may ADD reduction, never
  remove the OS's, which is why `AppearanceSection` shows a note instead of a dead switch.
- Display Scale needs the factor in **both** unit declarations, `:root` and the
  `[data-density="reference"]` reset; only a browser measurement proves the second
  (`tests/e2e/display-scale.spec.ts`).
- ⚠️ **`MobileAppHandoff` renders its own `<main data-density="reference">` into every protected
  page** — a browser measurement must use `:visible` and assert a count of exactly 1, or it
  measures the replacement app.
- ⚠️ **`playwright.config.ts`'s 120s `webServer.timeout` is shorter than the build.** Build first,
  start the server from the worktree by absolute path, let `reuseExistingServer` take it — and
  check `:3000` is free, or it silently tests the owner's checkout (`L-017`).
- **`canUseDevice` is the one gate for every capture device** (`lib/media/device-gate.ts`), inside
  `useRecorder`. `disabled-in-settings` is its own `RecorderState`, deliberately NOT `"error"`:
  nothing failed, so the UI offers the settings link, not a retry down the same blocked path.
- **`USER_EXPORT_TABLES` is the only enumeration of personal data here.** Its guard reads the
  migrations and computes the one-hop set itself, never from the list it guards (`L-006`).
- `test/render.tsx`'s `renderHook` takes a `wrapper` and its `render` takes a `locale` (below).
  Use both — hand-rolling either imports `next-intl`, which spec P1 forbids outside `lib/i18n/`.
- `token-scale.test.ts` pins `components/ui` at a hardcoded `sources:` count — **18** as of Task 3.
  Any task that adds a primitive must bump it, and will see it go red first.
- No Radix switch or radio-group package is installed, and neither was added. `Switch` is a native
  `<button role="switch">`; `SegmentedControl` hand-rolls the radiogroup roving-tabindex pattern.
- **`usePreferenceSave` is the ONLY save path for a settings control**, AI Training included (via
  an endpoint override — its value is a `users` column). It resolves `true`/`false` and never
  rejects: a caller holding state outside `UserPreferences` reads that result, a `.catch()` cannot
  fire. Three rules, in its docstring, all mutation-checked.
- **`SettingsRow` renders `<label htmlFor>` only when the control is labelable** — a `<label for>`
  aimed at a radiogroup is ignored by browsers while reading as correct in source. Non-labelable
  controls use `aria-label`.
- **Interface Language navigates, it never PATCHes** (the locale lives in the URL). Its labels are
  endonyms in `lib/i18n/routing.ts`, deliberately NOT in the catalogs — a translator rendering
  "Tiếng Việt" as "Vietnamese" defeats a language picker.
- ⚠️ **A fetch mock for a settings control must ECHO the patch.** One answering
  `DEFAULT_PREFERENCES` made every save revert, so a correct component failed its own test.
- **Tests read labels FROM the catalog, never as literals** (`messages/README.md`, owner request
  2026-09-23): the owner edits copy directly, and a hardcoded string makes the test a second owner
  of it. Measured — rewording 8 strings across both catalogs leaves 520/522 green; the 2 reds are
  the memory-erase claim pins, whose failures now carry the instruction. Pin a literal only when
  the literal IS the subject (a wire value; a wrong word asserted absent).
- `erase_companion_memory()` stays `security invoker`: `companion_memories_delete_own` and
  `conversation_sessions_own` scope it, and `conversation_messages` goes with the session through
  its `on delete cascade`. The data layer sends NO user id, so it cannot widen the blast radius,
  and throws on an rpc error — "could not erase" and "erased" are not interchangeable.
- ⚠️ **`token-scale-adoption.test.ts` scans `components/ui` ONLY** — its green says nothing about
  `components/settings` or `app/`. Check any utility with no repo precedent against compiled CSS.
  Two traps: a `--content` glob containing an app route path matches NOTHING (`[locale]` is a glob
  character class, `(protected)` a group), so copy the files to a plain directory; and always grep
  a class you KNOW exists as a control. Task 7's first run reported every class missing,
  `list-disc` included (`mem:korume-false-green-before-believing`).
- **`render`'s `locale` option** (Task 7; `test/messages.ts` gained `loadViMessages()`). Default
  stays `en`, text assertions stay English (spec D6). Use it only where behaviour is
  locale-dependent and an `en` render cannot see it — `MemoryEraseForm` has the user type a
  TRANSLATED word and posts an UNTRANSLATED literal, identical under `en`, so `{ confirm: typed }`
  passed every EN test byte-for-byte.
- **`messages/settings.pin.test.ts`'s forbidden-phrase scans cover the WHOLE catalog**, including
  `memoryErase` — the one block that genuinely IS immediate with no undo. Deliberate: the bans
  exist because those phrases were FALSE about the 7-day lifecycle, and `memoryErase.finality`
  states the same finality in words true about itself. If Task 8 or 9 trips a ban, reword as
  `finality` does; do NOT carve a subtree out, which would drop the guard the day someone nests
  deletion strings under it. Four new pins run the opposite way, catching memory-erase copy that
  goes quiet about a finality that is real.
- Erase Memory does NOT reuse `DeleteDataDialog` — it lands on confirm with no cancellation window
  while both deletion tiers are cancelable for 7 days, so a shared dialog means copy true for one
  and false for the other. It is also unaffected by `pendingRequest`, deliberately.

## Verification

Each task's commit message carries its full evidence; Claude re-ran every gate rather than copying
a report. Headline figures, full suite via `npm test -- --reporter=dot`:

| Task | Full suite | Other gates |
| --- | --- | --- |
| 1 | 345 files / 3238 tests | `npm run verify:db:settings` exit 0, 5 `PASS` lines |
| 2 | 348 / 3255 | 4 mutation checks red |
| 3 | 350 / 3275 | compiled-CSS check; 5 mutation checks red |
| 4 | 353 / 3294 | Playwright `display-scale` 2/2; 5 mutation checks red |
| 5 | 354 / 3306 | 2 mutation checks red |
| 6 | 359 / 3336 | 9 mutation checks red |
| 7 | 363 / 3362 | `verify:db:settings` exit 0, 5 `PASS`; `npm run build` exit 0; 12 mutation checks red; compiled-CSS check |
| 8 | 366 / 3409 | 16 mutation checks red; compiled-CSS check on the six new component files |

`master` at `e44a4ea` was 340 / 3209. `npx tsc --noEmit` 0 and `npm run lint` 0 errors at every
task. Every mutated source was restored byte-for-byte and re-verified with SHA-256.

Each delta is arithmetic: Task 7's +25 is 6+4+8+5 tests plus four `settings.pin` pins minus one
`it.each` row; Task 8's +47 is exactly 10+19+18.

⚠️ **Two tests were caught proving nothing — repeat both checks in Task 9.** (a) A Task 7 mutation
came back GREEN: `{ confirm: typed }` passed everything, because `test/render.tsx` pinned component
tests to `en`, where the typed word and the wire literal are the same string — sampled exactly
where both implementations agree (`mem:guard-sampled-when-idle`). (b) Task 8's first section mock
always answered `DEFAULT_PREFERENCES`, so every save reverted and a CORRECT component failed. Ask
*is there a locale, state or mock response where a wrong implementation still passes — or a right
one fails?*

⚠️ **Not yet run:** `verify:db:lesson-jobs` and the C4 Playwright spec. `next build` was green at
Task 7 (this worktree's `.next` is populated — stop any `:3001` server here before an e2e run); it
logs `Dynamic server usage` for Task 6's two export routes, which are `ƒ` dynamic and exit 0 —
console noise from their own `opaque500` logger. Run the whole e2e suite before proposing a merge.

## Working tree and environment

- Worktree: `.worktrees/settings-page`, branch `settings-page` off `master` `e44a4ea`.
- `.env.local` present; `npm ci` has been run here (exit 0) — do not reinstall.
- Docker Desktop and local Supabase **up** as of 2026-09-23; DB `db reset` at the Task 1 gate, so
  local data is the seed set.
- Never build or serve from the main checkout; the owner's dev server on `:3000` uses its `.next`.
- `npm run verify:protocol` is **green** (`Codex protocol: valid`) — if it goes red, the commit
  that turned it red is yours. It caps this file at **200 lines**, which Tasks 7 and 8 both hit:
  trim your own prose rather than delete contracts a later task still reads.

- Owner: Claude

## Blockers

- None.

## Next actions

**Resume here: Task 9 — the last task: page assembly, danger zone, daily goal, registry, e2e.**
Mount `LearningSection` / `AppearanceSection` / `PrivacyDataSection` (built and tested, but NOT yet
rendered anywhere) on `/settings`; extract `deletion-controls.tsx` so both privacy surfaces share
it; feed the daily goal to the shadowing rail; flip `settings` to `built` in the registry and drop
it from `upcoming-routes.test.tsx` (11 → 10); write `tests/e2e/settings.spec.ts`. Bump
`token-scale.test.ts`'s `sources:` count only if it adds a `components/ui` primitive (Task 8 added
none).

**Plan defects found so far — expect more, measure before trusting a snippet.** Task 1's
`Record<string, string>` did not compile; Task 3's `h-icon-md` generates no CSS and its
`sources: 16` was stale; Task 6 named four SRS tables where there are three, and a column that
does not exist; Task 8's own test snippet omits the `ThemeProvider` without which
`PreferencesProvider` throws, and it sends you to an icon set this repo does not have.

**Codex unused since Task 2** (usage limit ~15:50 2026-09-23, reset 20:01); Tasks 3–8 are
Claude's, at the owner's instruction. A dispatch that dies partway writes no `-o` file — grep
`^ERROR: You.ve hit your usage limit` before diagnosing anything else.

Per task: the task's own tests red → green, `npx tsc --noEmit` 0, `npm run lint` 0 errors, full
`npm test -- --reporter=dot > <file>` exit 0 (read the file), and the task's named live gate or
Playwright spec (Claude runs Playwright; Codex never does).
