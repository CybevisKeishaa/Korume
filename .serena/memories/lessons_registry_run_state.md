# Lessons Registry — run state (PAUSED mid-Task-3, 2026-08-09)

> **Resume here.** Branch `lessons-registry`, HEAD `1728eb4`, working tree clean, NOT merged.
> Spec `docs/superpowers/specs/2026-08-08-lessons-registry-design.md` (approved, G1–G10).
> Plan `docs/superpowers/plans/2026-08-08-lessons-registry.md` (6 tasks; entries written out in full — count with `grep -c "^### L-" docs/superpowers/plans/2026-08-08-lessons-registry.md`, never from a written figure).
> SDD ledger `.superpowers/sdd/2026-08-08-lessons-registry/progress.md` — **gitignored**; if lost,
> reconstruct from `git log` and this file. Per-task briefs and reports live beside it.

## What this is

`docs/lessons.md` becomes the single canonical home for the project's **process** lessons, one entry per
lesson under a stable `L-NNN` id; every other artifact references the id and restates nothing. Technical
gotchas stay in `mem:project_status` § Key gotchas (G1). Four lesson-entry rules keep it from bloating:
evidence must be an openable artifact; a variant merges into an existing entry's evidence list rather than
becoming a new entry; three evidence entries trigger a promotion *review*, not a promotion; entry count is
never a target.

## Exact resumption point

**Task 3's fix round 3 is committed at `1728eb4`. Its scoped re-review has NOT been run.** That is the
next action — `scripts/review-package <plan> c479047 1728eb4`, then `re-review-prompt.md` verdicting the
two findings below as ADDRESSED / NOT ADDRESSED. Then Tasks 4, 5, 6, then the final whole-branch review.

| Task | State |
|---|---|
| 1 — registry, entries per `grep -c "^### L-" docs/lessons.md` | ✅ complete, review clean (byte-level diff brief↔file was empty) |
| 2 — integrity guard + mutation checks | ✅ complete, 1 fix round, re-review APPROVE |
| 3 — cut memory sources to pointers | ⏸ **fix round 3 committed, scoped re-review OWED** |
| 4 — auto-memory stubs (6 files, outside repo) | not started. Produces **no commit** by design |
| 5 — CLAUDE.md §10 read contract + §9 DoD write contract | not started |
| 6 — full verification + status update | not started |

Never write a commit count here — run `git rev-list --count c1a8fa2..HEAD` (`mem:project_status` L-002).

## Commits (SHAs are stable facts; the count is not)

`f168ef2` registry · `7529587` guard · `00660bb` guard fix · `e6a987a` cut memories ·
`2296d1e` cut 2nd/3rd restatement blocks · `c479047` cut Verify-commands restatements ·
`1728eb4` restore deleted incident + missing L-015 pointer

## Decisions taken during execution — do not re-litigate

1. **No worktree, by user ruling.** A plain branch off master. Reasoning: the stray-commit failure mode
   recorded in `docs/lessons.md` L-016 is *worktree-induced*, and this work is docs + one test with no
   `.env.local` or e2e dependency, so the worktree's main benefit does not apply.
2. **`BINARY_EXTENSIONS` was deleted, not re-worded** (user adjudication). The guard's binary detection is
   a NUL-byte content sniff over the first 8192 bytes. `git ls-files` stays the sole membership boundary
   and there is now genuinely no exclusion list, so **G10 needed no amendment**. The user's reasoning is
   worth keeping: do not amend a spec to legitimise an implementation that fails its invariant.
3. **`plan_c_hub_ui_inputs.md:36` stays untouched** — conditional advice scoped to one decision is an
   *application* of a lesson, which spec §1.1 rules is correct usage, not duplication.
4. **`project_status.md` § Verify commands keeps its warning cues, cut to pointers.** The body lives once;
   the trigger survives at the point of use. Same shape as the §5.4 auto-memory stub ruling.
5. **Promotion of L-011 to CLAUDE.md law is deliberately deferred** (spec §7). It qualified for a
   promotion review on day one with four evidence entries. That review is the user's first call after merge.

## The finding that matters most, and it is not closed

Task 3's review caught a **Critical content-loss defect**: the sentence *"One called a correction note
dishonest for crediting a user ruling that had in fact happened"* was deleted from `project_status.md`
and `git grep dishonest` returned **zero hits repo-wide**. Restored at `1728eb4` as a second instance on
`L-003`'s evidence entry (merge rule — not a new id).

**The generalizable lesson is not yet in the registry:** cutting sources against a written list deletes
whatever the classification pass missed, and no guard can see it because no id is malformed. This belongs
as a new **Evidence entry on `L-023`**, not a new entry — add it in Task 6.

## Plan defects found during execution — all four upstream, none from an implementer

This is `docs/lessons.md` L-013 four times over in one branch, and it is the run's main finding:

1. Task 2's plan text mandated an exclusion list while the spec it implemented forbade one.
2. Task 3's plan named **one** restatement site per file; the real count was **five across two files**
   (the implementer's own wider search found three of them after the controller found the first).
3. Task 3's acceptance grep pattern `"earned its keep"` was too broad and matched a factual record the
   plan itself said to keep — a false positive in the plan's own verification step.
4. Task 1's classification gave one incident no home, so Task 3's pre-written replacement line erased it.

## Deferred minor (for the final whole-branch review to triage)

Pointer phrasing is inconsistent across the migrated files: `Migrated to docs/lessons.md: …`,
`Rule: docs/lessons.md L-NNN.`, `See docs/lessons.md L-NNN.`, and `→ docs/lessons.md L-NNN`. Cosmetic;
deliberately not fixed mid-loop.

## Environment facts measured this run

- Baseline at `c1a8fa2`: `npx vitest run` → 2064 tests, 2063 pass + **1 known CPU-contention flake**,
  `components/video-player/pitch-contour.test.tsx`, proven standalone-green 8/8 in 200ms. Not a regression.
- `docs/lessons.test.ts` is picked up with no config change — `vitest.config.ts` includes
  `**/*.test.{ts,tsx}` and does not exclude `docs/`.
- The guard scans `git ls-files`; at the time of measuring, 916 tracked files, 891 scanned, 25 skipped as
  binary. `data/state_store.db/mem%3Ahealth.bin` is tracked and genuinely contains NUL bytes.
- ⚠️ **`grep -qP '\x00'` does NOT reliably detect NUL bytes.** The controller used it, got a false
  negative, and briefly reported "no tracked binaries are scanned" — which was wrong. Use `od -An -tx1`.
  A measurement method that cannot detect the negative case is not a measurement.

## Related

`mem:project_status` · `mem:shadowing_hub_plan_c_run_state` · the registry itself at `docs/lessons.md`
