# Dual-Harness Workflow Design

**Status:** Approved
**Supersedes:** D1 of `2026-09-05-codex-long-task-protocol-design.md`
("Codex is the sole active agent runtime")

## Goal

Let Claude Code and Codex work the same repository at the same time without
either corrupting the other's tree or the instruction layer drifting apart.
Claude owns architecture, specs, task packets and pre-merge review. Codex owns
implementation. Neither premise of the 2026-09-05 protocol is discarded except
the single-runtime assumption.

## Context

The 2026-09-05 protocol chose one runtime and retired the tracked Claude role
and workflow files from the active path, so that no fact would have two live
homes (`AGENTS.md` §6). That reasoning was sound. Its premise was not: the
repository now runs two harnesses.

The migration was also left half-applied. On 2026-09-05, `fbef87d` deleted the
twelve `.claude/` files as the spec directed; twenty-three minutes later
`7e31260` restored them verbatim without amending the spec or the validator.
The restored copies date from 2026-08-05 and therefore never received the
long-task protocol: multi-task handoff, `docs/lessons.md`, and run state are
all missing from them, and `.claude/agents/code-reviewer.md` still instructs a
reviewer to read `CLAUDE.md` "all of it" — a file that is now a ten-line
pointer holding no law. A harness reading those files is told the wrong
architecture, including "Claude wrapper" where `AGENTS.md` §3 requires a
provider-agnostic port.

`scripts/verify-codex-protocol.ps1` exists and is correct, but nothing runs it.
It is absent from `package.json`, from CI, and from the Definition of Done. It
fails on `master` today: `shadowing-explore-c3.md` and `shadowing-hub-plan-c2.md`
carry renamed headings (`## Decisions and contracts`, `## Completed checkpoints`,
`## Historical next actions`). A guard nobody runs is the failure mode this
design must close, not repeat.

## Decisions

### D1a — Two harnesses, one instruction layer

`.codex/` stays the single canonical home of every role brief, routing rule and
reusable procedure. `AGENTS.md` stays the root law.

`.claude/` is readmitted to the active path as a **runtime adapter only**. It
exists because Claude Code cannot load `.toml` role definitions and needs its
own frontmatter (`tools`, `model`) to route a subagent. It may hold no fact of
its own. Every file under `.claude/agents/` and `.claude/commands/` is a stub
that names its `.codex/` counterpart and defers to it.

"One fact, one home" is preserved by construction, not by discipline: the
validator rejects any `.claude/` file large enough to hold content.

### D2a — The retired-path rule is replaced, not dropped

The rule forbidding live instructions from naming `.claude/` is removed,
because it now forbids describing the real system. It is replaced by parity and
stub rules that catch the drift the old rule only approximated. The
case-variant rule (`.Codex/`) is unchanged and still enforced.

### D3a — One worktree, one owner, at one time

The main worktree (`japan-web/`, `master`) belongs to Claude. Codex works in
`.worktrees/<branch>`. Ownership is a fact recorded in the branch run state as
a single `- Owner: Claude|Codex` line, and a handoff is the commit that changes
that line. There is no implicit handoff, and no tree ever has two writers.

Claude seeds a feature branch (spec, plan, task packets) inside that branch's
worktree while it owns it, then hands the worktree to Codex. `master` only
ever receives completed, reviewed work.

### D4a — Review is asymmetric and evidence-bearing

Codex runs `code-reviewer` per task. Claude runs the whole-branch review before
merge, reading `git diff master...<branch>` from the main worktree; review never
requires a checkout and never edits code. Findings return to Codex to fix.
This preserves `docs/lessons.md` L-011.

### D5a — The protocol gate is executable

`npm run verify:protocol` runs the validator. It is part of the Definition of
Done and of every handoff: no branch changes owner or merges while it is red.

## Migration

1. Rewrite the twelve `.claude/` files as stubs pointing into `.codex/`; add
   the two missing command stubs (`create-task-packet`, `checkpoint-branch`).
2. Replace the retired-path check with parity and stub checks; keep the
   case-variant check. Extend the validator test first, and watch it fail.
3. Require a single `- Owner:` line in every branch run state; add it to
   `TEMPLATE.md` and to the three existing run states.
4. Repair the two run states whose headings were renamed, preserving their
   content under the canonical headings.
5. Add `verify:protocol` to `package.json`; cite it in `AGENTS.md` §9 and in
   the handoff protocol of `.codex/docs/workflow.md`.
6. Record the two-harness protocol in `.codex/docs/workflow.md` §8.

## Acceptance criteria

- `npm run verify:protocol` exits 0 on this branch, and the validator test
  exits 0, including a deliberate failure for a `.claude/` file that grew
  content and for a run state missing `- Owner:`.
- Every `.codex/agents/*.toml` and `.codex/commands/*.md` has a stub peer, and
  every file under `.claude/agents`, `.claude/commands` and `.claude/docs` has a
  canonical counterpart. Both directions are enumerated from the tree.
- No `.claude/` file contains role or workflow content.
- Every rule in the validator has a test that goes red when the rule is removed.
- A fresh Claude session reaches `AGENTS.md` and `.codex/docs/workflow.md`
  without reading any stale instruction.
- Product source, migrations, and user data are untouched.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Stubs regrow into a second home | validator caps stub lines and bytes and requires the pointer; test asserts each failure. |
| Parity check passes on an empty glob | both trees are enumerated, not named; the test asserts a minimum size (8 roles, 5 commands) and an empty directory fails. |
| Owner line is stale rather than wrong | handoff is a commit; review checks the line against `git log`. |
| Readmitting `.claude/` reopens the drift D1 closed | the one field both harnesses route on — `description` — is compared against the canonical file, so it cannot drift silently. Prose inside a stub is bounded, not compared: a stub can still be wrong in under 4096 bytes without the validator saying so. |
| Validator stays unrun again | it is an npm script inside the Definition of Done and the handoff gate. |
