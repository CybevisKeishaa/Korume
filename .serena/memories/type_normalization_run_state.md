# type-normalization — run state pointer (RESUME HERE, 2026-10-14)

▶ **Branch `type-normalization`**, worktree `.worktrees/type-normalization`, base master `c648bff0`, tip
`4fa45c0d`. NOT merged, **no product code yet**. node_modules linked to `../port-profile/node_modules`, `.env.local`
copied from `../app-footer`.

## Approved by the owner (2026-10-14)
- Spec `docs/superpowers/specs/2026-10-14-type-normalization-design.md` (`3effc584` + `09587189`), decision IDs
  S/M/G/V/P/R/O. Plan `docs/superpowers/plans/2026-10-14-type-normalization.md` (`4fa45c0d`, 12 tasks).
- **Execution method chosen: subagent-driven** (superpowers:subagent-driven-development). Claude alone, no Codex.

## Rulings (each section owner-approved)
- Scope: learner app `(app)` + `(focus)` + their components, Dashboard included. Out: admin, marketing/landing,
  auth, immersive, print sheet (`.vp-*`), navbar.
- Standard = **Settings** (current `--text-*` scale); the owner compared /dashboard and /settings in Chrome.
- Above 1440 the WHOLE app zooms uniformly (type + spacing + sidebar + controls), 1.0 → 1.25 at 1920, held
  above; ≤1440 unchanged. Owner rejected splitting type from layout.
- Dashboard: type moves to tokens, `--d` keeps layout/art only; if the fold (row 1 inside 1280x529) breaks, fix
  spacing in `--d`, never shrink type — and report the numbers to the owner first.
- Guards: vitest source scan (G1) + per-element allowlist (G2, never a page/dir) + mutations (G3) + Playwright gate
  (G4) against a LITERAL token table (S2, ±0.05px), Dashboard also with nav collapsed.
- Before/after screenshots (V1–V5) incl. landing/login/admin; pixel % is an indicator only. Any noticeable change to
  an approved or out-of-scope screen goes to the owner; never redesign on our own.
- 44 routes locked (P1); an unmeasurable route fails with its reason, never skipped silently.

## Resume steps (next session)
1. Read this file, then the plan's Global Constraints + Task 1, then the spec.
2. Stop anything listening on :3000 before any `npm run test:e2e` (L-004).
3. Invoke superpowers:subagent-driven-development; start at **Task 1** (run state file with `- Owner: Claude`,
   capture harness, master baseline worktree `.worktrees/type-baseline` on :3101, baseline capture).
4. Task 11 STOPS for the owner's before/after review; merge only on the owner's word.

## Facts found while planning (verified, not assumed)
- Scan dry-run on the real tree: **443 violations**; the plan's `PENDING_MIGRATION` covers all of them.
- The old result-preview ceiling regex in `lib/design-tokens.test.ts` reads 0.0625 on the new CSS (silent false
  green); Task 2 replaces it. New `@container results` thresholds: 25.5625 / 39.125 / 52.6875rem.
- `components/ui/token-scale.test.ts` `DEFAULT_TYPE_UTILITY` is retired in Task 3 (G1 supersedes it).
- Footer unitless line-heights and `.reading-jp-*` (user reading preference) are known G4 hits: footer migrates
  (owner call under V5), reading rules become allowlist entries.
- Local DB has kanji/vocab/certification_tests/reading_passages/collections rows; forum post, playlist and print
  lesson are seeded by `tests/e2e/typography/learner.ts`.
