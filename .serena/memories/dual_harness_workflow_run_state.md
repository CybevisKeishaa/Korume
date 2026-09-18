# Dual-harness workflow (Claude + Codex) — 2026-09-19

**Status: committed on branch `dual-harness-workflow`, NOT merged.** None of it
is visible from `master`, including its own run-state. Worktree:
`.worktrees/dual-harness-workflow`. Commits `d991c1c`, `2ca7cdb`, `ca4ef1b`.

Canonical design:
`docs/superpowers/specs/2026-09-19-dual-harness-workflow-design.md` on that
branch. Canonical run-state:
`docs/superpowers/run-state/dual-harness-workflow.md`. This memory is a pointer.

## Why it exists

The owner now runs **both** Codex and Claude Code on this repository. The
2026-09-05 long-task protocol assumed a single runtime and its D1 retired the
tracked `.claude/` role and workflow files from the active path, for a sound
reason — `AGENTS.md` §6, one fact one home. That premise no longer holds, so
**D1 is superseded by D1a/D2a**. Every other decision in the 2026-09-05 spec
stands.

The migration had also been left half-applied since 2026-09-05: `fbef87d`
deleted the twelve `.claude/` files exactly as the approved spec directed, and
`7e31260` restored them twenty-three minutes later **without amending the spec
or the validator**. The restored copies dated from 2026-08-05 and so never
received the long-task protocol — `.claude/agents/code-reviewer.md` was still
telling a reviewer to read `CLAUDE.md` "all of it" after that file had become a
ten-line pointer holding no law, and still described the AI layer as a "Claude
wrapper" where `AGENTS.md` §3 requires a provider-agnostic port.

## What the branch establishes

- `.codex/` stays the **only** home of role, routing and procedure content.
- `.claude/` returns as a **runtime adapter only**: twelve stub files, each
  naming its `.codex/` counterpart and holding no fact of its own. The
  validator rejects a stub over 25 lines or missing its pointer, so "one fact,
  one home" now holds by construction rather than by discipline.
- The retired-`.claude/`-path rule is **replaced** by parity and stub rules;
  the noncanonical `.Codex/` casing rule is unchanged.
- Every branch run-state carries exactly one `- Owner: Claude|Codex` line. A
  handoff is the commit that changes that line; no worktree ever has two
  writers. The main worktree belongs to Claude, `.worktrees/<branch>` to Codex.
- **`npm run verify:protocol`** is the executable gate, required by the
  Definition of Done and before any owner handoff. It was previously
  `scripts/verify-codex-protocol.ps1`, correct but absent from `package.json`,
  CI and the DoD — and **red on `master`** with seven run-state heading
  violations that nobody had seen.

## Consequences for Codex

- Once this merges, a branch whose run-state uses non-canonical headings fails
  the gate. `c4-lesson-creation-jobs` needed exactly that repair (`bb72328`).
- Branches cut before this one fail the parity check purely because they
  predate the stubs; merging `master` in resolves it.
- Division of labour: Codex implements; Claude owns architecture, specs, task
  packets and the whole-branch review before merge.

## Review debt

Claude wrote and self-reviewed the whole branch, which the asymmetric review
rule does not cover. It has not been independently reviewed.

Related: `mem:codex_long_task_protocol_run_state`,
`mem:c4_lesson_creation_jobs_run_state`.
