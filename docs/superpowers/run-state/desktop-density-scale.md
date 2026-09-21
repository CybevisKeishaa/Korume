# Branch Run State

- Owner: Codex

## Goal and scope

Give the design system a real desktop density function so that every screen from here on is
correct at 1280 without browser zoom, and close the rule the remaining 27 desktop screens inherit.

`desktop-density-pass` (merged `296c9a4`) fixed four widths and left the symptom standing: the
owner still reads the app correctly only at browser zoom 90%. Measured on the post-merge server at
viewport 1280, `/vi/shadowing` gives a 666.7 px main column at 100% against 768.6 px at 90% — a
101.9 px gap, with 267 px more whole-page scrolling. The earlier branch closed about 27% of it.

In scope: the typography source of truth, a density function bounded to 1280-1440, and the
spacing / type / radius / layout / control / icon token layers, plus migrating Shadowing Hub and
Explore as calibration samples.

Out of scope: the `(marketing)`, `(auth)` and `(immersive)` route groups, which are drawn on a
1280 canvas and hold density at 1.0; the Auth + Error UX port, which is the branch after this one;
colour tokens; new breakpoints; and anything below 1280.

## Authorities

- `docs/superpowers/specs/2026-09-21-desktop-density-scale-design.md` — this branch's design,
  **approved by the owner 2026-09-21**. §3 holds the six owner rulings, §5 the mechanism and its
  browser verification, §6 the token table. Read it before touching any file.
- `docs/superpowers/plans/2026-09-21-desktop-density-scale.md` — the seven tasks in the owner's
  order, each with its files, its failing test and its commands. The plan argues from the spec;
  where they disagree, the spec wins and the disagreement gets reported, not reconciled silently.
- `AGENTS.md`, `.codex/docs/workflow.md` (§8 two-harness protocol), `docs/lessons.md`.
- `docs/superpowers/specs/2026-09-20-desktop-density-pass-design.md` — the superseded spec. Its §1
  claim that the 90% preference "is not a preference for smaller text" is the error this branch
  corrects; its §2 measurements remain sound and are reused.
- Figma `IwFHZDZdHW7qsSFiNbWrkd`, frames `149:2` (Shadowing hub) and `200:7705` (Explore), both on
  a 1536 canvas.

## Accepted commits

- `1d0f1ce` `refactor(type): one source of truth per typography rung, with a guard` — Task 1.
- `c89cc56` `fix(type): close the Task 1 review — guard scope, one re-roled site, the Explore card`.
- `bea1068` `feat(density): a bounded desktop density unit, with a per-group opt-out` — Task 2.

## Contracts and decisions

- **Reference viewport is 1440.** A frame dimension is normalized to 1440 before it becomes a
  token. Raw px is never copied from a frame into code.
- **Density function:** `--density-unit: clamp(0.0555556rem, calc(100vw / 1440), 0.0625rem)`, and
  every scaled token is `calc(N * var(--density-unit))` where N is the 1440 value. Bounded at both
  ends per owner ruling: 1.0 above 1440, 0.889 at and below 1280.
- **Both clamp bounds are in `rem` on purpose.** A bare `vw` unit would not answer the reader's own
  font-size preference (WCAG 1.4.4). Verified in Chrome at viewport 1422: `calc(28 * unit)` gives
  27.654 px at a 16 px root and 31.111 px at a 20 px root.
- **Scoping uses a custom property, not root font-size.** `rem` resolves against the root and is
  all-or-nothing per document; a custom property cascades and can be reset per route group.
- **The sidebar carve-out from `desktop-density-pass` is REVOKED** by owner ruling 2026-09-21.
  224 -> 199.11 at 1280; collapsed 68 -> 60.44, with a 44 px floor on interactive row height.
- **`caption` floors at 11 px / 16.5 px**; no other rung is raised because of it.
- **`--control-lg` reaches 39.11 px at 1280**, under the 44 px touch convention. Accepted: the rule
  is bounded to a pointer-driven desktop range and WCAG 2.5.8 requires 24 x 24.
