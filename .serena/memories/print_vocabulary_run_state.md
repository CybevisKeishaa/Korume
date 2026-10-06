# Print Vocabulary — run state (2026-10-06: Tasks 1–10 + final review done; awaiting owner Chrome + paper review)

Branch `print-vocabulary`, worktree `.worktrees/print-vocabulary`, off master `22226d9`. NOT merged. Tip `503c107`.
Owner: Claude (Codex out of quota until 2026-10-10). Owner instruction: "tự làm, cứ làm cho đến hết, chỉ dừng khi
quan trọng cần hỏi" — run tasks back to back.
node_modules = junction to `.worktrees/verify-db-erasure/node_modules` (do not npm install).

## Resume here
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
