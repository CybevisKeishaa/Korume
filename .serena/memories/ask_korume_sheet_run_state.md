# ask-korume-sheet — run state (2026-11-04)

- Branch `ask-korume-sheet`, worktree `.worktrees/ask-korume-sheet`, range `63e42083..b410fdb5`. NOT merged, not pushed.
\1
- `b410fdb5`: owner calls ruled (see Owner calls). Full vitest 6649 green, E2E 38/38, tsc clean, Claude Chrome check OK. Awaiting owner Chrome look + merge OK.
- Spec: `docs/superpowers/specs/2026-10-31-ask-korume-resizable-sheet-design.md` (+ prototype in `specs/assets/`). Figma `215:15164`, `215:15575`.
- Built: drag-resizable Korume sheet (small beside mascot ↔ large centred, glide), draggable mascot (arrow-key nudge), Figma rail (R4 named/card entities, homograph collapse, seen count, vi gloss), post-answer exposure pass (RLS client, one `within()`, TOOL_DEADLINE_MS).
- Gates: E2E gate x2 against the worktree build exited 0 (log empty, counts unconfirmed).
- Opus whole-branch review: 0 Critical, "ready with fixes".

## Fix round (DONE in `41ffd9ad`; optional 10–14 not done)
Important:
1. `korume-sheet.tsx:106` `bounds()` clamps to the viewport; the workspace root is `relative isolate`, so z-40 cannot beat `.app-nav` (z 30) and the sheet slides ~56px under the collapsed nav at 1280. Fix: clamp sheet AND mascot to the workspace root rect via one shared `workspaceBounds()` helper + ResizeObserver on the root (covers nav collapse/expand). E2E bounds against `[data-testid=shadowing-workspace]` box (also fixes E2E 13). Pass `workspaceRef` to the mascot instead of `parentElement.parentElement`.
2. `korume-rail.tsx:33-38` tile shows `glyph.slice(0,3)`, full label only sr-only. Fix: render the label visibly before the meaning (`<span lang="ja" class="font-jp text-foreground">{label}</span> — {meaning}`), tile aria-hidden, drop sr-only duplicate, update the rail test.
3. `korume-sheet.tsx:269-274` Escape in large layout unmounts rail/splitter → focus to body. Fix: focus `[data-korume-composer]` after toggle when focus was inside rail/separator; unit test on `document.activeElement`.
Minors:
4. `lib/korume/limits.ts:14-16` `turnLifetimeUpperBoundMs` + `TOOL_DEADLINE_MS`, update comment.
5. Delete dead key `ask.chat.openLesson` from `messages/{en,vi}/companion.json`.
6. `app/globals.css:270-271`, `492-493` stale popup token comment.
7. Update `docs/superpowers/run-state/ask-korume-sheet.md` from the ledger; lessons for `docs/lessons.md` owed (DoD §9).
8. `startDrag` / `splitterDown`: clearTimeout(glideTimer) + setGliding(false) (no glide under a drag).
9. `tests/e2e/korume-sheet.spec.ts` case 7: assert no `data-gliding` right after click; mutation-check.
Optional: 10 R4 substring noise (skip named label that is substring of a card label; ignore reading <2 chars); 11 collapsed homograph rows carry first entry's jlpt/seen/link (drop them or explicit `collapsed` flag); 12 mascot `place()` measures on every pointermove → resolve once on pointerdown; 13 sheet file 376 lines, CSS keyed on test id, grounding pill rounded-full → rounded-lg; 14 exposure pass rescans even if planner ran learner_exposure.

## Owner calls (ruled on Claude's recommendation in `b410fdb5`; owner may overturn)
- WCAG 2.2 SC 2.5.7: met by Enlarge/Shrink + Close (single-pointer alternative); mascot moves by arrow keys.
- Mascot hint copy: "Drag, or use the arrow keys, to move Korume" / vi equivalent — shipped.
- vi `ask.kind.*`: kept "Từ vựng / Ngữ pháp / Trợ từ".

## Sibling
- Rich answers / Plus depth spec `docs/superpowers/specs/2026-10-31-ask-korume-rich-answers-design.md` (`fdc8bef0`) still deferred.
