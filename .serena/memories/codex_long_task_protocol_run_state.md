# Codex long-task protocol — historical checkpoint 2026-09-05

> **Historical record.** This memory records the Codex protocol migration and its
> 2026-09-06 resume note. Its old product next-action text below is not current:
> the landing motion branch has since completed Tasks 7–12 and is merge-ready.
> Use `docs/superpowers/run-state/landing-page-motion-doctrine.md` and Git for
> the current branch state.

## Resume correction — 2026-09-06

This protocol migration remains complete. Its former product next action is
superseded: Task 6 has since been repaired, production/browser-verified, and
task-reviewed on `landing-page-motion-doctrine` (`beddb27`, `78e69f2`, then
canonical-run-state checkpoint `f05fa5f`). The owner paused before Task 7;
no Task 7 implementation was dispatched. Resume from the canonical
`docs/superpowers/run-state/landing-page-motion-doctrine.md`, then its Task 7
plan/spec dependencies. Node is available only through the explicit nvm4w path
recorded in the motion memory; Playwright 1.61.1 plus Chromium is already
installed. Do not follow the old Task 6 resume instruction below.

## Current branch
- Branch: `landing-page-motion-doctrine`; nothing merged or pushed by this session.
- Canonical current-state file: `docs/superpowers/run-state/landing-page-motion-doctrine.md`.
- Protocol design: `docs/superpowers/specs/2026-09-05-codex-long-task-protocol-design.md`.
- Protocol plan: `docs/superpowers/plans/2026-09-05-codex-long-task-protocol.md`.
- SDD ledger: `.superpowers/sdd/2026-09-05-codex-long-task-protocol/progress.md` (machine-local/ignored).

## Completed in this session
The Codex long-task protocol migration is complete and reviewed:
- `aabbeff` — canonical `.codex/agents`, workflow, and five command templates; validator requires them.
- `d857ece` — compact run-state README, template, and branch state.
- `fbef87d` — `AGENTS.md` made Codex-active and active paths changed to lowercase `.codex`.
- `64e0278` — validator requires a non-template branch run state.
- `9702be1` — fixture coverage for missing run-state directory and template-only directory.
- `115a5bb` — `CLAUDE.md` reduced to a non-normative pointer, README points to AGENTS/.codex, and run-state next actions name owners/files.
- `7e31260` — user decision applied: restored the 12 tracked `.claude` agents/commands/workflow files exactly. They are retained for future Claude use and are not Codex active source.
Earlier product commit `56808ed` implements the hero scroll-linked camera push (coefficient `0.06`), but is not validated in this shell.

## Verification
Windows PowerShell commands passed:
- `scripts/verify-codex-protocol.test.ps1` → exit 0, including deliberate missing-role, retired-path, noncanonical-path, missing-command, missing-directory, template-only, and empty-state rejections.
- `scripts/verify-codex-protocol.ps1` → `Codex protocol: valid`, exit 0.
- Active Codex path audit has no `.claude/` or `.Codex/` matches under canonical active files.
- Final whole protocol migration review: APPROVE after the fixes above.
`pwsh`, Node, npm, npx are unavailable on PATH. Do not claim Task 6 build/e2e/browser validation from this shell.

## Current worktree
Only known unrelated dirtiness remains:
- `components/marketing/recommendation-donut.tsx` — pre-existing CRLF-only noise.
- `.agents/skills/source-command-review-changes/SKILL.md` — untracked local skill.
Do not revert either. `.claude` is intentionally tracked and restored.

## Next resume action
Use the canonical run-state and `.codex` protocol. The next product owner is `motion-engineer`: validate Task 6 files from commit `56808ed` at 1280px and 390px, verify the `0.06` camera coefficient and reduced-motion behavior, and run relevant build/e2e checks when Node/browser tooling is available. Then `code-reviewer` must perform the required whole-branch review before merge.
Related historical motion decisions remain in `mem:landing_page_motion_doctrine_run_state`; this memory records the newer Codex protocol/current-session checkpoint.

## Owner working agreement — 2026-09-09

The owner expects proactive, compact handoffs. At each screen/task boundary,
report without waiting to be asked: (1) what has landed, (2) whether the
branch is review/merge-ready, (3) the exact visual, copy/message, Figma, or
product decision that needs owner review, and (4) the next action. When the
owner approves, complete the required review and verification gates, commit
and merge locally when authorized, then report the resulting commit and any
remaining scoped follow-up. Keep the worktree tidy; do not make the owner
reconstruct status from questions.
