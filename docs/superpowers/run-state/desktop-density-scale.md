# Branch Run State

- Owner: Claude

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
- `41aa819` `feat(density): every scale authored at 1440 and scaled through one unit` — Task 3. Then `442c140` (opt-out fix), `80876d8` (hit-target token), `9663935` (Task 4).

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

Typography has one source of truth across `components/{layout,shadowing,ui,video}` and both
shadowing routes. `components/ui/token-scale.test.ts` enforces it: full `FORBIDDEN` plus the
default-type rule, per tree, with a pinned source count each (15/25/12/9/2/4).

- **The Hub renders into `components/video`**, one import hop below the page. Following a page's
  own imports misses it; the tree is scanned now.
- **`explore-lesson-card.tsx`: every rung is `caption` by owner ruling.** Card is `h-[308px]` —
  **measured**, read off the old e2e pin failing — now pinned 306-310. Its fixed-height interior
  still does not scale; Task 5 must measure whether that reads wrong at 1280.
- **`tests/e2e/shadowing-hub.spec.ts` had failed on `master` since 2026-09-19** (C4 removed the
  error string it pinned). Fixed here only because it blocked this gate.

⚠️ A text-scanning guard reads prose too — a comment naming a banned class fails its own file.

## Working tree and environment

`.worktrees/desktop-density-scale`, cut from `master` at `42197a6`.

`node_modules` and `.env.local` were repaired here on 2026-09-21 (missing `kuromoji` and runtime
env respectively). For Task 5, use one server only: three main-worktree dev servers previously
shared `.next` and produced invalid chunks.

## Blockers

Git worktree metadata is read-only in this session: `git commit` cannot create
`.git/worktrees/desktop-density-scale/index.lock` despite no lock or Git process.

## Next actions

1. **Task 5 — the acceptance gate, and Claude does it.** Production build, ONE server, measure
   `/vi/shadowing` and `/vi/shadowing/explore` at 1280 and 1440. Grade against spec §1 — main
   column ~768 px at 1280, rail ~300 px, scroll ~2085 px, `text-body` 12.44, `text-caption` 11
   floored — never against this branch's own arithmetic. Re-run the spec §5.2 mechanism check
   first; if the unit is not reaching the page, every number after it is worthless.
2. **Known risk to measure, not to guess:** `explore-lesson-card.tsx` still sets its heights in px
   (`h-[308px]`, `h-[196px]`, two `h-10` rows). Its type scales, its frame does not, so at 1280 the
   card may read empty. Deliberately left for Task 5 to measure with numbers in hand.
3. Then Task 6 (portal containers) and Task 7 (write the rule into `adaptive-layouts.md`).
4. Claude dispatches one task per `codex exec` and reviews each diff independently. Tasks 1-4 each
   shipped a defect Codex's own `code-reviewer` had approved, and three of the four were defects in
   the PLAN.

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

### Task 2, accepted at `bea1068` — what still binds

`--density-unit` in the foundation `:root`, the `[data-density="reference"]` reset outside
`@layer`, the attribute on all three out-of-scope layouts. Two of its tests were green while
measuring nothing and were rewritten: one asserted arithmetic on literals copied into the test
instead of reading the stylesheet (**Codex's own RED evidence showed it — 2 failed, 1 passed,
before the feature existed — and `code-reviewer` still said APPROVE**), and nothing checked that
any layout carried the attribute. Both mutation-checked now.

⚠️ Neither of those tests, nor the reset itself, was enough: see the Task 3 CRITICAL below. The
opt-out needs its second half.

### Task 4, accepted — the calibration screens carry tokens

Migration done: `button/input/select` on `h-control-*`, numeric spacing on the named scale across
the shell and both screens, icon sizes on `size-icon-*`, and the nav's three interactive rows on
`min-h-hit-target`. `w-sidebar` needed no edit — it already resolves through the density-scaled
layout token, which is what a working token layer looks like.

**Codex stopped this task once and was right to.** The plan said the 44px floor was
`min-h-control-lg`; that renders **39.11px at 1280**, and spec §7 explicitly accepts `--control-lg`
falling below 44. A token that scales cannot express "never below 44px". `--hit-target-min:
2.75rem` now exists for it — unscaled, in `rem` so it still answers the reader's font size, absent
from the `[data-density]` block, and asserted to contain no `density-unit`. Third plan defect of
this branch, all three Claude's.

Claude finished the task after Codex hit its ChatGPT usage limit mid-run (reset 16:49), and found
two things in the handed-over tree:

- `explore-preview-drawer.tsx` used `min-h-control-lg` where the map says `min-h-hit-target` —
  it would have lowered that CTA's target from 44px to 39.11px. Fixed.
- `explore/page.test.tsx` pinned `h-10` on the search field. Updated to `h-control-md`: the same
  40px expressed as the rung, a contract change, not a loosened threshold.

⚠️ **`tests/e2e/landing-page.spec.ts` has THREE tests failing on `master`** — one h1 assertion,
§3 keyboard reachability, and a `#journey` image that never becomes visible. Verified by running
the same three in the main checkout on master: identical failures, identical lines. Pre-existing
debt, not this branch, and not fixed here. Second batch of stale e2e found on this branch after
the C4 string.

⚠️ Claude committed `80876d8` with `git add -A`, which swept up a red e2e guard Codex had left in
the tree, and did not run the e2e before committing. It goes green with this task.

**Gate:** `verify:protocol` 0 · `tsc` 0 · `npm test` **324 files / 3112 tests** · `lint` 0 errors ·
`playwright` hub + explore + landing **29 passed, 3 failed — all three red on master too**.

### Task 3, accepted at `41aa819` — and the CRITICAL it inherited

All 38 derived tokens match spec §6 exactly; the seven non-scaling exceptions are the documented
ones; `borderRadius.DEFAULT` scales per owner ruling; the one pinned assertion it changed is a real
contract change. Codex's handoff commit died on `index.lock` (GitHub Desktop holds it).

🚨 **The density opt-out did nothing.** A `var()` inside a custom property is substituted on the
element that DECLARES it, so every `:root` token resolved against `:root`'s unit and inherited a
finished length. Measured in Chrome at 1280: inside the reference scope `var(--space-md)` rendered
**14.2222px**, not 16px, while a direct `calc(16 * var(--density-unit))` rendered 16px. Marketing,
auth and immersive would have shipped ~11% small — the landing page among them.

Fixed at `442c140`: a `[data-density]` block re-declares all 38 derived tokens on the scope
element. Re-measured: fluid `14.2222 / 12.4445`, reference `16 / 14`, `16px` three levels deep.
Spec §5.3 carries the correction.

**Why it survived two reviews:** every test involved asserted CSS TEXT and attribute presence, and
both were correct the whole time. Two guards now — a set-equality test over the two token lists,
and `tests/e2e/landing-page.spec.ts`, which **measures a computed value in a browser**.
Mutation-checked: renaming the `[data-density]` selector fails it with
`Expected "14px", Received "12.4445px"`.

⚠️ Claude restored a mutation with `git checkout --` and destroyed its own uncommitted fix. Edit a
mutation back; never `git restore` while one is in flight.
