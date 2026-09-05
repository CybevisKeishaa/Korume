# Codex Long-Task Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `.codex/` the sole versioned active agent system and give every long-running branch one compact, evidence-backed run state that a fresh Codex session can resume safely.

**Architecture:** The migration establishes canonical Codex role and workflow files, a bounded run-state document per branch, and fixed task-packet/handoff templates. A PowerShell validator checks only durable protocol structure and live instruction paths; Git and the run state remain the evidence for actual branch work.

**Tech Stack:** Markdown, TOML, PowerShell 7+, Git, existing Vitest/Playwright verification commands.

**Spec:** `docs/superpowers/specs/2026-09-05-codex-long-task-protocol-design.md`

## Global Constraints

- Active agent configuration lives only under lowercase `.codex/`; do not create `.Codex/` paths.
- Preserve Git history; delete only the tracked Claude runtime files named in this plan after all active references are migrated.
- `AGENTS.md` and `docs/lessons.md` remain mandatory first reads for every agent.
- A run state is branch state, not a lesson log or a copy of its spec/plan; it stays below 200 lines.
- Every non-trivial task must carry exact verification status. Never record a command as passing unless its output was observed.
- Reviewer instructions must forbid `git stash`, `git reset`, and `git checkout`; reviewer mutations are restored by editing the original file and reading it back.
- Product source, database migrations, and user data are out of scope.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `.codex/agents/*.toml` | Eight canonical Codex role definitions with a common context-loading and handoff contract. |
| `.codex/docs/workflow.md` | Canonical routing, build-order, checkpoint and review workflow. |
| `.codex/commands/build-layer.md` | Codex-first layer orchestration prompt. |
| `.codex/commands/new-module.md` | Codex-first vertical-slice orchestration prompt. |
| `.codex/commands/review-changes.md` | Read-only reviewer invocation prompt. |
| `.codex/commands/create-task-packet.md` | Template for bounded specialist work. |
| `.codex/commands/checkpoint-branch.md` | Template for a compact branch run-state checkpoint. |
| `docs/superpowers/run-state/README.md` | Run-state authority, limits, and update contract. |
| `docs/superpowers/run-state/TEMPLATE.md` | Required headings and exact compact handoff shape. |
| `docs/superpowers/run-state/landing-page-motion-doctrine.md` | Current branch's grounded state, not a transcript. |
| `scripts/verify-codex-protocol.ps1` | Read-only structural validator for active protocol paths and run-state headings. |
| `scripts/verify-codex-protocol.test.ps1` | Isolated fixture checks proving the validator fails for a missing required artifact and a retired live path. |
| `AGENTS.md` | Points exclusively to canonical Codex workflow/commands and adds the long-task checkpoint rule. |

The tracked `.claude/agents/`, `.claude/commands/`, and `.claude/docs/workflow.md` files are removed in Task 4 after the active-reference sweep. They are historical runtime configuration, not dated product records; Git preserves their provenance.

---

### Task 1: Add a tested protocol validator

**Files:**
- Create: `scripts/verify-codex-protocol.ps1`
- Create: `scripts/verify-codex-protocol.test.ps1`

**Interfaces:**
- Produces: `pwsh -NoProfile -File scripts/verify-codex-protocol.ps1 [-Root <path>]`
- Exit `0` means the root has canonical active paths and every run-state file has the required headings; exit `1` writes one or more concrete violations.
- The validator ignores `README.md` and `TEMPLATE.md` below `docs/superpowers/run-state/`.

- [ ] **Step 1: Write the isolated failing validator tests**

Create `scripts/verify-codex-protocol.test.ps1`. It must create a temporary fixture under `$env:TEMP`, populate the minimum protocol tree, and invoke the validator with `-Root`. Include these assertions, using a helper that throws when `$LASTEXITCODE` differs from the expected result:

```powershell
& $validator -Root $validRoot
if ($LASTEXITCODE -ne 0) { throw "valid protocol fixture failed" }

Remove-Item -LiteralPath (Join-Path $validRoot '.codex/agents/test-engineer.toml')
& $validator -Root $validRoot
if ($LASTEXITCODE -eq 0) { throw "missing role was accepted" }

Set-Content -LiteralPath (Join-Path $validRoot 'AGENTS.md') -Value 'Read .claude/docs/workflow.md'
& $validator -Root $validRoot
if ($LASTEXITCODE -eq 0) { throw "retired Claude path was accepted" }
```

The fixture's valid `AGENTS.md` must reference `.codex/docs/workflow.md`; its run state must contain all headings listed in Step 3. Clean only the explicit temporary fixture path in a `finally` block.

- [ ] **Step 2: Run the test before implementation**

Run: `pwsh -NoProfile -File scripts/verify-codex-protocol.test.ps1`

