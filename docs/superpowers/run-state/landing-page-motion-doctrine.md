# Branch Run State

## Goal and scope

Branch: `landing-page-motion-doctrine`; base: `faa2cfd`.

Deliver the landing-page motion doctrine in
`docs/superpowers/plans/2026-09-04-landing-page-motion-doctrine.md`: distinct
section motion under the shared thread grammar, with the frozen pitch and
capability-chain modules left untouched.

## Authorities

- `AGENTS.md` and `docs/lessons.md` for repository law and operational learning.
- The motion-doctrine plan and its design spec for intended product work.
- `.superpowers/sdd/2026-09-04-landing-page-motion-doctrine/progress.md` for
  the task ledger; Git for commits and current-tree evidence.
- `.codex/docs/workflow.md` for the current coordinator protocol.

## Accepted commits

- Motion-doctrine Tasks 1–4 implementation and review range:
  `16d807f..11a2882`; `bcf3911` records the final Task 4 re-review approval.
- Task 5: `9f9df8a`.
- Task 6 implementation: `56808ed`; approved document-rest repair and
  reduced-motion coverage: `beddb27`, `78e69f2`.
- Task 7 node assembly and owner-accepted centre pulse: `c93d639`.
- Task 8 Journey learning conveyor: `bc1f232`.
- Task 9 Trust quiet lock: `6b0acc2`.
- Task 10 CTA invitation: `ad3400c`.
- Task 11 Signoff resolution: `3110580`, with review repair `496315a`.

## Contracts and decisions

- The hero is the only `ScrollProgress` consumer. Its video card consumes the
  Hero-only `--hero-scroll-progress` derivative with the `0.06` recession
  coefficient; generic `--section-progress` remains documented viewport
  travel for future section consumers. The derivative is zero at the Hero's
  document rest position and normalizes to one as the Hero leaves.
- The Task 5 reviewer mutation was restored manually, and the motion-doctrine
  plan was synced after plan-authored corrections.
- The Codex protocol migration is concurrent branch work; its plan is
  `docs/superpowers/plans/2026-09-05-codex-long-task-protocol.md`.

## Verification

- Task 6 is verified: focused scroll-progress unit coverage, a clean
  production build, the `recedes` Chromium e2e case, and real Chromium
  inspections at 1280×720 and 390×720 all passed. Reduced motion kept the
  card undistorted after scroll and set both progress properties to `0`.
  Its repair round was independently re-reviewed and approved.
- Task 4 switches the active instruction paths to lowercase `.codex`; the
  legacy tracked `.claude` runtime files are retained for possible future
  Claude use, but are not Codex's active instruction source. Its validator
  and path-sweep evidence are recorded with the active-path commit.
- Task 8 is verified: its TDD RED covered the missing `ThreadSegment` and
  independent section-3 pending gate; its focused suite is green; both the
  all-zero conveyor-index mutation and zero-delay mutation went RED and were
  restored. A fresh production build, Chromium renders at 1280px and 390px,
  normal-motion and reduced-motion e2e checks, and a fix-wave re-review all
  passed.
- Task 10 is verified: its focused CTA/design-token suites passed 45/45, the
  full landing-page Playwright suite passed 24/24 on a clean production build,
  and typecheck and lint completed (lint retains only baseline warnings). The
  reviewer approved the focus-visible escape that prevents the delayed primary
  action from becoming an invisible keyboard stop.
- Task 11 is verified: its source guard recorded RED before the resolution
  rules existed, passed focused at 37/37 after implementation, and proved RED
  for both a forbidden footer animation and a reintroduced `stroke-draw` before
  manual restoration. Typecheck, lint (baseline warnings only), and a clean
  production build completed. A final Chromium probe on the final build found
  the resolution path at completed dash offset with no path animation, its SVG
  container running `resolution-settle`, and reduced motion leaving Signoff copy
  visible with the footer mascot still. The task review required the anti-draw
  override; its scoped re-review approved the repair.

## Working tree and environment

- `components/marketing/recommendation-donut.tsx` is pre-existing CRLF-only
  working-tree noise (`git diff --numstat` is empty).
- Untracked non-product configuration includes
  `.agents/skills/source-command-review-changes/SKILL.md`; `AGENTS.md` and the
  canonical `.codex` configuration are committed with the active-path switch.
- Windows PowerShell works with execution-policy bypass; Node/npm/npx/pwsh are
  unavailable on PATH in this Codex shell.

