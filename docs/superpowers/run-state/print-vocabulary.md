# Branch Run State

Branch: print-vocabulary.

- Owner: Claude
- Status: writing-worksheet plan complete through Task 11 gates; awaiting the owner's Chrome and paper review; merge
  `--no-ff` only after approval. NOT merged.

## Goal and scope

- Branch `print-vocabulary`, worktree `.worktrees/print-vocabulary`, from master `22226d9` (summary-followups merged).
- V1 (plan `2026-10-05-print-vocabulary`, tip `f33dab0`) printed a lesson's vocabulary as an A4 list. After the
  owner's Chrome look on 2026-10-06 it became a handwriting worksheet: Luyện viết / Tự kiểm tra modes, KanjiVG stroke
  guides, atomic repetition groups, answer key, watermark, learning-prompt band, and `Tải PDF` as a real PDF rendered
  by server-side playwright-core Chromium next to `In`.
- Codex is out of quota until 2026-10-10; Claude implements. `node_modules` is a junction to `.worktrees/verify-db-erasure/node_modules`.

## Authorities

- V1 spec (amended at its end): `docs/superpowers/specs/2026-10-05-print-vocabulary-design.md`; V1 plan
  `docs/superpowers/plans/2026-10-05-print-vocabulary.md`.
- Worksheet spec (frozen `bde0208`, §10 lists execution amendments):
  `docs/superpowers/specs/2026-10-06-print-vocabulary-writing-worksheet-design.md`.
- Worksheet plan: `docs/superpowers/plans/2026-10-06-print-vocabulary-writing-worksheet.md` `02fff0b` (11 tasks).
- SDD ledger (git-ignored, the recovery map): `.superpowers/sdd/2026-10-06-print-vocabulary-writing-worksheet/progress.md`
  — every ruling, deferred minors, briefs, reports and gate output (`t11-*.txt`). V1's ledger is
  `.superpowers/sdd/2026-10-05-print-vocabulary/progress.md`.

## Accepted commits

| Task | Commits | Status |
|---|---|---|
| V1 (10 tasks, final review, fix wave) | `22226d9..f33dab0` | complete, reviewed |
| 1 Japanese text rules | `02fff0b..4bb6215` | complete, review clean |
| 2 Stroke guides + print resources | `4bb6215..2446425` | complete, review clean |
| 3 Adapter `entSeq` + example spans | `2446425..ebd6321` | complete, review clean |
| 4 Settings, document masking, prepare | `ebd6321..2979da5` | complete, review clean |
| 5 Writing layout, cells, stroke-guide row | `2979da5..3bee5de` | complete, review clean |
| 6 Sheets, labels, quotes, watermark, CSS | `3bee5de..a20b618` | complete, review clean |
| 7 Workspace on the worksheet | `a20b618..c1c1d13` | complete, review clean |
| 8 PDF backend | `c1c1d13..2b8d4f9` | complete, review clean |
| 9 Render page, `Tải PDF`, registry row | `2b8d4f9..43ef1a4` | complete, review clean |
| 10 Browser acceptance | `43ef1a4..532d3d1` | complete, review clean |
| Final review fix wave (8 items) | `532d3d1..2ab3c13` | complete; items 1–6 each shown red by a mutation |

## Contracts and decisions

- **OWNER RULING 2026-10-06 (kana display):** a word the lesson writes in kana displays in that kana; JMdict kanji
  forms are metadata. A future handwriting `practiceForm` gets its own field and filter, never an auto-replace.
- Final whole-branch review (opus, `02fff0b..532d3d1` plus the full branch for context): 0 Critical, 1 Important —
  the PDF overflow guard could never fire because the quote band shrank to meet the body. Fixed in `1016282`.
- Execution rulings that change behaviour are in the worksheet spec §10; the rest are `Ruling:` lines in the ledger.

## Verification

Gates on `2ab3c13`:

- `npx tsc --noEmit`: exit 0. `npm run lint`: exit 0 (warnings only).
- `npx vitest run --minWorkers=1 --maxWorkers=2`: exit 0, 576 files / 5046 tests passed.
- `npm run verify:protocol`: exit 0.
- e2e (`AI_PROVIDER=none`, `--workers=1`): 143 passed, 4 failed. Every print and summary spec passed.
  - `korume.spec.ts:75` (posted lineId mismatch): the pre-existing race ruled on V1. It failed 2/2 isolated with a
    Playwright-spawned server, passed 1/1 against a server started without `AI_PROVIDER`, failed 1/1 with
    `AI_PROVIDER=none`. The branch changes no korume or shadowing code that test drives.
  - `landing-page.spec.ts:287`, `:608`, `:700` (1440): `page.goto` timed out waiting for `load`. They failed 2/2 in
    an isolated run too; no image-optimizer cache entry was written during that run. The same build then passed 5/5
    twice against a manually started server and 5/5 once with a Playwright-spawned server. A probe at 1280/1440,
    reduced motion and the width sweep left no request pending. The branch touches no marketing component,
    `next.config.mjs`, middleware or `public/marketing` file; its CSS is scoped to `.vp-*`, `[data-print-root]`
    and `@media print`. Ruling: environmental (`/_next/image` stalled in that server), not a branch regression.

## Working tree and environment

- Local Supabase running (Docker Desktop); `.env.local` copied in. Nothing left on :3000. Master is untouched.
- New runtime dependency: `playwright` 1.61.1 (exact), with `@playwright/test` pinned to the same version.

## Blockers

- None for the branch. Owner review (plan Task 11 Step 3) is outstanding.

## Next actions

1. Owner Chrome and paper review: serve this worktree's build (`npx next build`, `npx next start -p 3000`), then
   `/vi/vocab/print?source=lesson&lesson=ba522023-8eba-4929-924f-35ae69eacf99&set=all` (Ep.729) in Luyện viết and
   Tự kiểm tra, both densities, the kana toggle; a `Tải PDF` download and an `In` printout on real paper; the
   self-test answer key at the end.
2. After approval: `git merge --no-ff print-vocabulary` into master (the owner pushes by hand).
3. Follow-up: korume.spec.ts:75 — it failed only with `AI_PROVIDER=none` on the server in this round; start there.
4. Follow-up: landing-page wide-viewport `load` timeouts while `/_next/image` wrote nothing; reproduce with a cold
   `.next/cache/images`.
