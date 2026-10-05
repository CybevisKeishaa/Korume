# print-vocabulary — run state

- Branch `print-vocabulary`, worktree `.worktrees/print-vocabulary`, from master `22226d9` (summary-followups merged).
- Owner: Claude (Codex out of quota until 2026-10-10). NOT merged.
- `node_modules` is a junction to `.worktrees/verify-db-erasure/node_modules` (the main checkout's lacks `yauzl`).
- Spec: `docs/superpowers/specs/2026-10-05-print-vocabulary-design.md` — approved and frozen (`921bca1`).
- Plan: `docs/superpowers/plans/2026-10-05-print-vocabulary.md` (10 tasks) — approved; execution Subagent-driven.

## Progress (2026-10-05, paused at the owner's request)

SDD ledger (git-ignored, the recovery map): `.superpowers/sdd/2026-10-05-print-vocabulary/progress.md` — holds the
pre-flight table, every ruling, deferred minors and per-task status. Task briefs/reports/review diffs sit beside it.

| Task | Commits | Status |
|---|---|---|
| 1 Pure lexical resolver | `f61edb9`, `e0e7786` | complete, review clean |
| 2 `staticAnalyses` on the resolver | `da7e631`, `f0f9ef5` | complete, review clean |
| 3 Lesson vocab, Summary candidates + hydration | `7fdf664`, `57f5e5d` | complete, review clean |
| 4 Summary UI: EN chip + "In từ vựng" launcher | `f7447c7`, `dcdee71` | complete, review clean |
| 5–10 | — | not started (briefs extracted in the ledger dir) |

Tip: `dcdee71`. Last measured: Task 4 implementer reported vitest `lib/summary components/lesson-summary` 192/192,
tsc clean; Task 3 `lib/analysis lib/summary` 186/186. Full suite / e2e not run yet (Task 10).

## Decisions taken during execution (details in the ledger)

- Vocab join (spec §1.7 refinement): a curated row attaches when `word` = resolved headword **or** the token's written
  form, reading must match, unambiguity guard first. Reason: seeded `(する, する, làm)` resolved to headword 為る.
- Lesson vocabulary takes `curatedVi`/`vocabId` only from tokens with the item's own reading (P6).
- Summary EN chip leads the meaning (a clamp can no longer hide it); `EnglishChip` in `components/lesson-summary/english-chip.tsx`.
- Task 9 page test must shim `react`'s `cache` (React 18.3.1 in Node has none).

## Open questions for the owner (ask at Task 10)

- Kana-written tokens display JMdict `kanji_forms[0]` (する → 為る), already true in Summary; Print would print 為る.

## Next

1. Start Task 5 (Print source contract + Lesson adapter): brief `task-5-brief.md` in the ledger dir; base = branch tip.
2. Continue Task 5 → 10 per the ledger (fresh implementer + reviewer per task), then the whole-branch review.
3. Merge only after the owner's Chrome + real-paper review (Task 10 step 3).