## Task 7 checkpoint — owner accepted

- The owner approved a quiet, continuous centre pulse after the one-shot node
  assembly. It scales and brightens only the central flare/glow over a
  token-derived 4.8-second cycle; it does not travel around or reflow the
  constellation. The owner accepted the final visual; this checkpoint is
  committed with the Task 7 source and tests. The current 1280px production
  screenshot is `scratch/task-7-node-assembly-1280.png`.
- TDD recorded RED for the missing pulse keyframe and browser animation, then
  GREEN. Removing `infinite` temporarily made the pulse contract RED; restoring
  it made the focused test GREEN. The full design-token file is GREEN (33
  tests), a clean production build completed, and focused Playwright passed on
  the clean production server. Runtime inspection observed `problem-node-pulse`,
  a `4.8s` infinite cycle, and reduced motion collapsed to one `0.001ms` pass.
  The durable evidence is the machine-local
  `.superpowers/sdd/2026-09-04-landing-page-motion-doctrine/task-7-report.md`.
- During verification, an old Playwright server on port 3000 had survived while
  the generated `.next` cache was cleared. It returned 404s for hydration
  chunks: the SSR section stayed `pending`, `RevealScope` never mounted, and the
  failsafe released CSS after its delay. Browser diagnostics isolated that
  environmental state; stopping only that verified server and rerunning against
  the clean production server passed. No product code changed for it.

## Task 8 checkpoint: owner accepted

- The owner accepted the section-3 hand-off at a token-derived `300ms`
  duration, `90ms` stagger, and `12px` horizontal travel. The five cards hand
  off in semantic order; the eight journey-art glyphs remain still.
- Journey owns one local `line` `ThreadSegment`, while section 3 and section 7
  retain separate failsafe-gated pending rules. The production render confirmed
  the segment's `stroke-draw`, accent stroke, and non-scaling stroke at desktop
  and mobile widths. The inspected screenshots are
  `scratch/task-8-conveyor-1280-handoff.png` and
  `scratch/task-8-conveyor-390-handoff.png`.
- Task review initially required the missing segment, independent gate, and
  complete stagger guard. The fix wave was re-reviewed as **APPROVE**. The
  durable browser evidence was measured from the clean production build; no
  server remains running on port 3000.

## Task 9 checkpoint: reviewed and verified

- The Trust line is a presentational, absolute list child so its 600ms shared
  thread draw is not inherited from the recordings card's delayed opacity. It
  terminates at the existing recording lock without altering card geometry.
- The card sequence starts only after the thread: 600ms, 690ms, then 780ms.
  Focused Trust/design-token coverage passed 43/43; mutations covered the
  absent thread, incorrect pending visibility, and the timing relation.
- A fresh production build and Chromium inspection at 1280px and 390px passed:
  the thread aligns to the lock within 1px and overlaps its endpoint by 4px.
  Reduced motion rendered every card opaque; the existing 4-viewport
  reduced-motion e2e and normal scroll-completion e2e passed. The initial
  review found cards beginning before the thread; the fix wave was re-reviewed
  **APPROVE**. No server remains running on port 3000.

## Task 10 checkpoint: reviewed and verified

- The CTA now settles its backdrop, floats the companion orb and applies a
  restrained mascot breath. Its existing primary registration action reveals
  only after the thread-derived delay, while a presentational `ThreadSegment`
  continues below the invitation for the next section to resolve.
- TDD recorded RED for the missing continuation segment, gate, and exact
  timing relation; the data-marker and zero-delay mutations both went RED and
  were restored manually. A final browser regression freezes the delayed
  action at zero opacity, moves keyboard focus to it, and proves the
  focus-visible rule exposes it.
- Task review found the invisible-focus defect and an overly permissive timing
  assertion. Both fixes were independently re-reviewed **APPROVE**. No server
  remains running on port 3000.

## Blockers

Task 11 is reviewed and verified; no technical blocker remains.

## Next actions

Tasks 7-11 are checkpointed. The next action is Task 12 (whole-branch review
and lessons pass) in the next session.

Task 12 ownership, scope, and dependencies remain defined by
`docs/superpowers/plans/2026-09-04-landing-page-motion-doctrine.md`; read its
Task 12 section and direct dependency graph before starting the next session.

`code-reviewer` owns the whole-branch review required by `AGENTS.md` before
this branch merges.