- **No CSS `zoom` and no page-level override.** The two screens are calibration samples; the result
  must come from shared tokens and primitives.
- `decision-register.md` **P14** is untouched by this branch.

## Verification

Task 2's required handoff commands are recorded below. The branch gate additionally owes lint, build,
plus a production-build browser measurement of both screens at **1280 and 1440** against spec §6.

The spec's §5.2 mechanism check has been run and is recorded there with its command, so it is not
owed again unless the formula changes.

### Task 1, accepted — what still binds later tasks

Typography has one source of truth across `components/{layout,shadowing,ui,video}` and the two
shadowing routes. `components/ui/token-scale.test.ts` enforces it: full `FORBIDDEN` **plus** the
default-type rule, per tree, with a pinned source count each (15/25/12/9/2/4).

Claude's review found five things Codex and its `code-reviewer` did not. Three that still matter:

- **The Hub renders into `components/video`** — one import hop below the page
  (`hub-import-section` -> `VideoImportForm`; both it and `hub-library-section` ->
  `LessonCreationProgress`). Following a page's own imports misses it. Tree is scanned now.
- **`explore-lesson-card.tsx`: every rung is `caption` by owner ruling.** Caption's line box is
  18 px, so the eyebrow lost its own height/line-height and the summary went `h-9` -> `h-10`;
  interior `h-[196px]`, card `h-[308px]` — **measured**, read off the old e2e pin failing
  (`Expected: <= 300, Received: 308`), now pinned 306-310. The fixed-height model is Task 4 work:
  px heights cannot scale with `--density-unit`. `tracking-[1.04px]` is deliberately left.
- **`tests/e2e/shadowing-hub.spec.ts` had failed on `master` since 2026-09-19** — C4 removed the
  error string it pinned at `002f993`. C4 debt, fixed here only because it blocked this gate.
  Other Playwright assertions C4 touched are worth a look.

⚠️ **A text-scanning guard reads prose too** — a comment naming a banned class fails its own file.
⚠️ Claude edited this worktree once while the Owner line still read `Codex`. Recorded, not hidden.

## Working tree and environment

`.worktrees/desktop-density-scale`, cut from `master` at `42197a6`.

⚠️ **This worktree was created without two untracked files the main checkout has, and neither
failure looks like what it is.** Both fixed 2026-09-21:

- `node_modules` was a partial install with no `kuromoji` package, so
  `lib/japanese/{tokenizer,furigana}.test.ts` failed 11 tests on a missing dictionary file while
  the same 17 tests passed in the main checkout. Fixed by `npm install` here.
- `.env.local` was absent, so `npm run build && npm run start` died on `EnvValidationError`
  (APP_ENV, AI_PROVIDER, SPEECH_PROVIDER, EMAIL_PROVIDER) and Playwright reported only
  `Timed out waiting 120000ms from config.webServer` — no mention of the real cause. Copied from
  the main checkout; `.gitignore` line 29 (`.env.*`) keeps it out of the diff.

Both are worth knowing before Task 5, whose whole job is a production-build measurement from here.

⚠️ Three `next dev` servers were found running from the **main** checkout on ports 3000, 3001 and
3002, all sharing one `.next`. They overwrite each other's chunks: `:3000` returned
`Cannot find module './vendor-chunks/react-remove-scroll.js'` for `/vi/shadowing/explore` and a
transient `clientModules` TypeError elsewhere. Use one server, and do not trust a measurement taken
from a checkout that has more than one running. Unrelated to this diff; recorded because it cost an
hour of misattribution.

## Blockers

None. The owner approved the spec on 2026-09-21; the plan and the dispatch packet are written and
the branch is handed to Codex.

## Next actions

1. **Task 3 — convert the token layer.** The heaviest task: type, spacing, radius, layout, plus the
   new control and icon tokens, all as `calc(N * var(--density-unit))` per spec §6, plus
   `borderRadius.DEFAULT` by owner ruling. Spec §9 predicts pinned pixel assertions go red here;
   that is part of the task, not triage afterwards. A geometry assertion at a viewport >= 1440 must
   still pass — red there is a real regression.
