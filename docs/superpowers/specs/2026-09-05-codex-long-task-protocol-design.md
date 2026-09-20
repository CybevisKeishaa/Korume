# Codex Long-Task Protocol Design

**Status:** Implemented, partly superseded
**Superseded by:** D1a and D2a of `2026-09-19-dual-harness-workflow-design.md`

> ⚠️ **D1 below is reversed. Do not act on it.** This document was implemented,
> and then its central decision was overturned: two harnesses now work this
> repository, not one. `.claude/` is **live** — it holds adapter stubs that the
> Claude Code harness requires and that `npm run verify:protocol` enforces.
> Every clause that calls `.claude/` retired, that forbids a live instruction
> from pointing at it, or that asks the validator to reject such a pointer, is
> **no longer the rule**, and each is marked below.
>
> What survives unchanged: the lowercase `.codex/` canonical root, one compact
> run state per active branch (D2, now extended with an `- Owner:` line), and
> the executable validator. The current rule is `AGENTS.md` §8 and
> `.codex/docs/workflow.md` §8.

## Goal

Make Korume's agent workflow Codex-first and durable across long tasks whose
total work exceeds a single model context window. The protocol must let a fresh
Codex agent resume a branch from version-controlled evidence without reading a
full conversation, an entire Claude session, or every repository document.

## Context

The repository already has eight role definitions ported to
`.codex/agents/*.toml`, but they are untracked. The active workflow is still
described in `.claude/docs/workflow.md`, while `AGENTS.md` points to the
nonexistent `.Codex/docs/workflow.md`. The mismatch leaves the role files,
routing rules, and task handoff state without one durable, reviewable home.

Agent contexts are working memory, not project memory. A long branch must
therefore preserve its compact current state in Git and use targeted task
packets for specialists. Serena memories remain useful discovery aids, but are
not the authority for active branch state because they are not versioned with
the code they describe.

## Decisions

### D1 — Codex is the sole active agent runtime — ❌ REVERSED 2026-09-19

> **Reversed by D1a of `2026-09-19-dual-harness-workflow-design.md`.** Two
> harnesses are active. The canonical-root half of this decision stands; the
> sole-runtime half does not. The table below is still correct — `.codex/` is
> the only home of every fact — but `.claude/` is no longer retired: it is a
> live adapter tree of stubs that hold no fact of their own.

The canonical active configuration root is lowercase `.codex/`. Lowercase is
intentional for portability: Windows treats `.Codex` and `.codex` as the same
directory while Linux does not.

The active homes are:

| Fact | Canonical home |
| --- | --- |
| Root law and Definition of Done | `AGENTS.md` |
| Codex role definitions | `.codex/agents/*.toml` |
| Routing, handoff and branch workflow | `.codex/docs/workflow.md` |
| Reusable human-invoked procedures | `.codex/commands/` |
| Product requirements | `japanese-learning-app-spec.md` and product docs it names |
| Operational lessons | `docs/lessons.md` |
| Current state of one long-running branch | `docs/superpowers/run-state/<branch>.md` |
| Detailed feature design and executable task plan | `docs/superpowers/specs/` and `docs/superpowers/plans/` |

~~The tracked Claude role files and workflow are retired from the active path in
the migration. Git history remains the archive; no live instruction may point
to them.~~ ❌ **No longer the rule.** `.claude/agents/`, `.claude/commands/` and
`.claude/docs/workflow.md` are live adapter stubs, capped at 25 lines and
required to name their canonical `.codex/` counterpart; `AGENTS.md` and
`CLAUDE.md` point at them deliberately. Personal Claude session history outside
the repository is read-only provenance, never a required runtime dependency.

### D2 — One compact run state per active branch

Every multi-task branch has exactly one tracked run-state file:
`docs/superpowers/run-state/<branch>.md`. It is the authority for **what is
true now** on that branch; plans are the authority for **what remains designed**;
Git is the authority for **what changed**.

The file is a handoff index, not a diary. It may not duplicate prose from a
spec, plan, lesson, or commit. It must stay below 200 lines and contain only:

1. branch, base commit, goal, scope and explicit non-goals;
2. authoritative document paths and the current task identifier;
3. accepted commits and their one-line outcomes;
4. exposed contracts or decisions a later task depends on;
5. exact verification commands and their observed status, including known
   environment limitations;
6. pre-existing working-tree dirtiness, if any;
7. blockers or user decisions still required; and
8. the next one to three atomic actions, each naming its owner and files.

An accepted task updates this file in the same commit as its implementation,
or in an immediately following documentation-only checkpoint commit. A failed
review, abandoned mutation, failed command, or changed environment fact is
recorded before another agent is dispatched.

### D3 — Context is loaded by role and task, not by habit

Every active Codex role receives this minimum reading order:

1. `AGENTS.md` and `docs/lessons.md`;
2. the current branch run state;
3. only the cited design/plan section and task packet;
4. files named by the task and their direct import/consumer graph; and
5. the current diff when reviewing or integrating.

It must not load full Claude transcripts, all Serena memories, or unrelated
specifications merely because they exist. A broad fact needed by several
branches belongs in Serena's project memory; a fact that changes with a branch
belongs in that branch's run state.

