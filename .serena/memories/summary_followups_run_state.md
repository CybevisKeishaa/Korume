# Summary follow-ups — run state (2026-10-05)

**MERGED → master `22226d9` 2026-10-05** (owner Chrome look passed; e2e summary 12/12 + verify:protocol before merge).
Successor: branch `print-vocabulary`, spec `64832f8` (docs/superpowers/specs/2026-10-05-print-vocabulary-design.md),
awaiting the owner's review of the spec text → writing-plans. Everything below is history.

Branch `summary-followups`, worktree `.worktrees/summary-followups`, off master `ac2f793`. **NOT merged.**
Tip `130e2f4` (code at `ed63cd2`; + run-state `docs/superpowers/run-state/summary-followups.md` on the branch — authoritative).
Owner: Claude. Codex out of quota until 2026-10-10 → Claude implements.

## Done and committed
- `f9bc2b2` m6: card click toggles after 500ms (`CARD_CLICK_DELAY_MS`, Windows dblclick default); a double-click that
  selects a word no longer opens a clamped card. m8: one `summaryLines` in lib/summary/snapshot.ts.
- `a50be3b` gap fix: status/saved/next in one `.lesson-summary-rail` grid area (app/globals.css); Words→Expressions
  197→21px, Reflection→Status 114→22px on Ep.729 @1280x529. DOM order unchanged.
- `ed63cd2` Words "Xem dạng danh sách": cards stay AI max 6; list = AI words + lesson's frequent words from
  `GET /api/videos/[id]/vocabulary` (no AI), cap 24, 8/page. `SavedCardsProvider` shares saved state across views;
  lesson rows save `exampleSurface` (new field on LessonVocabularyItem).
- Gates at tip: vitest 551/4866, e2e summary 12/12 (`AI_PROVIDER=none`), tsc 0, lint 0, two code-reviewer passes
  (0 Critical; Importants fixed).

## Owner rulings this session
- Words cards: max 6 is fine (AI cap unchanged). List: "a fair share" of the lesson's words, no AI, 8 per page.
- The 3 images in Desktop/Japan/Korume/Idea are ANOTHER screen (handwriting sheets) — never reference them.

## Open
1. Owner Chrome look on :3000 (served from this worktree build) → merge decision (`--no-ff`, Claude merges).
2. **Brainstorm "In từ vựng" — DESIGN FROZEN 2026-10-05** (sections 1–5 + 3b approved by the owner; full ruling
   list in Claude auto-memory `summary-followups.md`). Owner chose: merge summary-followups FIRST (owner Chrome look),
   then new branch `print-vocabulary` off master, write + commit the spec there
   (docs/superpowers/specs/2026-10-05-print-vocabulary-design.md), owner reviews spec → writing-plans. No code before.
   Extra (5) rulings: JSON round-trip test for RSC props (not structuredClone); Q4 meaning tests with mutation; print
   never triggers AI (read-ready only, no generation/reserve path); whole-branch review is its own gate.
3. Data issue seen live (not fixed): the vocabulary endpoint takes the FIRST JMdict entry per token → 人 shows
   じん "-ian", ん "yes; yeah". Possible fix later: drop single-kana words / pick the sense matching the reading.
4. Minor left from review: lesson rows show English `glossEn` in vi (AI rows also show dictionary English).

## Environment
- Worktree node_modules = junction to `.worktrees/verify-db-erasure/node_modules` (main checkout's lacks `yauzl`).
- :3000 = `next start` from this worktree (background task of the 2026-10-05 session; dies with that session).
- Local DB after the 2026-10-05 reset: Ep.729 = `ba522023-8eba-4929-924f-35ae69eacf99`, demo learner
  demo.korume@example.com / password123 with 5 evidence rows, dictionary imported.
- Measure/screenshot scripts: `.superpowers/sdd/summary-followups/{measure,list-shot}.mjs` (gitignored).