Expected: failure because `scripts/verify-codex-protocol.ps1` does not exist.

- [ ] **Step 3: Implement the validator**

Create `scripts/verify-codex-protocol.ps1` with this public shape:

```powershell
[CmdletBinding()]
param(
  [Parameter()]
  [string] $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$requiredRoles = @(
  'ai-engineer', 'backend-engineer', 'code-reviewer', 'database-engineer',
  'frontend-engineer', 'motion-engineer', 'tech-lead', 'test-engineer'
)
$requiredHeadings = @(
  '# Branch Run State', '## Goal and scope', '## Authorities',
  '## Accepted commits', '## Contracts and decisions',
  '## Verification', '## Working tree and environment',
  '## Blockers', '## Next actions'
)
```

Resolve `$Root` once. Accumulate violations instead of exiting at the first one. Validate:

1. `AGENTS.md`, `.codex/docs/workflow.md`, and every expected
   `.codex/agents/<role>.toml` exist;
2. `AGENTS.md`, `.codex/docs/workflow.md`, `.codex/agents/*.toml`, and
   `.codex/commands/*.md` contain neither `.claude/` nor `.Codex/`;
3. each non-template `docs/superpowers/run-state/*.md` is at most 200 lines
   and includes every required heading exactly once; and
4. each run-state filename is lowercase kebab-case plus `.md`.

Print every violation with its relative path. Exit `1` when the collection is
non-empty; otherwise print `Codex protocol: valid` and exit `0`. The script
must not write into the target root.

- [ ] **Step 4: Run both failure and success paths**

Run: `pwsh -NoProfile -File scripts/verify-codex-protocol.test.ps1`

Expected: exit `0`; the test must observe the valid fixture accepted, then each
of the two deliberate invalid states rejected.

- [ ] **Step 5: Commit the validator task**

```bash
git add scripts/verify-codex-protocol.ps1 scripts/verify-codex-protocol.test.ps1
git commit -m "test(agent): validate Codex long-task protocol"
```

---

### Task 2: Establish canonical Codex workflow and command templates

**Files:**
- Add: `.codex/agents/ai-engineer.toml`
- Add: `.codex/agents/backend-engineer.toml`
- Add: `.codex/agents/code-reviewer.toml`
- Add: `.codex/agents/database-engineer.toml`
- Add: `.codex/agents/frontend-engineer.toml`
- Add: `.codex/agents/motion-engineer.toml`
- Add: `.codex/agents/tech-lead.toml`
- Add: `.codex/agents/test-engineer.toml`
- Create: `.codex/docs/workflow.md`
- Create: `.codex/commands/build-layer.md`
- Create: `.codex/commands/new-module.md`
- Create: `.codex/commands/review-changes.md`
- Create: `.codex/commands/create-task-packet.md`
- Create: `.codex/commands/checkpoint-branch.md`

**Interfaces:**
- Consumes: existing role responsibilities in `.claude/agents/*.md` and routing rules in `.claude/docs/workflow.md`.
- Produces: one Codex-only active source of role, routing, task-packet, checkpoint, and review instructions.

- [ ] **Step 1: Extend the validator fixture for command and workflow paths**

Update `scripts/verify-codex-protocol.test.ps1` to add all five command files
to the valid fixture. Remove `checkpoint-branch.md` in one copied fixture and
assert the validator rejects it. Update the validator's required file list to
include those command paths.

- [ ] **Step 2: Run the new fixture before changing configuration**

Run: `pwsh -NoProfile -File scripts/verify-codex-protocol.test.ps1`

Expected: failure because the validator does not yet require the five commands.

- [ ] **Step 3: Create the canonical workflow and commands**

Copy the current routing/build-order content into `.codex/docs/workflow.md`,
then add these protocol sections:

```markdown
## Long-task protocol

For a multi-task branch, the coordinator creates and maintains exactly one
`docs/superpowers/run-state/<branch>.md`. Before dispatching or resuming, read
AGENTS.md, docs/lessons.md, that run state, the cited task-plan section, and
the direct dependency graph only. Checkpoint after every accepted task and
before a new owner, review/fix round, user decision, or external verification.
```

Every `.codex/agents/*.toml` `Read first` section must name `AGENTS.md`,
`docs/lessons.md`, `.codex/docs/workflow.md`, and the active run state. Keep
each role's existing responsibility and boundary text; add only the shared
context/handoff contract.

Create the three migrated command files by replacing `CLAUDE.md` and
`.claude/...` references with `AGENTS.md` and `.codex/...`. `review-changes.md`
must state: reviewer is read-only and may not run `git stash`, `git reset`, or
`git checkout`.

