# Branch Run State

Branch `ask-korume-sheet`, worktree `.worktrees/ask-korume-sheet`, base master `63e42083`.

## Goal and scope

Ask Korume resizable sheet: resize/move, small and large layouts, splitter, draggable mascot, a relevant rail,
chat column to Figma `215:15164`, quiet scrollbars.

## Authorities

- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md`.
- Spec `docs/superpowers/specs/2026-10-31-ask-korume-resizable-sheet-design.md` (owner-approved 2026-10-31).
- Plan `docs/superpowers/plans/2026-11-03-ask-korume-resizable-sheet.md` (8 tasks, rulings R1–R7).

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| Plan + run state | done | `0fb9dd64` |
| Geometry helpers + size tokens | done | `6cd12774` |
| Resizable, movable sheet (small/large) | done, review round 1 | `38a3cd3b`, `9c91366d` |
| Splitter between chat and rail | done, review round 1 | `dcd1ed74`, `d1abc972` |
| Draggable, remembered mascot | done | `cf96aa40` |
| Seen counts + memory on thread detail | done, review round 1 | `f056e801`, `85dad2ed` |
| Relevant rail rows | done, review round 1 | `fd0a51e1`, `e46a4ded` |
| Chat column to Figma `215:15164` | done, review round 1 | `2f818d40`, `dfe84db3` |
| Whole-branch review (opus): 0 Critical, 3 Important, 6 minor | fix round | this commit |

## Contracts and decisions

- Rulings R1–R7 in the plan.
- Measured 2026-11-03 on the owner's DB (read only): thread `37234c71…` stores 11 grounding rows and none has
  `seenCount`. Cards reference `ent:1006610` そう, `ent:2833406` ピン留め and `ent:1513940` 保存.

## Verification

- Whole-branch fix round (2026-11-04): sheet absolute in the workspace root, clamped to its box via a ResizeObserver
  (was the viewport: slid under the app nav); mascot clamps to `workspaceRef` with the same observer; rail shows the
  full label before the meaning; Escape from the rail/splitter focuses the composer (mutation RED proven); a drag
  cancels a running glide; turn TTL bound adds `TOOL_DEADLINE_MS`; dead `ask.chat.openLesson` removed; token comment.
- E2E bounds now the `shadowing-workspace` box (new case 1b); case 7 reads `data-gliding` at once.

## Working tree and environment

- Owner: Claude
- `.env.local` copied from main; `npm ci` done in the worktree.

## Owner calls (decided 2026-11-04, owner: "follow your recommendation")

- WCAG 2.2 SC 2.5.7: the sheet's drag-move and drag-resize have single-pointer alternatives (Enlarge/Shrink toggles
  size and place; Close + the mascot reopens beside it). The mascot's spot is a convenience; arrow keys move it. No
  extra control built.
- Mascot hint: "Drag, or use the arrow keys, to move Korume" / "Kéo, hoặc dùng các phím mũi tên, để di chuyển Korume".
- vi `ask.kind.*`: kept Từ vựng / Ngữ pháp / Trợ từ (standard terms; 助詞 = trợ từ).

## Blockers

## Next actions

- Review of the fix round (sonnet), then the owner's Chrome look.
- Owner calls: WCAG 2.2 SC 2.5.7 (no non-drag sheet move), mascot hint copy, vi `ask.kind.*` wording.
- Optional, not done: R4 substring noise, collapsed homograph row metadata, mascot measures per pointermove.
- Sibling spec `2026-10-31-ask-korume-rich-answers-design.md` (`fdc8bef0`) still deferred.
