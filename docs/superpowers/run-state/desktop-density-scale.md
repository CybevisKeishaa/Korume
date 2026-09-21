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
- `35e3b9a` Task 5 measurement. `dbfff1d` + `081b47f` + review fix `97a3e8a` — Task 6. `2593b97` — Task 7.

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

### Task 5, measured 2026-09-21 — the branch reproduces the zoom-90% composition

Production builds, one fresh learner, branch `:3100` vs `master` `e921a67` `:3101`, headless (no
scrollbar). Zoom 90% at 1280 = a 1422 CSS viewport drawn at 0.9: **master@1422 × 0.9, screen px**.
Mechanism first: `calc(28 * var(--density-unit))` = **24.8889px** at 1280, **28px** at 1440.

| `/en/shadowing` | master 100% | master zoom 90% (screen px) | **branch 1280** |
|---|---|---|---|
| main column | 677.8 | 780.75 × 0.9 = **702.7** | **703.7** |
| rail | 266.2 | 305.25 × 0.9 = **274.7** | **275.0** |
| sidebar | 224 | 201.6 | 199.1 |
| scroll height | 2292 | 2328 × 0.9 = **2095** | **2087** |

Explore 1280: column 1000.0 vs 1110 × 0.9 = 999.0. `text-body` 12.4445 / `text-caption` **11**
at 1280 and 1300; 14 / 12 + sidebar 224 at 1440; `--control-lg` 39.11; 16 `min-h-hit-target` rows
44.00. Root 20px (set on `html`, not browser setting): `text-body` 15.56 — grows. Explore card:
308px frame, last row ends 289px (1280) vs 294px (1440); screenshot reads full. **No change owed.**

🚨 **Plan/spec §1: "≈768px at 1280" is in the wrong unit** — 768.6 / 300.6 / 2085 are CSS px of the
1422 zoom-90% viewport; no 1280 layout reaches them. In screen px (what the owner sees) the branch
is within 0.2% on column, rail and scroll. Fifth plan defect; spec §1 needs a unit column.

### Task 1, accepted — what still binds later tasks

Typography has one source of truth across `components/{layout,shadowing,ui,video}` and both
shadowing routes. `components/ui/token-scale.test.ts` enforces it: full `FORBIDDEN` plus the
default-type rule, per tree, with a pinned source count each (16/25/12/9/2/4).

- **The Hub renders into `components/video`**, one import hop below the page. Following a page's
  own imports misses it; the tree is scanned now.
- **`explore-lesson-card.tsx`: every rung is `caption` by owner ruling**; `h-[308px]` pinned 306-310.
- `tests/e2e/shadowing-hub.spec.ts` was red on `master` since 2026-09-19 (C4); fixed here.

⚠️ A text-scanning guard reads prose too — a comment naming a banned class fails its own file.
## Working tree and environment

`.worktrees/desktop-density-scale`, cut from `master` at `42197a6`.

`node_modules` (`kuromoji`) and `.env.local` repaired here 2026-09-21. Authenticated e2e and
browser measurement need Docker Desktop + `npx supabase start` (`:54321`), or register fails.

## Blockers
None.

## Next actions

1. **Done; whole-branch review closed (0 Critical), owner said merge.** Fixes `4238caa` + docs:
   spec §1 units, ruling 3.1 (1536 values ARE the 1440 values, no 0.9375), 3.5, §5.3 portals.
2. **Accepted gap (ruling 3.4 scope), owner told:** ~86 unmigrated files keep `text-sm/xs/lg`
   (14/12/18) beside scaled cards — e.g. profile's `text-lg` stat (18) outsizes its 17.78 title.
   Each screen port migrates its own. Toast viewport stays fluid (known).

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

`--density-unit` on `:root`, the `[data-density="reference"]` reset, the attribute on all three
out-of-scope layouts. Two tests were green while measuring nothing (one asserted literals copied into
the test; Codex's `code-reviewer` still said APPROVE); both rewritten and mutation-checked.

### Task 6 + 7, done by Claude 2026-09-21 — deviates from the plan, on purpose

Portaled `Dialog/Popover/Select/Tooltip` copy the nearest `data-density` onto their content via
`useDensityScope` (a hidden anchor + a content callback ref), instead of the plan's move-the-portal
(stacking context, remount; its test used a `DialogContent` API this repo lacks). Review found I1:
a mount-time effect read left a Select nested in an open-on-mount Dialog at fluid density — fixed
`97a3e8a`, RED-first. Browser 1280: body-level node with the attribute → `p-md` 16px vs 14.2222;
app-scope Explore dialog keeps fluid 21.33px. **Not handled, recorded:** the Toast viewport sits in
the locale layout, not portaled, so a toast fired in a reference group is fluid (review M2). **No
reference-group screen uses these four primitives today** (M3) — Auth + Error will be the first.
Task 7 corrected the plan's draft: `token-scale.test.ts` does not scan widths/heights.

**Gate at `97a3e8a`:** `tsc` 0 · `lint` 0 · `npm test` **324 / 3124** · build 0 · playwright hub +
explore + landing **29 pass / 3 fail** — the same three landing tests red on `master`.

### Task 4, accepted — the calibration screens carry tokens

Migration done: `button/input/select` on `h-control-*`, numeric spacing on the named scale across
the shell and both screens (`--icon-*` tokens exist but have no consumer yet), and the nav rows on
`min-h-hit-target`. `w-sidebar` needed no edit — it already resolves through the density-scaled
layout token, which is what a working token layer looks like.

**Codex stopped this task once and was right to.** The plan said the 44px floor was
`min-h-control-lg`; that renders **39.11px at 1280**, and spec §7 explicitly accepts `--control-lg`
falling below 44. A token that scales cannot express "never below 44px". `--hit-target-min:
2.75rem` now exists for it — unscaled, in `rem` so it still answers the reader's font size, absent
from the `[data-density]` block, and asserted to contain no `density-unit`. Third plan defect of
this branch, all three Claude's.

Claude finished it after Codex hit its ChatGPT quota, fixing a CTA on `min-h-control-lg` (would
have dropped 44→39.11px) and re-pinning a test's `h-10` as `h-control-md` (same 40px, a contract).

⚠️ **`tests/e2e/landing-page.spec.ts` has THREE tests failing on `master`** — h1, §3 keyboard
reachability, the §3 `#journey` thumbnail. Same lines on master; pre-existing, not fixed here.

⚠️ Claude committed `80876d8` with `git add -A`, sweeping in an untested red e2e guard.

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
