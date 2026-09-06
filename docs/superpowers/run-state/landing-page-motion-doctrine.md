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

## Working tree and environment

- `components/marketing/recommendation-donut.tsx` is pre-existing CRLF-only
  working-tree noise (`git diff --numstat` is empty).
- Untracked non-product configuration includes
  `.agents/skills/source-command-review-changes/SKILL.md`; `AGENTS.md` and the
  canonical `.codex` configuration are committed with the active-path switch.
- Windows PowerShell works with execution-policy bypass; Node/npm/npx/pwsh are
  unavailable on PATH in this Codex shell.

## Blockers

No blocker remains before Task 7.

## Next actions

`motion-engineer` owns Task 7 (§2 node assembly) next, following the task
brief in `docs/superpowers/plans/2026-09-04-landing-page-motion-doctrine.md`.
Task 7 must preserve Task 6's Hero-only progress contract and must not touch
the frozen pitch or capability-chain modules.

`code-reviewer` owns the whole-branch review required by `AGENTS.md` before
this branch merges.
