# type-normalization — run state pointer (updated 2026-10-14, 3rd session)

▶ **Branch `type-normalization`**, worktree `.worktrees/type-normalization`, base master `c648bff0`. ⭐ **MERGED → master `365def8a`** 2026-10-14 (owner approved all owner calls; not pushed).

## Where it is
- COMPLETE. 12 tasks + final whole-branch review (5 Important fixed `82113a17`) + T11 before/after `4e48adfb`;
  owner approved and merged. Full E2E: only AI-off env reds (summary :29, shadowing-intelligence :159 vs
  `AI_PROVIDER=gemini`). `type-baseline` worktree removed; SDD workspace deleted; branch/worktree kept.
- Guards on master: `lib/typography-scan.test.ts`, `lib/typography-allowlist.ts`, `tests/e2e/typography.spec.ts`
  (L-051/L-052 + AGENTS.md §6 rule). Every later port must keep both green.

## Standing rules
- Spec `docs/superpowers/specs/2026-10-14-type-normalization-design.md`, plan
  `docs/superpowers/plans/2026-10-14-type-normalization.md`; subagent-driven, Claude alone.
- Subagents never use Serena (bound to the main checkout).
- Stop anything on :3000 before `npm run test:e2e` unless the run deliberately reuses a server built from THIS
  worktree; never build in the main checkout.
- Owner calls queued for T11 are listed in the ledger; never shrink type back on our own.