At a context checkpoint, the coordinator re-grounds from the run state, the
current Git status, and the latest relevant commit before acting. This makes a
new conversation equivalent to a controlled handoff rather than a guess.

### D4 — Specialists receive bounded task packets

The coordinator creates a task packet for every non-trivial specialist slice.
It contains:

- objective and non-goals;
- owner and review owner;
- source-of-truth document sections;
- exact files/symbols in scope and direct dependencies;
- input/output contracts;
- TDD or mutation-check expectations;
- verification commands and any known environmental limitation; and
- the required handoff fields.

One packet produces one reviewable outcome. A specialist may widen scope only
after documenting the dependency evidence and returning it to the coordinator.
It never silently absorbs a second subsystem to avoid a handoff.

Use a specialist when a task owns a clear module or can run independently. Do
not spawn agents for small read-only questions or a one-file edit whose context
is already local. More agents without narrower packets multiplies context cost
and contradictions rather than reducing either.

### D5 — Handoffs and reviews have fixed evidence shapes

Every implementer handoff states:

1. changed files and why;
2. contracts produced or consumed;
3. commands actually run with observed result;
4. mutations attempted and restored, where required;
5. known dirtiness, risks, or unverified work; and
6. next owner and one exact next action.

The code reviewer receives the task packet, run state, relevant Git range, and
the changed files. It reviews only; it never uses stash/reset/checkout and
restores any mutation by editing the original content back. The reviewer must
separate evidence-backed findings from unverified concerns. A branch still
requires the whole-branch review in `AGENTS.md` before merge.

### D6 — Checkpoint policy for tasks larger than one context

The coordinator checkpoints after every accepted task and before any of these
boundaries:

- switching owner or subsystem;
- requesting a user decision;
- starting a review/fix round;
- beginning a browser, build, migration, or external-service verification; or
- when the active conversation has accumulated enough detail that re-reading
  the current task packet is cheaper and safer than recalling it.

For an expected 300k-token effort, the coordinator decomposes it into roughly
6–15 independently reviewable task packets. The number is not a quota: a task
is split when it has more than one independently rejectable deliverable or
would require a successor to reconstruct decisions from chat history.

## Migration

> ⚠️ This migration ran in 2026-09-05 and is history. Steps 2 and 5 were
> **partly undone** on 2026-09-19 and are annotated below. Do not replay them.

1. Add the current `.codex/agents/*.toml` files to Git and make their
   `Read first` sections point only to canonical Codex paths.
2. Move the active workflow content from `.claude/docs/workflow.md` to
   `.codex/docs/workflow.md`, update `AGENTS.md`, and ~~remove active Claude
   role/workflow configuration~~ **reduce it to adapter stubs** so no fact has
   two live homes. ❌ The files were deleted here and **restored as stubs** on
   2026-09-19; deleting them again breaks the Claude Code harness.
3. Add `docs/superpowers/run-state/README.md` and a compact run-state template.
4. Add task-packet and handoff templates under `.codex/commands/`; templates
   describe an artifact shape and do not become a second state store.
5. Add a small PowerShell validator that checks canonical paths, required role
   files, required run-state headings, and that no active instruction still
   points to ~~`.claude/` or~~ `.Codex/`. ❌ The `.claude/` half of this rule
   was **removed** on 2026-09-19 and replaced by the stub cap and pointer
   checks; re-adding it would fail the tree on `AGENTS.md` itself.
6. Migrate the current `landing-page-motion-doctrine` branch into one run-state
   file using its Git commits and SDD ledger as evidence. Do not copy the full
   ledger.
7. Simulate a fresh resume: a new coordinator reads only the required inputs,
   reports the next action, and is checked against the run state and Git.

## Acceptance criteria

- The repository has one versioned ~~Codex-only~~ **canonical `.codex/`** source
  for active role and workflow instructions. ❌ "Codex-only" no longer holds:
  `.claude/` carries adapter stubs that name that source and add nothing to it.
- A fresh agent can identify the current branch goal, verified state, known
  dirtiness, and next owner by reading no more than `AGENTS.md`, lessons, one
  run state, and its task packet.
- The validator fails when a required protocol artifact is absent or a live
  instruction references ~~retired Claude/~~case-variant Codex paths. ❌ The
  Claude half is reversed: the validator now *requires* the `.claude/` stubs and
  checks their cap and pointers instead of forbidding references to them.
- The current motion-doctrine branch has a run state that matches its Git
  history and does not claim unrun tests as passing.
- Existing product source, migrations, and user data are untouched.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Run state becomes a second long spec | 200-line cap; references replace copied prose. |
| Run state drifts from code | update at each accepted task; resume simulation re-derives Git facts. |
| More agents increase coordination overhead | specialist packets must be independently reviewable and scoped. |
| Legacy Claude instructions survive as live authority | validator scans active Codex docs and `AGENTS.md`; Git remains the archive. |
| A reviewer mutates a dirty tree | reviewer rule forbids Git-mutating commands; file state is read back after each mutation. |
