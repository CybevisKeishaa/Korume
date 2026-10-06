# Branch Run State

Branch: print-vocabulary.

- Owner: Claude
- Status: awaiting the owner's Chrome and paper review; merge `--no-ff` only after approval. NOT merged.

## Goal and scope

- Branch `print-vocabulary`, worktree `.worktrees/print-vocabulary`, from master `22226d9` (summary-followups merged).
- Print a lesson's vocabulary as paper (A4 preview + `page.pdf`), launched from the Summary's "In từ vựng" link.
  Route `/vocab/print`; the pure lexical resolver and Summary EN chip are part of the branch.
- Codex is out of quota until 2026-10-10; Claude implements. `node_modules` is a junction to `.worktrees/verify-db-erasure/node_modules`.

## Authorities

- Spec (frozen `921bca1`, amended at its end): `docs/superpowers/specs/2026-10-05-print-vocabulary-design.md`.
- Plan: `docs/superpowers/plans/2026-10-05-print-vocabulary.md` (10 tasks).
- SDD ledger (git-ignored, the recovery map): `.superpowers/sdd/2026-10-05-print-vocabulary/progress.md` — every ruling,
  deferred minors, briefs and reports. Task 10 report: `task-10-report.md` beside it.

## Accepted commits

| Task | Commits | Status |
|---|---|---|
| 1 Pure lexical resolver | `58c36c8..e0e7786` | complete, review clean |
| 2 `staticAnalyses` on the resolver | `e0e7786..f0f9ef5` | complete, review clean |
| 3 Lesson vocab, Summary candidates + hydration | `f0f9ef5..57f5e5d` | complete, review clean |
| 4 Summary UI: EN chip + "In từ vựng" launcher | `57f5e5d..dcdee71` | complete, review clean |
| 5 Print source contract + Lesson adapter | `503c107..c69efda` | complete, review clean |
| 6 Pagination (pure) | `c69efda..9b79793` | complete, review clean |
| 7 Paper components + print CSS | `9b79793..f547ba5` | complete, review clean |
| 8 Print workspace | `f547ba5..17772c4` | complete, review clean |
| 9 Route + e2e | `17772c4..2cb0825` | complete, review clean |
| Final review fix wave | `0c7a2d9` (typography on `.vp-paper`, key `lessonId:set`), `6bfb7bd` (kana display form) | scoped re-review clean |
| Task 10 registry fix | `d7444fe` (`vocab-print` row; the first full vitest run caught the miss) | gates re-run |

## Contracts and decisions

Spec refinements and the owner ruling are folded into the spec's "Amendments during execution" section; the ledger holds
the rest. Summary of the load-bearing ones:

- Vocab join accepts the written form or the headword (or the entry's canonical kanji key) with a matching reading.
- **OWNER RULING 2026-10-06 (kana display):** "Display form follows the lesson surface when the token matched JMdict
  through a kana form. JMdict kanji forms are metadata, not a replacement display form." No warning in Summary or Print.
  A future handwriting `practiceForm` is out of scope for V1.
- Zero-height measurement guard + re-measure; typography lives on `.vp-paper`; desktop floor is 1024px.

## Verification

Gates on `d7444fe`:

- `npx tsc --noEmit`: exit 0. `npm run lint`: exit 0 (warnings only).
- `npx vitest run`: exit 0, 559 files / 4961 tests passed (tsc/lint/vitest 0/0/0).
- e2e (`AI_PROVIDER=none`), five full runs, none fully green; the failing set differed every run and no print or
  summary spec ever failed:
  - default workers: 24 failed / 116 passed (landing-page x21, display-scale, shadowing-intelligence:185).
  - default workers: 4 failed / 136 passed (display-scale x2, shadowing-explore:35, shadowing-intelligence:185).
  - `--workers=2`: 1 failed / 139 passed (korume-threads:20, ECONNRESET).
  - `--workers=1`: 1 failed / 139 passed (korume.spec.ts:75, posted lineId mismatch).
  - Isolation: landing-page:65, display-scale, shadowing-intelligence:185 passed in isolation. korume.spec.ts:75 failed
    once and passed once in two isolated runs.
- Ruling (controller): korume.spec.ts:75 is a pre-existing race, not a branch regression. The branch diff is empty for
  `components/shadowing`, `components/korume`, `lib/korume`, `korume.spec.ts` and `fake-youtube.ts`; the fake player
  moves time only on `advance()`. e2e was not re-run after this ruling.
- `npm run verify:protocol`: exit 0.

## Working tree and environment

- Local Supabase running (Docker Desktop started by the controller); `.env.local` copied from summary-followups.
- Nothing left on :3000. No migration, no new dependency. Master is untouched.

## Blockers

- None for the branch. Owner review (step 3) is outstanding: serve this worktree's build, then
  `/vi/vocab/print?source=lesson&lesson=ba522023-8eba-4929-924f-35ae69eacf99&set=all` (Ep.729, 2-3 page PDF),
  Shadowing popup on 人 → ひと, and Summary Words (`EN` chip, "In từ vựng" link).

## Next actions

1. Owner Chrome and paper review; fix anything found, re-run the affected gates.
2. After approval: `git merge --no-ff print-vocabulary` into master (the owner pushes by hand).
3. Follow-up: korume.spec.ts:75 posted lineId race (pre-existing, unchanged code) — investigate the seek after openLessonAt.
4. Follow-up: the e2e suite is load-flaky at default workers on this machine (see Verification); consider a lower worker count.
