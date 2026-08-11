# Lessons Registry — run state (COMPLETE, awaiting merge, 2026-08-11)

> Branch `lessons-registry`, off master `c1a8fa2`, HEAD `75fd516`, working tree clean, **not merged**.
> All 6 tasks done and reviewed. Final whole-branch review + its one fix wave done; re-review returned
> READY TO MERGE = YES, 0 Critical / 0 Important open.
> Spec `docs/superpowers/specs/2026-08-08-lessons-registry-design.md` (approved, G1–G10).
> Plan `docs/superpowers/plans/2026-08-08-lessons-registry.md`.
> SDD ledger `.superpowers/sdd/2026-08-08-lessons-registry/progress.md` — **gitignored**, and deleted at
> finish by the skill. If it is gone, this file plus `git log` is the record.

## What shipped

`docs/lessons.md` is now the single canonical home for the project's **process** lessons, one entry per
lesson under a stable `L-NNN` id, in seven navigation groups, each entry `Rule` / `Why` / `Evidence` /
`Applies to`. Everything else references the id and restates nothing. Technical gotchas about this
codebase stay in `mem:project_status` § Key gotchas (G1) — they were deliberately not migrated.

Count entries with `grep -c "^### L-" docs/lessons.md`. **Never record that number as a durable fact**
(`L-002`); this file used to write it and that was itself a violation, fixed at `75fd516`.

- `docs/lessons.test.ts` — the integrity guard. **I1**: every `L-NNN` in any tracked file resolves to a
  defined entry. **I2**: every id defined exactly once, and at least one exists. Walks `git ls-files`;
  binary files are detected by sniffing for a NUL byte, **not** by a maintained extension list (G10).
- In-repo memory sources (`.serena/memories/*.md`) cut from lesson bodies to `L-NNN` pointers.
- Six auto-memory `feedback-*.md` files outside the repo cut to pointer stubs, plus their `MEMORY.md`
  index lines. **No test can reach these** (spec §4.2) — verification there is by reading, permanently.
- `CLAUDE.md` **§10** = the read contract (four concrete moments to read the registry). **§9** gains the
  write contract as a Definition-of-Done line.

## Two emergent guard properties nobody designed but that are worth knowing

Found by the final review, verified: (a) a malformed heading (`-` for `—`, `##` for `###`) does **not**
silently un-define an id — the heading line is itself a reference and `docs/lessons.md` is tracked, so
I1 goes red; (b) deleting an entry that any memory points at also goes red.

**The guard's real blind spot is a correct-but-wrong id.** `Migrated to …: L-003` typed as `L-004` is
green and the pointer lies. All ~30 hand-written pointers in this branch were checked by the final
reviewer and are right; nothing automated will check the next thirty.

## Decisions taken during execution — do not re-litigate

1. **No worktree, by user ruling.** A plain branch off master: `L-016`'s stray-commit failure mode is
   worktree-induced, and this work is docs + one test with no `.env.local` or e2e dependency.
2. **`BINARY_EXTENSIONS` was deleted, not re-worded** (user adjudication). Keep the reasoning: do not
   amend a spec to legitimise an implementation that fails its invariant. G10 needed no amendment.
3. **`plan_c_hub_ui_inputs.md:36` stays untouched** — conditional advice scoped to one decision is an
   *application* of a lesson, which spec §1.1 rules correct usage, not duplication.
4. **`project_status.md` § Verify commands keeps its warning cues, cut to pointers.** The body lives
   once; the trigger survives at the point of use.
5. **Promotion to `CLAUDE.md` law is deferred out of scope** (spec §7) — see the open item below.
6. **User ruling 2026-08-11:** when a cut would orphan content, place it inside the task that found it
   rather than deferring. This overrode Task 4's "no commit" step and produced `f4991ee`.

## What this run actually taught, and it is not what the plan expected

**Every defect of consequence originated upstream in the plan, none in an implementer.** That is
`L-013` five times in one branch:

1. Task 2's plan text mandated an exclusion list the spec forbade.
2. Task 3's plan named one restatement site per file; the real count was five across two files.
3. Task 3's acceptance grep was too broad and matched a factual record the plan itself said to keep —
   a false positive inside the plan's own verification step.
4. Task 1's classification gave one incident no home, so Task 3's pre-written replacement line erased
   it. **This became a real Critical content loss** — `git grep dishonest` returned zero hits repo-wide
   before it was restored at `1728eb4`.
5. Task 4's pre-written stub table assumed six files were fully covered; three were not.

**The mitigation that worked is now `L-023`'s `Applies to`:** before cutting any source against a
pre-written list, classify every claim in it to a destination first — anything with no destination is
an orphan to be placed, never deleted. Added to Task 4's dispatch after defect 4; it caught defect 5
*before* deletion. Both incidents are `L-023` evidence.

**The other structural finding became `L-029`:** the plan named `npx tsc --noEmit` binding in its Global
Constraints but scheduled it in exactly one task, the last. Task 2 shipped the guard with `tsc` red;
Tasks 3, 4 and 5 each passed review on `vitest` alone. It surfaced only at Task 6's gate. A gate a plan
names but never schedules is a gate nobody runs, and no per-task review can see it.

## Open, for the user

- **`L-011`'s promotion review** (spec §7) — it qualified on day one. The final review found three more
  entries at or over lesson-entry rule 3's threshold (`L-016`, `L-023`, `L-026`); all four now carry a
  `Status:` deferral line. **Four parked promotion reviews are the input to that post-merge conversation.**
- Two spec notes for whenever §4.2/§4.3 is next touched: the correct-but-wrong-id blind spot above, and
  that `REFERENCE_PATTERN` matches any `L-###` token, so a future unrelated token shaped like one (an
  error code, a migration label) fails I1 with no exemption short of changing the pattern. Baseline is
  genuinely 0 today.
- Deliberately NOT fixed: pointer phrasing varies across migrated files (`Migrated to …` / `Rule:` /
  `See` / `→`). The final review inventoried all 26 sites, found every one unambiguous, and ruled
  convergence not worth re-editing the exact lines where this run already lost content once.

## Environment facts measured this run

- Baseline at `c1a8fa2`: 2064 unit tests, 2063 pass + **1 known CPU-contention flake**,
  `components/video-player/pitch-contour.test.tsx`, standalone-green 8/8 in 200ms. Not a regression.
  HEAD adds this branch's two guard tests; test **file** count up by exactly one.
- Lint held at 0 errors / 77 warnings, mix `54 no-non-null-assertion + 23 no-unused-vars`, all run.
- `docs/lessons.test.ts` is picked up with no config change — `vitest.config.ts` includes
  `**/*.test.{ts,tsx}` and does not exclude `docs/`.
- ⚠️ **`grep -qP '\x00'` does NOT reliably detect NUL bytes.** The controller used it, got a false
  negative, and briefly reported "no tracked binaries are scanned" — which was wrong. Use `od -An -tx1`.
  A measurement method that cannot detect the negative case is not a measurement.

## Related

`mem:project_status` · `mem:l9a_localization_run_state` (its restored mutation taxonomy is load-bearing
for L9a Plan 3 Tasks 14–19) · `mem:shadowing_hub_plan_c_run_state` · the registry itself at
`docs/lessons.md`, which is now the authority for everything this file used to restate.
