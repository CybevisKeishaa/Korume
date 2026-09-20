# Branch Run State

## Goal and scope

Branch: `dual-harness-workflow`; base: `c02568d`.

Let Claude Code and Codex work this repository at the same time. Claude owns
architecture, specs, task packets and pre-merge review; Codex owns
implementation. Readmit `.claude/` as a runtime adapter that holds no fact of
its own, and make the protocol gate executable so it cannot be forgotten again.

No product source, migration, or user data is in scope.

## Authorities

- `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md`.
- `docs/superpowers/specs/2026-09-19-dual-harness-workflow-design.md` (this branch).
- `docs/superpowers/specs/2026-09-05-codex-long-task-protocol-design.md` — D1 is
  superseded by D1a/D2a; every other decision in it stands.

## Accepted commits

- `d991c1c` — the whole change as one unit: adapter stubs, validator rules and
  test, run-state repairs and `- Owner:` lines, `npm run verify:protocol`,
  `AGENTS.md` §8/§9, `.codex/docs/workflow.md` §8, `CLAUDE.md`, and the lessons
  merged into L-026 and L-004.
- `2ca7cdb` — this run state.
- `ca4ef1b` — `landing-page-motion-doctrine.md` said the branch awaited merge
  when it was already merged; corrected, and its `- Owner:` line added.

## Contracts and decisions

- `.codex/` stays the only home of role, routing and procedure content.
- `.claude/agents/*.md`, `.claude/commands/*.md` and `.claude/docs/workflow.md`
  are adapter stubs: at most 25 lines, each naming its canonical counterpart.
  The validator rejects a stub that grows content or loses its pointer.
- The retired-`.claude/`-path rule is replaced by parity and stub rules. The
  noncanonical `.Codex/` casing rule is unchanged.
- Every branch run state carries exactly one `- Owner: Claude|Codex` line. A
  handoff is the commit that changes it; no tree ever has two writers.
- The main worktree belongs to Claude; Codex works in `.worktrees/<branch>`.
- `npm run verify:protocol` gates handoff and merge.

## Verification

- RED first: the extended validator test failed at the new `D2a` assertion
  (`AGENTS.md naming the adapter directory was wrongly rejected. Expected exit
  0, got 1.`) while every pre-existing assertion still passed.
- GREEN after the validator change: `npm run verify:protocol:test` exits 0, and
  each new rule fired for the right reason — oversized stub `found 34`, missing
  pointer, owner `found 0`, unknown owner `found 0`, two owners `found 2`.
- Stub encoding was verified against repository convention: no BOM (`2d2d2d`),
  CRLF, em-dash `e2 80 94`. A first generation pass was discarded because
  PowerShell 5.1 wrote a BOM and double-encoded the em-dash.
- Mutation-checked against the real tree, not only fixtures: growing
  `.claude/agents/frontend-engineer.md` to 41 lines went RED (`found 41`), and
  deleting the `- Owner:` line here went RED (`found 0`). Both were restored
  from bytes and re-verified by SHA-256, and the tree returned to exit 0.
- Full gates in this worktree: `npm run verify:protocol` 0, `npm run
  verify:protocol:test` 0, `npm run typecheck` 0, `npm run lint` 0 (baseline
  warnings only), `npm test` 2745/2745 across 307 files.
- The first full run showed 12 kuromoji failures. They were environmental: a
  fresh worktree has no dependencies. An initial hypothesis that an empty
  `node_modules` blocked upward resolution was tested and disproved — removing
  it did not help, because kuromoji derives its dictionary path from the
  working directory. `npm ci` fixed it and left `package-lock.json` unchanged.
- Baseline before this branch: `verify-codex-protocol.ps1` failed on `master`
  with seven run-state heading violations. It was absent from `package.json`,
  CI and the Definition of Done.

## Working tree and environment

- Owner: Claude
- Isolated worktree `.worktrees/dual-harness-workflow`, created from `master` at
  `c02568d`.
- The root worktree has an unrelated modified `.serena/project.yml`; untouched.
- Windows PowerShell 5.1; the validator is invoked with an execution-policy bypass.

## Blockers

None.

## Next actions

Merged to `master` with `--no-ff` on 2026-09-20 on the owner's instruction,
after the independent whole-branch review this branch had been waiting for.
Branch kept, nothing pushed. This file is history, not a resume point.

The review ran `code-reviewer` against the staged merge and mutation-tested the
validator. It returned one Critical — the 2026-09-05 design still instructed the
`.claude/` deletion this branch reverses — which was fixed in the merge commit.
Four Important findings say the validator is weaker than `CLAUDE.md`,
`.codex/docs/workflow.md` §8 and the design claim it is: the stub `description:`
is duplicated byte-for-byte and unguarded, enforcement is a hardcoded 21-name
allowlist rather than a property of the tree, `.claude/docs/workflow.md` is
treated as a stub but not required, and the run-state heading rule — the only
rule with demonstrated field value — has no negative test. **All four are open
as of this commit** and are the next work on `master`. Until they close, four
documents describe a guard stronger than the one that runs: re-read the
validator before trusting any claim about what it enforces.
