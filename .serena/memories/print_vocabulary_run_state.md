# Print Vocabulary — run state (⭐ MERGED → master `b4eac34` 2026-10-07; history, not a resume point)

## 2026-10-07 — DONE: owner-approved and merged
- Merged `--no-ff` into master `b4eac34` (not pushed; the owner pushes by hand). Branch + worktree kept.
- Worksheet plan: Tasks 1–11 + final opus review (1 Important: PDF overflow guard could never fire → `1016282`) +
  fix wave `532d3d1..2ab3c13` + docs `9c744f3`, run state `6d71fd7`.
- Owner Chrome review fixes (all in spec §10 of the worksheet spec):
  `6da3599` item sheets spread down to the quote band (last item sheet packed); data credit on the last sheet only;
  `118b150` four words per sheet: item padding 2mm (compact 1.2mm), stroke-guide box 14mm;
  `8b88497` example on the stroke-guide row (2-line clamp, default on); watermark = owner art
  `assets/mascot/source/Korume.png` → `scripts/mascot/watermark.js` → `public/mascot/watermark/korume.png`;
  `bc32d93`/`7b59194` watermark darkened to `brightness(0.25) contrast(1.2)` (owner: "đậm hơn 1 chút").
- Gates: worktree vitest 5048, tsc/lint 0, print e2e 19/19; full e2e earlier 143/4 (korume.spec.ts:75 race —
  failed only with server `AI_PROVIDER=none`; landing wide-viewport `load` timeouts = `/_next/image` stall).
- Open: real-paper printout never checked; Gọn density not looked at after the 1.2mm padding; main checkout
  node_modules lacks `yauzl` (tsc + kanjivg.test red there until `npm install`).
- Cleanup when wanted: the worktree node_modules is a JUNCTION into verify-db-erasure — remove the junction first,
  then `git worktree remove`. The SDD ledgers (48 `Ruling:` lines) live only in that worktree (git-ignored).
- Gotcha: Playwright webServer (`npm run build && npm run start`) can exceed its 120s timeout — build separately,
  `next start` with `E2E_ROUTE_ERROR=1 AI_PROVIDER=none`, then run the spec (reuseExistingServer).

Branch `print-vocabulary`, worktree `.worktrees/print-vocabulary`, off master `22226d9`. NOT merged. Tip `503c107`.
Owner: Claude (Codex out of quota until 2026-10-10). Owner instruction: "tự làm, cứ làm cho đến hết, chỉ dừng khi
quan trọng cần hỏi" — run tasks back to back.
node_modules = junction to `.worktrees/verify-db-erasure/node_modules` (do not npm install).

## (history) Resume point as of 2026-10-05
1. Read `docs/superpowers/run-state/print-vocabulary.md` (on the branch) and the SDD ledger
   `.superpowers/sdd/2026-10-05-print-vocabulary/progress.md` (git-ignored; pre-flight table, all rulings, deferred
   minors, per-task status). Briefs for Tasks 5–10 are already extracted beside it; also `env-rules.md` and
   `global-constraints.md` (handed to every implementer/reviewer).
2. Continue superpowers:subagent-driven-development at **Task 5** (Print source contract + Lesson adapter).
   Pattern used: sonnet implementer → sonnet task reviewer (template task-reviewer-prompt.md) → fix round via
   SendMessage to the same implementer → haiku/sonnet scoped re-review → ledger line.

## Done (all review clean)
- T1 resolver `f61edb9`,`e0e7786` · T2 staticAnalyses `da7e631`,`f0f9ef5` · T3 Summary candidates/hydration
  `7fdf664`,`57f5e5d` · T4 Summary EN chip + print launcher `f7447c7`,`dcdee71`.

## Rulings that change the frozen spec slightly (tell the owner at Task 10)
- §1.7 vocab join also accepts `row.word === token written form` (reading must match, ambiguity guard first) —
  seeded curated (する,する,làm) resolved to headword 為る and was lost otherwise.
- Lesson vocab binds curatedVi/vocabId to the item's own reading.
- EN chip leads the meaning (clamps hid a trailing chip); `components/lesson-summary/english-chip.tsx`.
- Plan's 3 refinements still to fold into the spec in Task 10.

