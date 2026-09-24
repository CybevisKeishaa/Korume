# Branch Run State

Branch `settings-review-fixes`, cut from `master` `1011dee` (the `settings-page` merge).

## Goal and scope

Fix the seven findings of the whole-branch review that `settings-page` skipped before merging.
Four tasks, one commit each. **No new features, no refactors beyond each fix's root cause.**

The review ran 2026-09-24 over `e44a4ea..1011dee` (120 files, +8077/-428) and every finding was
re-verified by Claude against `git show 1011dee:` before being written down here.

## Authorities

- The findings below are the authority for WHAT is broken; each was measured, not predicted.
- Rules: `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md` §8.
- Contracts the fixes must not break: `docs/superpowers/run-state/settings-page.md` on `master`.

## Accepted commits

| Task | Commit | Title | By |
| --- | --- | --- | --- |
| 1 | `57025c6` | `fix(srs): the review-frequency multiplier stops compounding` | Codex, Claude finished + committed |
| 2 | `0df92d6` | `fix(export): the data export reads every row, in pages` | Codex + one fix round, Claude committed |
| 3 | `8cc0cf4` | `fix(a11y): a preference save no longer costs a keyboard user their place` | Claude |
| 4 | `9481bde` | `fix(settings): a preference is read fresh, stored honestly, and never invented` | Claude |

**All seven findings are fixed.** ▶ Next: owner review on a `:3001` worktree server, then a
`--no-ff` merge.

⚠️ **Codex hit its usage limit mid-branch** (reset 2026-09-27) after Task 2's fix round, so Tasks
3 and 4 are Claude's — the same precedent the owner set on `settings-page`. Before that it stopped
**three times** on brief errors rather than working around them, which is the behaviour to keep
asking for: a single unique ordering column that does not exist on seven tables, two test files
that do not exist, and an existing test that encoded the very defect Task 1 was fixing.

⚠️ **Two mutation checks came back GREEN and exposed useless tests** — both caught only because
the check was run at all. Task 3's first test asserted focus directly, which **jsdom cannot see**:
probed, a disabled element keeps `document.activeElement` there, so the real proof had to move to
Playwright. Task 4c's storage assertion sat in `theme-provider.test.tsx` and called
`setReduceMotion` directly, bypassing the provider that held the bug.

## The seven findings

| # | Where | Defect | Task |
| --- | --- | --- | --- |
| 1 | `lib/srs/sm2.ts:100` | Review-frequency multiplier is folded into the PERSISTED interval, so it compounds every review | 1 |
| 2 | `lib/data/user-export.ts:39` | No pagination; PostgREST `max_rows = 1000` truncates the GDPR export silently, with a 200 | 2 |
| 3 | `lib/data/user-export.ts:56` | `.in(via.column, parentIds)` inlines up to 1000 UUIDs (~37 KB) into the request line | 2 |
| 4 | `components/ui/segmented-control.tsx:42` | `move()` focuses an option, then `disabled={saving}` blurs it — keyboard focus falls to `<body>` | 3 |
| 5 | `components/video-player/recorder.tsx:164` | `start`'s deps omit `preferences`, so the device gate reads a stale snapshot | 4 |
| 6 | `lib/data/preferences.ts:113` | A committed write whose follow-up read fails returns `DEFAULT_PREFERENCES` with a 200 | 4 |
| 7 | `components/providers/preferences-provider.tsx:52` | The OR'd `reduceMotion` is persisted, so the account's own `false` is unrecoverable on public pages | 4 |

### Measured evidence for #1 — the one that corrupts stored data

`lib/data/srs.ts:61` and `lib/data/mining.ts:162` persist `next.intervalDays`; lines 49 and 152
read it back as `state.intervalDays`. So `sm2.ts:100`'s multiplier is re-applied to an already
multiplied value. Replicating `reviewItem` at quality 5, seven reviews:

| | r1 | r2 | r3 | r4 | r5 | r6 | r7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `normal` (1.0) | 1 | 6 | 17 | 49 | 147 | 456 | 1459 |
| `relaxed` (1.4) | 1 | 8 | 31 | 126 | 529 | 2296 | **10286** |
| `more` (0.7) | 1 | 4 | 8 | 16 | 34 | 74 | 166 |