`create-task-packet.md` must produce headings `Goal`, `Non-goals`, `Owner`,
`Review owner`, `Authorities`, `Files and dependency graph`, `Contracts`,
`Verification`, `Known environment`, and `Required handoff`.

`checkpoint-branch.md` must instruct the coordinator to update the one branch
run-state file from Git status, actual command output, and accepted commits;
it must forbid copying full reports or lessons into that file.

- [ ] **Step 4: Extend and run the validator**

Require the five command files in `scripts/verify-codex-protocol.ps1`, then
run:

```bash
pwsh -NoProfile -File scripts/verify-codex-protocol.test.ps1
pwsh -NoProfile -File scripts/verify-codex-protocol.ps1
```

Expected: fixture tests pass. The repository-level validator may still fail
until Tasks 3 and 4 supply the run state and update active references; record
that incomplete state rather than calling it green.

- [ ] **Step 5: Commit the canonical configuration task**

```bash
git add .codex scripts/verify-codex-protocol.ps1 scripts/verify-codex-protocol.test.ps1
git commit -m "feat(agent): establish Codex workflow and task templates"
```

---

### Task 3: Add the compact run-state contract and migrate the active branch

**Files:**
- Create: `docs/superpowers/run-state/README.md`
- Create: `docs/superpowers/run-state/TEMPLATE.md`
- Create: `docs/superpowers/run-state/landing-page-motion-doctrine.md`

**Interfaces:**
- Consumes: `.codex/docs/workflow.md`, the current branch's Git history,
  `docs/superpowers/plans/2026-09-04-landing-page-motion-doctrine.md`, and its
  SDD ledger.
- Produces: a ≤200-line resume authority with the headings enforced by Task 1.

- [ ] **Step 1: Write a failing repository-level validation check**

Run: `pwsh -NoProfile -File scripts/verify-codex-protocol.ps1`

Expected: failure because `docs/superpowers/run-state/` has no branch run-state
file or because required headings are absent.

- [ ] **Step 2: Create README and template**

`README.md` must define the authority split: run state = current branch facts;
plan = intended work; Git = changed work; lessons = durable process learning.
It must say a run state is not a diary and must be ≤200 lines.

`TEMPLATE.md` must use exactly this structure so the validator and agents agree:

```markdown
# Branch Run State

## Goal and scope
## Authorities
## Accepted commits
## Contracts and decisions
## Verification
## Working tree and environment
## Blockers
## Next actions
```

- [ ] **Step 3: Ground the motion-doctrine run state from evidence**

Create `landing-page-motion-doctrine.md` using `git log`, `git status`, the
motion-doctrine plan, and its SDD ledger. Record only facts needed to resume:

- branch `landing-page-motion-doctrine`, base `faa2cfd`, and its motion-doctrine
  scope;
- accepted Task 1–4 range and Task 5 commit `9f9df8a`;
- Task 6 commit `56808ed`, explicitly marked **implemented but not test/build/
  browser validated in this Codex shell because Node/npm are unavailable**;
- the Task 5 reviewer mutation was restored manually and the plan was synced;
- pre-existing `components/marketing/recommendation-donut.tsx` CRLF-only
  working-tree noise and any still-untracked non-product configuration reported
  by the current `git status` (Task 2's `.codex` commit is not described as
  untracked);
- the next owner/action: review and browser-validate Task 6, including the
  1280px and 390px camera coefficient, before Task 7; and
- the known requirement to run the whole-branch review before merge.

Do not write test totals, commit counts, or a copied SDD narrative. Cite
symbols and document paths, not cross-file line numbers.

- [ ] **Step 4: Run the repository validator and line-cap check**

Run:

```bash
pwsh -NoProfile -File scripts/verify-codex-protocol.ps1
(Get-Content docs/superpowers/run-state/landing-page-motion-doctrine.md).Count
```

Expected: validator still reports only active Claude/case-variant references
until Task 4; the line-count command returns no more than 200.

- [ ] **Step 5: Commit the run-state task**

```bash
git add docs/superpowers/run-state
git commit -m "docs(agent): checkpoint landing-page motion doctrine"
```

---

### Task 4: Switch active instructions to Codex and retire Claude runtime files

**Files:**
- Modify: `AGENTS.md`
- Modify: `.codex/docs/workflow.md`
- Modify: `.codex/agents/*.toml`
- Modify: `docs/superpowers/run-state/landing-page-motion-doctrine.md`
- Delete: `.claude/agents/*.md`
- Delete: `.claude/commands/build-layer.md`
- Delete: `.claude/commands/new-module.md`
- Delete: `.claude/commands/review-changes.md`
- Delete: `.claude/docs/workflow.md`

**Interfaces:**
- Consumes: canonical Codex configuration from Task 2 and run-state contract from Task 3.
- Produces: no active instruction references to Claude or `.Codex/` and no duplicated active runtime source.