## Open owner question
- Kana-written tokens display JMdict kanji_forms[0] (する → 為る) — pre-existing in Summary; Print would print 為る.

## Rules that bite here
- Vitest `--minWorkers=1 --maxWorkers=2`; never alongside Playwright. E2E with `AI_PROVIDER=none`; stop :3000 first.
- Task 9 page test must shim react `cache` (React 18.3.1 in Node has none).
- Local DB query: `MSYS_NO_PATHCONV=1 docker exec supabase_db_nihongo-cinema psql -U postgres -d postgres -c ...`.
- Merge only after owner Chrome + real-paper review (Task 10 step 3).

## 2026-10-06 update
Tasks 5–9 done (subagent-driven), final review (opus) + fix wave 0c7a2d9, 6bfb7bd; Task 10 gates + docs in progress. Owner answered the kana question: keep the lesson kana form (する, not 為る), no warning. Next: owner Chrome + paper review on :3000 from the worktree build; merge --no-ff after approval. Ledger lists every ruling.

## 2026-10-06 — REQUIREMENT CHANGE (resume point)
V1 (review template) finished: Task 10 gates + docs `f33dab0` (verify:protocol 0; e2e 139/1, korume.spec.ts:75
ruled a pre-existing race). Owner looked in Chrome and changed V1's requirement — NOT merged.
- New intent: Print = **handwriting worksheet** (Luyện viết / Tự kiểm tra), KanjiVG stroke guides (numbered starts,
  no progressive), atomic writing repetitions, self-test never reveals the target (document-level masking),
  answer key last, centre watermark mascot + KORUME, learning-prompt band, JMdict/KanjiVG credit on every page;
  `Tải PDF` = real PDF from server `playwright` Chromium via a single-use render-job token (no forwarded cookies),
  `In` = browser print. Both from the same committed page set.
- Spec (frozen, owner-approved): `docs/superpowers/specs/2026-10-06-print-vocabulary-writing-worksheet-design.md`
  (`393f4d5` → `c1ddf08` → `bde0208`).
- Plan (owner-approved, 11 tasks): `docs/superpowers/plans/2026-10-06-print-vocabulary-writing-worksheet.md` (`02fff0b`).
- Ledger: `.worktrees/print-vocabulary/.superpowers/sdd/2026-10-06-print-vocabulary-writing-worksheet/progress.md`
  (git-ignored; 7 planning rulings). Old plan ledger `.superpowers/sdd/2026-10-05-print-vocabulary/` kept for the
  final rulings list.
- **Next: owner starts execution later → dispatch Task 1** (superpowers:subagent-driven-development, BASE `02fff0b`).
- Open veto points for the owner: JMdict credit on every page; lesson title not masked in self-test headers.

## 2026-10-07 — execution started
Task 1 (japanese.ts: graphemes / hasKanji / readingRevealsTarget) complete at `4bb6215`, review clean. Pre-flight
scan table + 3 rulings in the ledger (notably: Task 2's guides.test needs `vi.clearAllMocks()` in beforeEach — the
repo clears no mocks). Workspace has `global-constraints.md` for every dispatch. **Next: Task 2** (BASE `4bb6215`).

## 2026-10-07 — Tasks 1–9 complete (owner: "làm hết, không cần dừng lại hỏi")
Tip `43ef1a4`. Commits: T1 4bb6215 · T2 2446425 · T3 ebd6321 · T4 2979da5 · T5 302d12d+3bee5de · T6 a20b618 ·
T7 29dbecd+c1c1d13 · T8 2c6ffb4+2b8d4f9 · T9 43ef1a4. Every task review clean (fix rounds on T5, T7, T8). All rulings +
deferred minors are in the ledger (worktree `.superpowers/sdd/2026-10-06-print-vocabulary-writing-worksheet/progress.md`).
Task 10 (Playwright) dispatched; then Task 11 (full gates + final opus whole-branch review + docs). Docker Desktop was
started by Claude via Start-Process (works). playwright added with `npm install --package-lock-only --save-exact` because
node_modules is a junction into verify-db-erasure.
