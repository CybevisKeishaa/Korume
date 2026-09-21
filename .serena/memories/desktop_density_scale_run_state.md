# desktop-density-scale — run state (Serena mirror, 2026-09-21)

⚠️ **The authority is `docs/superpowers/run-state/desktop-density-scale.md` IN THE WORKTREE**, not
this file. This exists so a cold session knows where to look and what the traps are. Read the repo
file, the spec and the plan before touching anything.

## Where it stands

⭐ **MERGED to `master` at `02a0d57`, plus a CRLF test fix at `1099c5a`**
(`--no-ff`, 2026-09-21). Branch and worktree `.worktrees/desktop-density-scale` kept. This file is
now history, not a resume point. Merged-master gate: `tsc` 0, `lint` 0, `npm test` 324 / 3125,
`verify:protocol` 0. The owner viewed the result at 1280 in their own Chrome and approved it.

Whole-branch review: 0 Critical, 3 Important — the design doc's 0.9375 factor contradicted the
tokens (fixed: 1536 frame values ARE the 1440 values), the mobile handoff shrank 11% (fixed:
`data-density="reference"`), unmigrated screens mix scaled/unscaled type (accepted gap, told to
the owner). Post-merge a guard failed on master only: its regex assumed LF, and the merge checked
the file out CRLF — fixed by normalising on read.

- Task 5 `35e3b9a`: branch at 1280 matches master at zoom 90% **in screen px** within 0.2%
  (column 703.7 vs 702.7, rail 275.0 vs 274.7, scroll 2087 vs 2095). The plan/spec §1 target
  "≈768px at 1280" was in the wrong unit (CSS px of the 1422 zoom-90% viewport) — still owed:
  a unit column in spec §1.
- Task 6 `081b47f` + review fix `97a3e8a`: portaled primitives copy `data-density` onto their
  content (`useDensityScope`). Toast viewport NOT handled (review M2, recorded).
- Task 7 `2593b97`: `adaptive-layouts.md` Frame Fidelity rewritten.

**Gate at `97a3e8a`:** `tsc` 0 · `lint` 0 · `npm test` 324 / 3124 · build 0 · playwright hub +
explore + landing 29 pass / 3 fail — the same three landing tests red on `master`.

Environment: authenticated measurement and e2e need Docker Desktop + `npx supabase start`. Never
`npm run build` in the MAIN checkout while the owner runs a dev server there — it overwrote `.next`
and broke their fonts on 2026-09-21.

## The one thing most likely to be got wrong again

A `var()` inside a custom property is substituted on the element that **declares** it. A token
declared on `:root` as `calc(N * var(--density-unit))` resolves there and inherits a finished
length — overriding `--density-unit` on a descendant cannot reach it. That is why the opt-out is
**two rules**: `[data-density="reference"]` sets the unit, and a `[data-density]` block re-declares
all 38 derived tokens on the scope element. Measured, not reasoned about: with only the first rule,
`var(--space-md)` inside the scope rendered 14.2222px where 16px was owed.

**No stylesheet assertion can catch that class of defect** — the CSS text was correct throughout,
and so was a unit test asserting the attribute's presence. The guard that works is
`tests/e2e/landing-page.spec.ts`, which measures a computed value in a browser.

## Process facts worth carrying

- **Three of the four defects found so far were in the PLAN, not in Codex's work.** Codex's own
  `code-reviewer` returned APPROVE/ADDRESSED on every task that later turned out to carry one.
  One task per dispatch, with an independent Claude review between, is why they were caught.
- Codex once **stopped and reported rather than loosening an assertion** (the 44px floor could not
  be `min-h-control-lg`, which renders 39.11px). That was correct and the plan was wrong.
- Owner rulings 2026-09-21: `borderRadius.DEFAULT` **scales**; `button.tsx`'s `h-12` **does not**,
  and no fourth control rung is added; every rung in `explore-lesson-card.tsx` is `caption`.

## Environment traps, all already paid for once

- The worktree shipped **without `kuromoji`** in node_modules (11 japanese tests failed on a
  missing dict file) and **without `.env.local`** (production server died on `EnvValidationError`,
  and Playwright reported only `Timed out waiting 120000ms from config.webServer`). Both fixed
  here; a fresh worktree will need both again.
- **GitHub Desktop holds `.git/worktrees/*/index.lock`** periodically. Codex lost a handoff commit
  to it. Retry rather than working around it.
- `npm run verify:protocol` **fails the run state above 200 lines**. It was broken three times.
  And `npm run verify:protocol | tail` returns tail's exit code, so a `&&` chain does NOT stop on
  a red protocol — check the real exit code.
- **Codex runs on the owner's ChatGPT plan quota, shared with their own usage.** It hit the limit
  mid-Task-4 on 2026-09-21 (reset 16:49) and Claude finished that task by hand.

## Mistakes Claude made here, so they are not repeated

- `git checkout --` to undo a mutation check **destroyed an uncommitted fix sitting beside it**.
  Edit a mutation back instead.
- `git add -A` in a dirty worktree swept in a red e2e guard (committed untested) and six stray
  `.task4-*.log` files.
- Two run-state splices used `s.index(...)` on an anchor that appears **earlier** in the file than
  the section being replaced, duplicating half the document. Cut by line range.
- Claude edited the worktree twice while the `- Owner:` line still read `Codex`.
