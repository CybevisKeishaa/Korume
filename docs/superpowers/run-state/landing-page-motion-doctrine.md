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
- Task 6: `56808ed`.

## Contracts and decisions

- The hero is the only `ScrollProgress` consumer. Its video card consumes
  `--section-progress` with the `0.06` recession coefficient.
- The Task 5 reviewer mutation was restored manually, and the motion-doctrine
  plan was synced after plan-authored corrections.
- The Codex protocol migration is concurrent branch work; its plan is
  `docs/superpowers/plans/2026-09-05-codex-long-task-protocol.md`.

## Verification

- Task 6 is implemented, but has not been test-, build-, or browser-validated
  in this Codex shell because Node/npm are unavailable on PATH.
- Task 4 switches the active instruction paths to lowercase `.codex` and
  retires the tracked Claude runtime files; its validator and path-sweep
  evidence are recorded with that task's commit.

## Working tree and environment

- `components/marketing/recommendation-donut.tsx` is pre-existing CRLF-only
  working-tree noise (`git diff --numstat` is empty).
- Untracked non-product configuration includes
  `.agents/skills/source-command-review-changes/SKILL.md`; `AGENTS.md` and the
  canonical `.codex` configuration are committed with the active-path switch.
- Windows PowerShell works with execution-policy bypass; Node/npm/npx/pwsh are
  unavailable on PATH in this Codex shell.

## Blockers

Task 6 needs a real browser render at 1280px and 390px plus its relevant
test/build verification before the motion plan may advance to Task 7.

## Next actions

`motion-engineer` reviews and browser-validates Task 6 before Task 7 begins:
`app/[locale]/(marketing)/page.tsx`, `app/globals.css`,
`components/marketing/hero-video-card.tsx`, `components/marketing/hero.tsx`,
`components/marketing/section.tsx`,
`docs/superpowers/plans/2026-09-04-landing-page-motion-doctrine.md`, and
`tests/e2e/landing-page.spec.ts`. Validate the hero camera push at 1280px and
390px, including the `0.06` coefficient.

`code-reviewer` owns the whole-branch review required by `AGENTS.md` before
this branch merges.
