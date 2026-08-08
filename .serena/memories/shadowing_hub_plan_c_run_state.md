# Shadowing Hub Plan C — run state (C1 MERGED 2026-08-08)

> ✅ **C1 IS DONE AND MERGED.** `--no-ff` merge commit **`bd7f574`** on master; the Screen Registry spec
> landed right after at **`e861150`**. Post-merge verification on master: `tsc` 0, unit **2064/2064
> across 230 files**. Whole-branch review round 2 returned **APPROVE**.
>
> The branch `shadowing-hub-plan-c` was **KEPT, not deleted** — this repo keeps every merged feature
> branch (`layer-1-foundation` … `layer-9b-companion-presence` are all still present and all in
> `git branch --merged master`). Follow that convention.
>
> ⚠️ **CORRECTION: this file previously said the branch was "never pushed". That was WRONG.**
> `refs/remotes/origin/shadowing-hub-plan-c` exists at `60abdef` (the user's own "catalog" commit), so
> the branch WAS pushed at least once. `git branch -d` refusing to delete it is what surfaced this.
> **`master` itself has never been pushed** — it is ~40 ahead of `origin/master` (`3ca9966`). Do not
> reason from "this has never been pushed" without running `git show-ref` first; that assumption was
> used to justify editing a migration in place.
>
> Everything below is the historical record of the run. Next action is NOT here — see
> `mem:project_status` § NEXT ACTION (Screen Registry Phase 1).

**Historical record of the C1 run.** Spec LOCKED, plan fully executed, all four human gates approved,
whole-branch review rounds 1 and 2 complete.

## ⚠️ Corrections to the previous version of this file

The earlier version of this memory was stale in ways the whole-branch review caught. Recorded because
each one is a reusable lesson, not just a typo:

1. **It said "23 commits off master". Never measured.** The 23 came from counting this file's own commit
   LIST, which deliberately recorded only implementation commits and omitted the 5 spec/plan commits at
   the head of the branch and 2 `docs(memory)` commits. Worse: the controller put the unmeasured number
   into the reviewer's dispatch prompt and the reviewer echoed it, so an unverified figure came back
   looking independently confirmed.

   **This file no longer states a commit count at all — run `git rev-list --count 3ca9966..HEAD`.** The
   first correction replaced 23 with a measured number and was stale within two commits, because a count
   is falsified by every commit that follows it, including the merge commit itself. Review round 2 caught
   that: this file said 35 and `project_status` said 36 while HEAD was 37 — each measured, each measured
   just before the commit that carried it. Rule: `docs/lessons.md` L-002.
2. **It said "Task 11 is blocked — do not run it".** Done; Task 11 shipped clean.
3. **It said "never commit anything under `messages/`".** That rule's premise expired — the user committed
   all 22 VI catalogs themselves at `60abdef`. That commit was load-bearing for a non-obvious reason:
   the 9 pins assert *Vietnamese* strings, so updating them against an uncommitted catalog would be green
   locally and **red on every clean checkout**. Rule: `docs/lessons.md` L-027.

## Where things stand

| Artifact | State |
|---|---|
| Spec `docs/superpowers/specs/2026-08-07-shadowing-hub-plan-c-design.md` | **LOCKED** at `22c9d18`, D1–D17 |
| Plan `docs/superpowers/plans/2026-08-07-shadowing-hub-plan-c1-foundation.md` | 11 tasks, **all complete** |
| Branch `shadowing-hub-plan-c` | forked from master `3ca9966`, **merged at `bd7f574`**, branch kept. Pushed to origin at `60abdef` (see the correction at the top — the old "never pushed" claim was false). Count commits with `git rev-list --count 3ca9966..bd7f574^2`, never from a written figure. |
| Gates | A (1–2) ✅ · B (3–6) ✅ · C (7) ✅ · **D (8–11) ✅ approved 2026-08-08** |
| Reviews | round 1 CHANGES REQUIRED (1 Critical + 3 Important) → both blockers fixed → round 2 **APPROVE** |
| Ledger | `.superpowers/sdd/2026-08-07-shadowing-hub-plan-c1-foundation/progress.md` (gitignored) — per-task detail, every fix round, every deferred minor |

## Verification, controller-measured after the round-1 fixes

`tsc` 0 · `lint` 0 errors / 77 warnings, mix unchanged (54 no-non-null-assertion + 23 no-unused-vars) ·
unit **2064/2064 across 230 files** · build ✓ with all 12 C1 routes and no `/[locale]/videos` ·
Playwright **13/13 in 59.6s** · `db reset` 26 migrations 0 errors · **browser pass 6/6**.

Always run unit with `--reporter=json --outputFile` and read the JSON — grepping stdout once lost a
failing test's name for good. Verify `:3000` is empty with `Get-NetTCPConnection -LocalPort 3000 -State
Listen` BEFORE Playwright, not after a failure.

## What round 1 of the whole-branch review caught — five for five

Both blockers were invisible to eleven per-task reviews AND to a fully green gate. Both were
controller-verified by measurement before any fix was written.

- **CRITICAL, fixed `b4d624b`.** `next.config.mjs`'s `source: "/:locale/videos"` left the param
  unconstrained, so it matched the literal segment `api`. `redirects()` runs **before** the filesystem:
  `GET /api/videos` → 307 → `/api/shadowing` → 404. Contradicted LOCKED spec §3.1 ("Not renamed:
  `/api/videos/**`"). **Nothing in-repo called the bare endpoint, which made it more dangerous, not
  less.** Now `/:locale(vi|en)/videos`, with `next.config.test.ts` pinning the alternation against
  `routing.locales` (that file cannot import `.ts`, so the duplicated locale list is what drifts).
- **IMPORTANT, fixed `65ebb4c`.** Task 6's eight `(protected)/(app)` routes never reached
  `PROTECTED_PREFIXES`. Not a bypass — the `(protected)` layout redirects server-side — but `redirectTo`
  was dropped. The mechanism was proved by asymmetry: `/shadowing/explore` kept its `redirectTo` while all
  eight siblings lost theirs. New guard walks the **filesystem**, because every pre-existing test in that
  file iterates `PROTECTED_PREFIXES` and therefore could never notice a route that was never added.

## ⏭ Deferred to C2 by user ruling — `lib/data/lesson-ranking.ts`

Nothing calls `rank()` today, so neither blocks C1.

1. The ledger read is **unbounded** while `supabase/config.toml:8` sets `max_rows = 1000` → PostgREST
   silently truncates and "Popular" ranks an arbitrary slice. `test/supabase-mock.ts` models no row cap.
2. `.slice(0, limit)` runs **before** the RLS-filtered `videos` read, so Popular can render **empty** on a
   populated app. **⚑ Carries a product question the user must answer first:** may Popular under-fill
   `limit`, or must the strategy over-fetch and backfill? Do not pick a fix shape before that ruling.

The user's reasoning for deferring both together: fixing 1 alone would make the implementation *look*
safer while the ranking contract is still undecided — false confidence.

## Standing lessons from this run
Migrated to `docs/lessons.md`: L-001, L-004, L-005, L-006, L-009, L-017, L-019, L-023.

## ⚠️ Not proven by any of this

Gate D approval and a green branch mean **the implementation matches C1's contract**. They do **NOT** mean
the 22 NAV rows, the 9 empty-state routes, the 6 seeded collections or the current catalogs are the
product's final IA. Those are **provisional**, and confirming or correcting them is the job of Screen
Registry Phase 2 — see `docs/superpowers/specs/2026-08-08-screen-registry-design.md` (untracked on
purpose, kept out of C1's diff; commit it on master after C1 merges).

Two copy items deferred out of C1 to the later localization/copy pass: the hardcoded English
`"Reduce motion"` label with no catalog key anywhere, and `"Chưa có gì ở đây"` opening 5 of the 10
`vi/upcoming.json` entries while `/vi/roadmap` does the same job forward-lookingly — the catalog
disagreeing with itself is the sharper form of that observation.

## Related

`mem:plan_c_hub_ui_inputs` · `mem:project_status` · `mem:figma_make_design_source` (⚠️ its "29 frames /
avoid the MCP" claim is stale — the live file `IwFHZDZdHW7qsSFiNbWrkd` has **59** frames and the MCP is
good for `get_metadata` and `get_screenshot`).
