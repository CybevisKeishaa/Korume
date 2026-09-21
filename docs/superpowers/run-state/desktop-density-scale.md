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

Not yet run. The branch gate is `npm run verify:protocol` 0, tsc 0, `npm test`, lint, `next build`,
plus a production-build browser measurement of both screens at **1280 and 1440** against spec §6.

The spec's §5.2 mechanism check has been run and is recorded there with its command, so it is not
owed again unless the formula changes.

### Task 1 checkpoint (accepted)

- RED: `npx vitest run components/ui/token-scale.test.ts` failed in `app-nav.tsx`, all nine named
  `components/shadowing` sources, and `shadowing/explore/page.tsx`; it also exposed real shared-shell
  consumers in `mobile-app-handoff.tsx` and `notification-bell.tsx`, which were migrated rather than
  excluded from the layout scan.
- GREEN: `npx vitest run components/ui/token-scale.test.ts components/layout components/shadowing
  "app/[locale]/(protected)/(app)/shadowing"` passed: 21 files, 178 tests. The final focused guard
  passed: 70 tests.
- Mutation checks: restoring `text-sm` in `AppNav` made the guard fail on `app-nav.tsx`; the SHA-256
  restore matched its backup. Renaming `mobile-app-handoff.tsx` made the layout source-count assertion
  fail 8 vs 9; restoring it returned the guard to green.
- Review: `code-reviewer` first required exact source counts for filesystem-collected sets; the guard
  now pins 15 UI, 25 marketing, 12 shadowing, 9 layout, and 2 shadowing-route sources. Scoped re-review:
  ADDRESSED, no new Critical or Important finding.

## Working tree and environment

`.worktrees/desktop-density-scale`, cut from `master` at `42197a6`.

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

1. Task 2 defines the density unit and reference-group reset under TDD, then receives a per-task
   `code-reviewer` review and checkpoint.
2. Task 5 is the acceptance gate and is the one the previous branch got wrong. The acceptance
   number is the owner's zoom-90% composition (main column ~768 px at 1280), measured on a
   production build with exactly one server — never a number derived from this branch's own
   arithmetic.
3. Codex sets `- Owner: Claude` when the branch gate is green. Claude then reviews the whole branch
   from `git diff master...desktop-density-scale` in the main worktree and merges `--no-ff`.

## Open decisions for the owner

- **`borderRadius.DEFAULT` (4 px, ~25 call sites)** stays a literal in this branch. It was deferred
  out of `desktop-density-pass` by owner ruling and scaling it is a change that ruling did not
  authorize (spec §9). If the owner rules it in, it is one line:
  `DEFAULT: "calc(4 * var(--density-unit))"`.
- **`button.tsx`'s `h-12` (48 px)** has no rung in spec §6.5 and is left unscaled. Adding
  `--control-xl` would be an implementer changing the spec.