⚠️ The review agent's own figures were **wrong** (it said 98 days for `relaxed`, and that `more`
"collapses toward the 1-day floor" — it does not, because EF 2.6 > 1/0.7). The table above is
Claude's own simulation. Do not quote the agent's numbers.

## Contracts and decisions

- **#1's fix keeps `intervalDays` pure SM-2** and applies the multiplier only when computing
  `nextReviewAt`. The lapse branch returns before line 100 today and must keep doing so — a failed
  item comes back tomorrow whatever the preference says.
- **#4's fix is to stop disabling preference controls while saving**, not to restore focus after.
  `usePreferenceSave` already sequences responses (its rule 1) and rolls back to the last confirmed
  value (rule 3), so the `disabled` is cosmetic and costs a keyboard user their place. Measured:
  no test asserts a preference control is disabled while saving; every `toBeDisabled()` in
  `components/settings` belongs to a deletion/confirmation dialog and must stay untouched.
- **#7's fix stores the ACCOUNT value and derives the effective one.** `account || OS` stays the
  rule everywhere (spec §4.5, owner ruling 2026-09-23) — it moves from the storage layer to the
  read layer, so `themeInitScript` must OR with `matchMedia` too. `reduce-motion-toggle.tsx` stays
  untouched, per the `settings-page` contract.
- **#6's fix must not make `readPreferences` throw.** Engines and layouts call it on hot paths and
  depend on it swallowing; only the post-write read inside `updateMyPreferences` needs to fail loud.
- No new dependency. No migration: the feature merged 2026-09-23 and has never run outside local
  development, so there is no corrupted production data to repair.

## Verification

Per task: the task's own tests red → green, `npx tsc --noEmit` 0, `npm run lint` 0 errors, and the
full suite `npm test -- --reporter=dot` exit 0. `master` `1011dee` is **368 files / 3419 tests**.

⚠️ Every guard here is written over code that already exists, so none can fail first — each one is
**mutation-checked** instead: mutate, watch red, restore, report both outputs (`AGENTS.md` §7).
Restore byte-for-byte and verify with a hash.

⚠️ **`landing-page` + `route-error` fail 6 e2e tests and none is from this work.** Measured at
Task 4, not assumed: the motion changes were reverted in the working tree, rebuilt, and the same
6 failed identically. ⚠️ **They include the horizontal-scroll and reduce-motion-at-768 cases the
`settings-page` run state claimed that branch had FIXED** — that claim does not hold now. Three
`lesson-creation-jobs` failures also need `LESSON_CREATION_WORKER_ENABLED`. Do not chase any of
them here; they are a ticket of their own.

`settings.spec.ts` + `display-scale.spec.ts` are 11/11. ⚠️ `every control keeps its value across
a reload` failed once in a full run and passed standalone and on re-run — a flake, recorded rather
than hidden. Claude runs Playwright, never Codex, and checks `:3000` is free first (`L-017`).

## Working tree and environment

- Worktree `.worktrees/settings-review-fixes`; `.env.local` copied; `npm ci` exit 0.
- Never build or serve from the main checkout — the owner's dev server on `:3000` owns its `.next`.
- Codex cannot commit here (sandbox ACL on `.git/worktrees`): it implements and verifies, Claude
  reviews the diff, re-runs the gates and commits with `Co-Authored-By: Codex`.

- Owner: Claude

## Blockers

- None.

## Next actions

**All four tasks are committed and every one of the seven findings is fixed.** Nothing is merged.

▶ Next: **owner review** on a `:3001` server started from this worktree, then `--no-ff` merge.

A whole-branch review is worth running before that merge — skipping it is exactly what produced
this branch. Note what a reviewer should NOT re-litigate: the `data-reduce-motion` meaning (ruled
in Task 4, see its commit message), the decision not to add a migration (the feature has never run
outside local development), and the 6 pre-existing e2e failures measured above.
