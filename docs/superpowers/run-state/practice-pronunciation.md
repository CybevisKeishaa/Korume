# Branch Run State

Branch `practice-pronunciation`, worktree `.worktrees/practice-pronunciation`, base master `03a3b400`.

## Goal and scope

B1 of the Shadowing practice modes: the shared practice frame + Pronunciation (Part 2), with its Summary, Dashboard
and Mission changes. Listening Practice (Part 3) is B2 `practice-listening`, branched after this one merges.

## Authorities

- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md` (L-051, L-052).
- Spec `docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md` — sections approved by the owner in
  conversation 2026-10-15; written spec approved after review round 1 (owner: "Viết plan đi", 2026-10-15).
- Plan `docs/superpowers/plans/2026-10-15-practice-pronunciation.md` (15 tasks) — approved by the owner 2026-10-15; execution: subagent-driven, authorized by the owner 2026-10-17.

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| spec | approved after review round 1 (lease token, pre-201 guard, hint unit, unscored trigger, D25) | `d278843a`, `f8580170` |
| 1 | DB gates, isolated fresh chain, compatibility, lease/ownership mutations; task + fix reviews APPROVE | `5698c58a`, `d0e3ecbb` |
| 2 | WAV parser, audio regression, boundary mutations, TypeScript/lint; fix review APPROVE | `10c01022`, `c8414bd3` |

## Contracts and decisions

- Owner decisions D1–D25 are in spec §2. Gates by branch in spec §9.
- Ruling (2026-10-17): AGENTS §6 overrides Task 1's duplicate function definitions: edit
  `lesson_summary_evidence` in migration 043 and `practice_activity` in 045 in place; migration 047
  owns only new objects. Apply those canonical function definitions to the existing local DB without
  resetting owner data. A fresh-reset gate requires a separate isolated database; report it as unmet
  if that isolation cannot be established (L-050).
- Task 1 ownership test was corrected under AGENTS §7/L-004: the foreign session is unscored and
  unleased; removing ownership produced the intended failure. Separate fix review approved it.
- Task 2 ruling: spec §4.3/AGENTS input validation overrides the sample parser's early success.
  Verify RIFF/chunk extents and finish the bounded chunk walk before admitting the uploaded bytes;
  accept valid metadata, reject truncated or ambiguous chunks. This tightens admission for malformed
  files; the app's existing PCM encoder remains supported.

## Verification

- Task 1 accepted after task and fix reviews. Evidence and command outputs:
  `.superpowers/sdd/2026-10-15-practice-pronunciation/task-1-report.md` and its cited logs.
- Pre-migration recount 2026-10-17: shadowing `208|0|0` (total/webm/unscored), dictation `107|0`
  (total/unscored). Legacy score dumps before/after match SHA-256
  `C83D9F9D68FC5B9375BC22BD7C6D0920BA7DD70E3537148CDA3A06DC4DED2950`.
- Practice, Summary, Dashboard, erasure and shadowing live gates passed, including two-session
  scoring and existing parallel gates. Both stale-token mutations failed at the intended guard;
  restoring the canonical definitions returned the gates to green.
- Full product migration chain and gates passed on an isolated disposable DB with an empty public
  schema. Down/up and transactional rollback checked there; disposable DB removed. Owner DB was
  not reset.
- Worktree dependencies installed from lockfile. Typecheck, lint (warnings), protocol, and reruns of
  the dependency-affected suites passed. Initial full suite failed from missing installed dependencies;
  a final full suite remains required after the last product edit (L-044).

## Working tree and environment

- Owner: Codex
- Docker Desktop + `npx supabase start` needed from the first migration task; build and serve only in this worktree.
- This worktree has its own ignored `node_modules` installed by `npm ci`; no parent dependency edits.

## Blockers

- No external blocker. Intermediate save/score and Summary contracts remain incompatible until
  Tasks 4/5 and 13 respectively, as recorded by the prior preflight ruling R2. Do not treat the
  in-progress branch as ready for use or merge.

## Next actions

1. Codex takes implementation ownership as requested on 2026-10-17; protocol gate passed before handoff.
2. Task 3: shared alignment, versioned assessment and Azure word spans. Tasks 4–15 remain.