- [ ] **Step 1: Write a failing active-reference audit**

Run this PowerShell audit before editing. It must enumerate each result rather
than reporting only a count:

```powershell
Get-ChildItem -Force AGENTS.md,.codex -Recurse -File |
  Select-String -Pattern '\.claude/|\.Codex/' |
  Select-Object Path,LineNumber,Line
```

Expected: at least the `.Codex/docs/workflow.md` references in `AGENTS.md` and
the `.Codex/...` `Read first` references in agent TOMLs appear.

- [ ] **Step 2: Update root and role instructions**

In `AGENTS.md`, make `.codex/agents/`, `.codex/docs/workflow.md`, and
`.codex/commands/` the active paths. Add a concise long-task rule to §8:
multi-task branches require one run state, and dispatch/resume reads it before
the task plan and direct dependency graph.

In the workflow and every role TOML, replace case-variant `.Codex/` paths with
lowercase `.codex/`, include `docs/lessons.md` and the run state in `Read first`,
and preserve the role boundaries.

Update the branch run state in the same task so its working-tree section no
longer calls `AGENTS.md` or the Codex configuration untracked after this commit.

- [ ] **Step 3: Delete only retired active Claude configuration**

Before deletion, read `git diff -- .claude` and `git status --short .claude` to
confirm no user work exists there. Then run only these explicit targets:

```bash
git rm .claude/agents/*.md .claude/commands/build-layer.md \
  .claude/commands/new-module.md .claude/commands/review-changes.md \
  .claude/docs/workflow.md
```

Do not remove personal Claude data outside the repository. Git history is the
archive for these retired tracked instruction files.

- [ ] **Step 4: Run the complete active-reference and protocol checks**

Run:

```bash
pwsh -NoProfile -File scripts/verify-codex-protocol.ps1
git grep -nE '\.claude/|\.Codex/' -- AGENTS.md .codex
```

Expected: validator prints `Codex protocol: valid`; `git grep` exits `1` with
no matches. The grep result is a positive assertion only when paired with the
validator's required-artifact checks.

- [ ] **Step 5: Commit the migration task**

```bash
git add AGENTS.md .codex docs/superpowers/run-state scripts
git commit -m "refactor(agent): make Codex the active workflow"
```

---

### Task 5: Prove a fresh resume and review the migration

**Files:**
- Modify: `docs/superpowers/run-state/landing-page-motion-doctrine.md` only if the resume check discovers a factual omission.
- Review: range from the commit before Task 1 through `HEAD`.

**Interfaces:**
- Consumes: validator, canonical role/workflow docs, current branch run state, and current Git state.
- Produces: evidence that a fresh coordinator can name the next action without Claude transcripts.

- [ ] **Step 1: Run the full protocol verification**

Run:

```bash
pwsh -NoProfile -File scripts/verify-codex-protocol.test.ps1
pwsh -NoProfile -File scripts/verify-codex-protocol.ps1
git status --short --branch
git log --oneline faa2cfd..HEAD
```

Expected: both PowerShell commands exit `0`. Record the actual working-tree
output exactly enough to distinguish expected pre-existing dirtiness from new
protocol changes.

- [ ] **Step 2: Perform a clean-context resume simulation**

Act as a fresh `tech-lead` with only these inputs:

1. `AGENTS.md`;
2. `docs/lessons.md`;
3. `.codex/docs/workflow.md`;
4. `docs/superpowers/run-state/landing-page-motion-doctrine.md`; and
5. the cited Task 6 plan section plus `git status` and the latest commits.

Write a short report answering: current goal, Task 6's exact verification gap,
known unrelated dirtiness, next owner, and the next action. Compare each claim
to the run state and Git. If a required fact is absent, update the run state in
a documentation-only fix and rerun the validator; otherwise do not edit it.

- [ ] **Step 3: Request a code-reviewer verdict**

Give the reviewer the design spec, this plan, the full migration diff, and the
Task 5 simulation report. It must check one-fact/one-home, accidental removal
outside the explicit Claude runtime list, case portability, validator coverage,
run-state truthfulness, and the reviewer safety rule. It must not edit files.

- [ ] **Step 4: Address findings and re-run verification**

For each accepted finding, update the named canonical file, rerun both
PowerShell validators and the active-reference sweep, then update the run state
only if branch facts changed. Do not append a lesson unless this work produces
new evidence that belongs in an existing `docs/lessons.md` entry.

- [ ] **Step 5: Commit any review fix and record the reviewer outcome**

```bash
git add AGENTS.md .codex docs/superpowers/run-state scripts docs/lessons.md
git commit -m "fix(agent): address Codex protocol review"
```

Do not create this commit if review finds no changes; record the approval in
the run state checkpoint instead.