2. Then Tasks 4, 5, 6, 7 in order. **Task 5 is the acceptance gate** and is the one the previous
   branch got wrong: grade against spec §1 (main column ~768 px at 1280), never against this
   branch's own arithmetic.
3. Claude dispatches one task per `codex exec` run and reviews each diff independently before the
   next. Both Task 1 and Task 2 shipped defects that Codex's own `code-reviewer` returned
   APPROVE/ADDRESSED on.

## Owner rulings, 2026-09-21 — both spec §9 open items are CLOSED

- **`borderRadius.DEFAULT` scales.** `DEFAULT: "calc(4 * var(--density-unit))"` in
  `tailwind.config.ts`; the whole radius scale moves as one. `none` and `full` stay literal.
  Asserted against the config text, not `globals.css`, because that is where the rung lives.
- **`button.tsx`'s `h-12` (48 px) does NOT scale.** No fourth control rung is added. The `lg`
  button holds 48 px while `sm` and `md` scale. That is the decision, not an oversight.
- **Claude drives the Task 2-7 loop.** The owner reviews at the end, not between tasks. Each cycle:
  Claude flips `- Owner: Codex` and dispatches one task to `codex exec`; Codex implements, reviews
  and checkpoints it, then flips the line back; Claude reviews that task's diff independently
  before the next one is dispatched. **One task per dispatch** — the Task 1 review found a defect
  in the plan itself, which a single end-to-end run would have propagated into every later task.

### Task 2 checkpoint

- Commit: `bea1068` `feat(density): a bounded desktop density unit, with a per-group opt-out`.
- Changed only the density declaration/reset, its three route-group attributes, and its contract test; no token value, colour token, `--text-hero`, `--layout-marketing-max`, breakpoint, or Task 3/4 file changed.
- Evidence:
  ```text
  RED — & 'C:\nvm4w\nodejs\npx.ps1' vitest run lib/design-tokens.test.ts -t "desktop density"
  ❯ lib/design-tokens.test.ts (40 tests | 2 failed | 37 skipped)
  Test Files  1 failed (1); Tests  2 failed | 1 passed | 37 skipped (40)
  GREEN — & 'C:\nvm4w\nodejs\npx.ps1' vitest run lib/design-tokens.test.ts
  ✓ lib/design-tokens.test.ts (40 tests); Test Files  1 passed (1); Tests  40 passed (40)
  npm run verify:protocol → Codex protocol: valid
  npx tsc --noEmit → exit 0 (no output)
  npm test -- --reporter=dot → Test Files  324 passed (324); Tests  3103 passed (3103); Duration 140.13s
  ```
- `code-reviewer`: APPROVE, no actionable findings. Deferred exactly as planned: token conversion and all Task 3+ work.

**Task 2 review (Claude).** The mechanism is right and placed right: `--density-unit` sits in the
foundation `:root` (globals.css:124), the reset at :306 outside `@layer`, and the three layouts
carry the attribute. Two findings, both "green while measuring nothing", both fixed:

1. **`bounds the rule to 1280-1440` never read the stylesheet.** It asserted
   `0.0555556 * 16 ≈ 1280/1440` — arithmetic on two literals copied into the test, which keeps
   passing while the CSS says something else. **Codex's own RED evidence showed it: 2 failed,
   1 passed, before the feature existed** — and `code-reviewer` still returned APPROVE. The bounds
   are now parsed out of `css`. Mutation-checked: `0.0555556rem` -> `0.05rem` fails it.
2. **Nothing asserted the three layouts carry `data-density="reference"`.** The reset rule existing
   proves only that the rule exists; deleting the attribute from all three files left the whole
   suite green while marketing, auth and immersive would silently start scaling at Task 3.
   New assertion reads the three files. Mutation-checked: removing it from the marketing layout
   fails it.

Gate after the review: `verify:protocol` 0 · `tsc` 0 · `npm test` **324 files / 3104 tests**.
