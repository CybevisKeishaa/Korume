# Ask Korume — Resizable Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shadowing workspace's Ask Korume popup a sheet you can resize and move. It switches between a small chat-only layout and a large chat + rail layout. The mascot can be dragged. The rail shows only relevant rows (meaning, JLPT, "seen N times"), and the look follows Figma `215:15164`.

**Architecture:** Pure geometry helpers in `lib/korume/sheet-geometry.ts` (clamp, resize, beside-the-mascot, centre) do all the arithmetic. `KorumeSheet` becomes one `position: fixed` element with an inline rect, and its layout is chosen by CSS from `data-layout="small|large"`. It never remounts. Every size is a `--korume-*` token, resolved to px with the existing `tokenPixels` probe. Rail relevance is a pure display filter over the stored grounding (`railEntities`). "Seen N times" comes from a server-side exposure pass over the entities the answer's cards use, run before the turn is stored.

**Tech Stack:** Next.js 14 App Router, React, Tailwind, Pointer Events, vitest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-ask-korume-resizable-sheet-design.md` (+ prototype `docs/superpowers/specs/assets/2026-10-31-ask-korume-resizable-sheet-prototype.html`, Figma `IwFHZDZdHW7qsSFiNbWrkd` `215:15164`, Sidebar `215:15575`).

## Global Constraints

- Tokens only: colours `hsl(var(--…))`, spacing `--space-*`, type `--text-*` utilities (L-052; `lib/typography-scan.test.ts` must stay green), radius `rounded-sm/md/lg/full`. Each new number below is a `--korume-*` token in **both** theme blocks of `app/globals.css` (~L272 and ~L487), scaled by `--density-unit`. Never put a px literal in TSX.
- New tokens (design px × `--density-unit`): `--korume-small-w` 400, `--korume-small-h` 560, `--korume-large-w` 1040, `--korume-large-h` 680, `--korume-min-w` 340, `--korume-min-h` 380, `--korume-breakpoint` 720, `--korume-rail-min` 260, `--korume-rail-max` 520, `--korume-rail-default` 320, `--korume-chat-min` 380, `--korume-handle` 10. Viewport margin = `--space-md`. Retire `--korume-popup-height`, `--korume-expanded-width`, `--korume-expanded-height`, `--korume-sheet-width` once nothing reads them (grep first).
- Motion: glide = `left/top/width/height` over `--duration-base` with `--ease-out-expo`. Under `prefers-reduced-motion: reduce` (and the app's `reduceMotion` preference, whatever the workspace already honours), it jumps instead. Never animate during a drag.
- Must not remount the player, the thread state or the sheet on any resize or toggle (spec §4, §6).
- Before any build or E2E, stop the owner's dev server. Build and serve only in `.worktrees/ask-korume-sheet`, with `Set-Location` in the same call ([[never-build-in-main-checkout]], L-017). Run vitest as `npx vitest run --reporter=dot` (L-035), lint as `npm run lint` (L-018).
- Before using a token class, check that `tailwind.config.ts` defines it (L-053). Look at the dark theme in Chrome before calling any visual task done.
- Copy: new keys go in both `messages/vi/companion.json` and `messages/en/companion.json`. VI: `ask.sheet.tagline` "Một góc yên tĩnh để hiểu tiếng Nhật", `ask.sheet.allChats` "Tất cả cuộc trò chuyện", `ask.sheet.resizeHandle` "Đổi kích thước Korume", `ask.sheet.splitter` "Chia cột trò chuyện và ngữ cảnh", `ask.sheet.moveMascot` "Kéo để di chuyển Korume", `ask.unseen` "Chưa gặp". EN: "A quiet place to understand Japanese", "All conversations", "Resize Korume", "Resize chat and context", "Drag to move Korume", "Not seen yet".
- Owner directive (ponytail): reuse existing code (`tokenPixels`, `clampPipDelta`'s pattern, `useVietnameseGloss`, `unionGrounding`, `smallMemoryFor`), keep the diff short, add no abstraction this plan does not name. Never cut tests, a11y or safety.

## Rulings (decisions the spec left to the builder)

- **R1 Rect memory.** The spec has two bullets that conflict (§5.1 "remembered per browser: … sheet rect" and "after a reload opens small beside the mascot"). The specific bullet wins. Opening from the mascot or with `k` always starts **small beside the mascot**, at the last small size used in this workspace mount (default `--korume-small-w/h`). The toggle's large size is the last large size of this mount (default `--korume-large-w/h`). Both live in a ref in `useKorumeOverlay`, so a new draft (`key` change) keeps them. Only the mascot position (`korume.launcher`) and rail width (`korume.rail`) go to localStorage. Tell the owner, who may flip it.
- **R2 Escape.** Inside the sheet: large → small, small → close. An Escape outside the sheet still runs the shell's `close-korume` (unchanged).
- **R3 Backdrop removed.** No `korume-backdrop`; the large sheet is non-modal (`aria-modal="false"`).
- **R4 Relevance (display only, storage unchanged).** Rail rows are the union of the thread's grounding, filtered to entities (a) referenced by any answer's `context_card` (in order of first reference), then (b) whose `label` or `reading` appears (NFKC) in any user message. At most `RAIL_MAX_ROWS = 6`. Rows with the same `label` collapse into one: a card-referenced id wins; otherwise one row keeps the first id and joins the distinct glosses with " · ". Owner thread `37234c71…` gives そう, ピン留め, 保存 (measured 2026-11-03).
- **R5 Seen count.** Measured 2026-11-03 on the owner's DB: no entity in thread `37234c71…` has `seenCount`. The planner never asked for `learner_exposure`, or it returned 0, which `buildGroundedEntities` drops. Plans are not stored, so the planner's choice cannot be read back. Fix: after `dropUngroundedCards`, the server counts exposure for the distinct `ent:` ids the answer's cards reference (≤ 4), in **one** scan of seen lines. It merges `seenCount` (0 included), `seenCapped` and a readable `lessonLink` into the grounding before `completeTurn`. A failure or timeout leaves the grounding unchanged and never fails the turn. `seenCount: 0` renders "Chưa gặp". The grounding line ("Bạn đã thấy X…") requires `seenCount > 0`. The stored shape is unchanged (`seenCount` already allows 0), so no migration is needed.
- **R6 Vietnamese meaning.** A single-entity `ent:` row uses the existing `useVietnameseGloss(entSeq)` (read, then system-funded generation once per tab). It shows `glossesVi.join(", ")` when ready, else the stored English `gloss`. A collapsed homograph row shows the joined English. Only rail rows ask (≤ 6), and only in the large layout, where the rail is mounted.
- **R7 Memory in the sheet.** `getThread` adds `memory: SmallMemoryResult | null` to `KorumeThreadDetail`, computed by `smallMemoryFor` over `railEntities(messages)`. The chat page reads `detail.memory` (one source; drop its separate call). The sheet fetches `GET /api/korume/threads/:id` when it is large, the thread is created, and the answered-message count changed.

## Review Focus

1. **Window resize while open:** a sheet that would leave the viewport is re-clamped, and so is the mascot. Shrinking the window below `--korume-breakpoint + 2×margin` while large flips the layout to small without a jump in thread state. → Task 1 (clamp helpers), Task 2 E2E case "re-clamps on window resize".
2. **A click on a header button never starts a move, and double-clicking a button never toggles.** → Task 2 unit + E2E.
3. **Mascot press without movement opens and keeps the selection** (`rememberSelection` on pointerdown). A drag ≥ 4px moves it and does **not** open it. → Task 4 E2E (and existing korume.spec case 7 must stay green).
4. **A stored launcher position or rail width that is garbage or off-screen** (a bad JSON, a value from a bigger monitor) is clamped or ignored, never thrown. → Task 1 unit `parseStoredPoint`, Task 4.
5. **Seen count 0 must not produce "Bạn đã thấy X trong 0 câu".** → Task 5 test on the chat page grounding line.

---

### Task 1: Geometry helpers and tokens

**Files:**
- Create: `lib/korume/sheet-geometry.ts`, `lib/korume/sheet-geometry.test.ts`
- Modify: `app/globals.css` (tokens in both blocks), `components/shadowing-workspace/workspace-divider.tsx` (export `tokenPixels`)

**Interfaces:**
- Produces:
  - `type Rect = { x: number; y: number; w: number; h: number }`, `type Point = { x: number; y: number }`, `type Edge = "n"|"s"|"e"|"w"|"ne"|"nw"|"se"|"sw"`
  - `interface SheetBounds { vw: number; vh: number; margin: number; minW: number; minH: number }`
  - `clampRect(r: Rect, b: SheetBounds): Rect`: size first (min…viewport − 2·margin), then position.
  - `resizeRect(start: Rect, edge: Edge, dx: number, dy: number, b: SheetBounds): Rect`: W/N keep the opposite edge fixed (prototype algorithm), result clamped.
  - `besideLauncher(size: { w: number; h: number }, launcher: Rect, b: SheetBounds): Rect`: grows away from the screen corner the launcher's centre is in (prototype `rectFromLauncher`).
  - `centred(size: { w: number; h: number }, b: SheetBounds): Rect`
  - `clampRail(rail: number, sheetW: number, t: { railMin: number; railMax: number; chatMin: number }): number` = `clamp(rail, railMin, max(railMin, min(railMax, sheetW − chatMin)))`
  - `clampPoint(p: Point, size: { w: number; h: number }, b: Pick<SheetBounds, "vw"|"vh"|"margin">): Point`
  - `parseStoredPoint(raw: string | null): Point | null`: null for unparsable or non-finite values.
  - `export function tokenPixels(root: HTMLElement, token: string): number` (now exported from `workspace-divider.tsx`).

- [ ] **Step 1: Write failing tests** in `sheet-geometry.test.ts`. Use `b = { vw: 1280, vh: 529, margin: 16, minW: 340, minH: 380 }`.
  - `clampRect({x:-50,y:0,w:2000,h:100}, b)` → `{x:16,y:16,w:1248,h:380}`
  - `resizeRect({x:100,y:100,w:400,h:400}, "w", -50, 0, b)` → `{x:50,y:100,w:450,h:400}` (east edge stays at 500)
  - `resizeRect({x:100,y:100,w:400,h:400}, "nw", 200, 200, b)` → `w:340,h:380`, east edge 500, south edge 500
  - `resizeRect` past the viewport on "se" → clamped to `vw−margin`
  - `besideLauncher({w:400,h:560}, {x:1180,y:440,w:64,h:64}, b)` → right/bottom corner: `x = 1244−400 = 844`, `h` clamped to `497`, bottom edge ≤ `vh−margin`
  - `besideLauncher` with the launcher top-left `{x:20,y:20,…}` → `x:20,y:20`
  - `centred({w:1040,h:680}, b)` → `w:1040, h:497, x:120, y:16`
  - `clampRail(600, 900, {railMin:260, railMax:520, chatMin:380})` → `520`; `clampRail(300, 600, …)` → `260`
  - `parseStoredPoint("{bad")`, `parseStoredPoint('{"x":"a","y":1}')`, `parseStoredPoint(null)` → `null`; `'{"x":5,"y":6}'` → `{x:5,y:6}`
- [ ] **Step 2: Run** `npx vitest run lib/korume/sheet-geometry.test.ts --reporter=dot`. Expect FAIL (module missing).
- [ ] **Step 3: Implement** the helpers (pure, no DOM). Add the tokens to both `app/globals.css` blocks and export `tokenPixels`.
- [ ] **Step 4: Run** the same test plus `npx vitest run lib/typography-scan.test.ts components/shadowing-workspace --reporter=dot`. Expect PASS.
- [ ] **Step 5: Commit** `feat(korume): sheet geometry helpers and size tokens`.

### Task 2: The sheet moves, resizes and toggles

**Files:**
- Modify: `components/shadowing-workspace/korume-sheet.tsx`, `components/shadowing-workspace/korume-mascot.tsx` (`useKorumeOverlay` gains `sizes` ref, R1), `components/shadowing-workspace/workspace-shell.tsx` (pass the launcher rect getter), `components/shadowing-workspace/korume-overlay.test.tsx`, `messages/{vi,en}/companion.json`
- Create: `tests/e2e/korume-sheet.spec.ts` (reuse `seedKorumeData` / helpers from `tests/e2e/korume.spec.ts`; move the shared helpers to an existing helper module if one already exists, else export them from `korume.spec.ts`'s fixtures file)

**Interfaces:**
- Consumes: everything from Task 1.
- Produces:
  - `KorumeSheet` props gain `launcherRect: () => Rect | null` and `sizes: MutableRefObject<{ small: Size; large: Size } | null>`.
  - The DOM contract later tasks and E2E rely on: `[data-testid="korume-sheet"]` carries `data-layout="small"|"large"` (replaces `data-expanded`) and an inline `left/top/width/height` in px. Handles are `[data-korume-handle="<edge>"]`. The header has `[data-korume-drag]`.

- [ ] **Step 1: Rewrite the unit test** "enlarges to the middle…" in `korume-overlay.test.tsx` as "toggles to large and Escape returns to small before closing". Toggle button → `data-layout="large"`; Escape in the sheet → `"small"`; a second Escape → closed; `queryByTestId("korume-backdrop")` is null. Add "a double-click on the header toggles, a double-click on a header button does not". `fireEvent.doubleClick` on the title → `"large"`. `fireEvent.doubleClick` on the open-full-chat button → layout unchanged.
- [ ] **Step 2: Write the E2E cases** in `korume-sheet.spec.ts`, at viewport 1280×672 and 1280×529:
  1. Opens small beside the mascot: the sheet box is inside the viewport, and its right/bottom edges are within `--space-md` of the mascot's right/bottom.
  2. Dragging the `se` handle by (+120, −) grows width; the `w` handle keeps the right edge fixed (±1px).
  3. Dragging the `e` handle past 720 × density: mid-drag the sheet's `x` is unchanged (no jump under the pointer). After `mouse.up()` and the glide, it is centred (±2px) and `data-layout="large"`.
  4. Header drag moves the sheet; pressing on a header button and moving does not.
  5. Header double-click toggles; toggling back puts it beside the mascot.
  6. Re-clamps on window resize (`page.setViewportSize` smaller) → still inside the viewport.
  7. Reduced motion (`page.emulateMedia({ reducedMotion: "reduce" })`): toggle lands centred with no running transition (`getAnimations().length === 0` right after the click).
  8. Thread state survives toggles: send a seeded question, toggle large ↔ small twice, and the same messages are shown. The YouTube iframe element handle stays the same node (`elementHandle` equality via `isConnected` on the original handle).
- [ ] **Step 3: Run** `npx vitest run components/shadowing-workspace/korume-overlay.test.tsx --reporter=dot`. Expect FAIL. E2E is run at Step 5.
- [ ] **Step 4: Implement.**
  - The sheet is `fixed` with an inline rect (no grid placement, no `absolute`).
  - `layout = rect.w >= tokenPixels(root, "--korume-breakpoint") ? "large" : "small"`.
  - Handles are 8 absolutely positioned elements, `--korume-handle` thick, with an ember hairline (`bg-primary/60`) on hover or active. Their `aria-label` is `ask.sheet.resizeHandle`, and they are `aria-hidden` pointer affordances: the toggle is the keyboard path.
  - Drag code uses pointer capture. `user-select: none` on `body` during the drag; restore it and clear the selection on up.
  - Centring runs on release only, when a handle drag started small and ended large. Toggle and double-click: large → `centred(sizes.large)`; small → `besideLauncher(sizes.small, launcherRect())`.
  - Glide = a `data-gliding` attribute for one `--duration-base` that turns on the `transition` from Global Constraints. Skip it under reduced motion.
  - `resize` listener → `clampRect`.
  - Header layout:
    - left: title + subtitle (`ask.chat.knowledge` small, `ask.sheet.tagline` large);
    - right: open-full-chat (icon in small; icon + `ask.sheet.allChats` in large; the same `ensureThread` + guarded navigation as today, with the `Link` branch kept for a created thread), toggle, close.
  - The anchor chip row renders only in small.
- [ ] **Step 5: Run** the unit test (PASS). `playwright.config.ts` builds and serves the cwd on **:3000** itself (`npm run build && npm run start`, `reuseExistingServer`). So first free :3000: kill **every** listener, including the owner's dev server (L-017). Then run
  `Set-Location <worktree>; npx playwright test tests/e2e/korume-sheet.spec.ts tests/e2e/korume.spec.ts --workers=1`. Expect PASS.
  For Chrome looks, serve the worktree build on :3001 with `node node_modules/next/dist/bin/next start -p 3001`.
- [ ] **Step 6: Commit** `feat(korume): resizable, movable sheet with small and large layouts`.

### Task 3: Splitter and the rail column

**Files:**
- Modify: `components/shadowing-workspace/korume-sheet.tsx`, `tests/e2e/korume-sheet.spec.ts`, `components/shadowing-workspace/korume-overlay.test.tsx`

**Interfaces:**
- Consumes: `clampRail`, `tokenPixels`, `parseStoredPoint` pattern (for a number: `Number(localStorage.getItem("korume.rail"))`, finite-checked).
- Produces: `[role="separator"][aria-orientation="vertical"]` between chat and rail, `aria-valuenow` = rail px, `aria-valuemin/max` from `clampRail` bounds. The rail column has `[data-korume-rail]`.

- [ ] **Step 1: Unit test** "the splitter moves with arrow keys and resets on double-click". Focus the separator; `ArrowLeft` raises `aria-valuenow` by the step (rail grows when the splitter moves left); dblclick → default; `localStorage["korume.rail"]` is written.
- [ ] **Step 2: E2E cases** (append):
  9. Large: drag the separator 80px left → rail +80 (±1). The chat column is never below `--korume-chat-min`.
  10. Reload → the rail width persists. Mascot open → small (R1).
- [ ] **Step 3: Run**, then FAIL.
- [ ] **Step 4: Implement.**
  - Large body = `grid-template-columns: minmax(var(--korume-chat-min),1fr) auto var(--korume-rail-w)`, with `--korume-rail-w` set inline.
  - No transition on the grid while dragging.
  - Keyboard step: `--space-md` px (resolved through `tokenPixels`).
  - The rail mounts only in large, exactly as the expanded rail mounts today.
- [ ] **Step 5: Run** the unit test and E2E. Expect PASS.
- [ ] **Step 6: Commit** `feat(korume): draggable splitter between chat and rail`.

### Task 4: Draggable mascot launcher

**Files:**
- Modify: `components/shadowing-workspace/korume-mascot.tsx`, `components/shadowing-workspace/workspace-shell.tsx`, `tests/e2e/korume-sheet.spec.ts`, `components/shadowing-workspace/korume-overlay.test.tsx`

**Interfaces:**
- Consumes: `clampPoint`, `parseStoredPoint`.
- Produces: `KorumeMascot` keeps `onOpen/onPress/mascotRef`. Its box is `position: fixed` at the stored or default point. `launcherRect()` (used by Task 2) = `mascotRef.current.getBoundingClientRect()`, or, while the mascot is hidden (sheet open), its last known rect, kept in a ref.

- [ ] **Step 1: Unit test.** Arrow keys on the focused mascot button move it by `--space-md` and write `localStorage["korume.launcher"]`. A garbage stored value falls back to the default without throwing.
- [ ] **Step 2: E2E cases** (append):
  11. A press with < 4px movement opens the sheet (and korume.spec case 7, selection anchor, still passes).
  12. A drag of 200px moves the mascot, does **not** open the sheet, and survives a reload. Then opening places the sheet beside the new position (top-left mascot → sheet grows down-right).
  13. A stored position from a bigger window is clamped into the viewport.
- [ ] **Step 3: Run**, then FAIL.
- [ ] **Step 4: Implement.**
  - The default point is the old spot: bottom-right of the transcript cell minus `--space-md`, read from the cell's rect on first mount when nothing is stored.
  - Drag = pointer capture on the wrapper. Moved ≥ 4px → swallow the click (as `PipDragHandle` does). `onPress` (`rememberSelection`) still fires on pointerdown.
  - Re-clamp on `resize`. Keep `z-10` and hide while open (unchanged).
  - `aria-describedby` points to a visually hidden `ask.sheet.moveMascot` hint.
- [ ] **Step 5: Run** the unit test and E2E. Expect PASS.
- [ ] **Step 6: Commit** `feat(korume): draggable, remembered mascot launcher`.

### Task 5: Server — seen counts for card entities, memory on the thread detail

**Files:**
- Modify: `lib/korume/tools/exposure.ts` (split the scan from the count), `lib/korume/turn.ts`, `lib/korume/turn.test.ts`, `lib/korume/tools/exposure.test.ts`, `lib/data/korume.ts` (`getThread` → `memory`), `lib/korume/types.ts` (`KorumeThreadDetail.memory`), `app/[locale]/(protected)/(app)/korume/chat/page.tsx`, `components/korume/korume-chat-page.tsx` (`exposure` rule `> 0`), `components/korume/korume-chat-page.test.tsx`, `lib/korume/grounding.ts` (+ test)

**Interfaces:**
- Produces:
  - `scanSeenLines(ctx: RetrievalContext): Promise<{ lines: { videoId: string; lineId: string; tokens: AnalysisToken[] }[]; capped: boolean }>`, the body of today's `exposureTool` up to `staticAnalyses`. `exposureTool` = `scanSeenLines` + `countExposure` (behaviour unchanged; its tests stay green).
  - `exposureForEntities(ctx: RetrievalContext, entities: { id: string; label: string }[]): Promise<Map<string, { seenCount: number; capped: boolean; firstSeen?: { videoId: string; lineId: string } }>>`. One scan; for each `ent:<n>` id, `countExposure(label, new Set([n]), lines)`. `tok:` ids are skipped.
  - `railEntities(messages: readonly Pick<KorumeMessageView, "role"|"text"|"answer"|"grounding">[]): GroundedEntity[]` in `lib/korume/grounding.ts` (R4; `RAIL_MAX_ROWS = 6` exported).
  - `KorumeThreadDetail.memory: SmallMemoryResult | null` (R7).

- [ ] **Step 1: Failing tests.**
  - `grounding.test.ts` "railEntities keeps card-referenced and question-named entities only, collapses homographs": fixture = the owner thread's shape (R4). Expect labels `["そう","ピン留め","保存"]`. Then a variant whose question names ピン with three ピン ids, none card-referenced → one ピン row whose gloss contains "pin" and "ping".
  - `turn.test.ts` "counts exposure for the answer's card entities and stores 0 as seen 0". The stub `exposureForEntities` returns `ent:1 → 0`; the stored grounding has `seenCount: 0`. "an exposure failure still completes the turn with grounding unchanged".
  - `korume-chat-page.test.tsx` "no grounding line for seen 0".
  - The `getThread` test: `detail.memory` is the `smallMemoryFor` result.
- [ ] **Step 2: Run** `npx vitest run lib/korume components/korume lib/data --reporter=dot`. Expect FAIL.
- [ ] **Step 3: Implement.**
  - In `turn.ts`, after `dropUngroundedCards`, collect distinct card `entityRef`s that start with `ent:` (≤ 4). Await `within(exposureForEntities(...), clock.toolMs)` in try/catch, and log `console.warn("[korume/exposure] …")` on failure.
  - `firstSeen` → `lessonLink` only if `korume.readableVideoIds` says so (reuse the call already made: add those video ids to it).
  - Merge into the grounding before `answerToPlainText` / `completeTurn`. `DEFAULT_TOOLS`-style injection: `deps.exposureForEntities ?? exposureForEntities`.
  - Chat page: `exposure` = first entity with `seenCount > 0`; `memory` from `detail.memory`; the page no longer calls `smallMemoryFor` itself.
- [ ] **Step 4: Run** the same suites. Expect PASS. Also `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(korume): seen counts for the answer's entities; memory on thread detail`.

### Task 6: Rail rows like Figma's Sidebar

**Files:**
- Modify: `components/korume/korume-rail.tsx`, `components/korume/korume-rail.test.tsx`, `components/shadowing-workspace/korume-sheet.tsx` (rail gets `railEntities` + fetched memory), `components/korume/korume-chat-page.tsx` (`entities` = `railEntities`), `messages/{vi,en}/companion.json`

**Interfaces:**
- Consumes: `railEntities`, `KorumeThreadDetail.memory`, `useVietnameseGloss` (export it from `components/shadowing-workspace/drawer/word-card.tsx`; it is already exported).

- [ ] **Step 1: Failing tests** in `korume-rail.test.tsx`:
  - A row shows the glyph tile (first char of the label), the label, gloss, and `"N5 · Seen 3 times"`, plus a chevron link to the lesson.
  - `seenCount: 0` → `"Not seen yet"`; an absent `seenCount` → only the JLPT.
  - Under the `vi` locale, a mocked `fetch` for `/api/dictionary/gloss?entryId=1` returning `glossesVi:["ghim"]` → the row shows "ghim".
  - The anchor section shows `mm:ss` + the lesson title, and the translation when present.
  - Keep the existing assertions that still hold (no strategy sentence, memory link).
- [ ] **Step 2: Run** `npx vitest run components/korume --reporter=dot`. Expect FAIL.
- [ ] **Step 3: Implement** the row per the prototype's rail markup and Figma `215:15575`: tile `h-control-md aspect-square` (`size-control-md` does NOT exist — `control-md` is under `height`, L-053), `rounded-md`, `bg-muted`, `font-jp`; meaning `text-caption text-muted-foreground`, clamped to 2 lines.
  - Section headings: NGỮ CẢNH HỌC TẬP / TRONG CUỘC TRÒ CHUYỆN NÀY / MỘT KỶ NIỆM NHỎ (existing keys, uppercase tracking).
  - In the sheet: entities = `railEntities(thread.messages)`, and memory = R7 fetch.
- [ ] **Step 4: Run** the unit tests (PASS). Rebuild on :3001, then open a seeded thread large in Chrome and compare the rail to Figma `215:15575` (screenshot both).
- [ ] **Step 5: Commit** `feat(korume): relevant rail rows with meaning, level and seen count`.

### Task 7: Chat column to Figma, quiet scrollbars

**Files:**
- Modify: `components/korume/message-list.tsx`, `components/korume/answer-blocks.tsx`, `components/korume/composer.tsx`, `components/shadowing-workspace/korume-sheet.tsx`, `components/korume/korume-chat-page.tsx` (only to share the moved pieces), `app/globals.css`

**Interfaces:**
- Produces:
  - `useDividerLabel` and the grounding line move from `korume-chat-page.tsx` into `message-list.tsx` as `ConversationHeader({ messages })`, so the sheet and the page render one implementation.
  - The `.korume-scroll` CSS class.

- [ ] **Step 1: Gap list.** Open the prototype (served from the worktree's `public/` via a temporary copy, deleted afterwards), Figma `215:15164`, and the built sheet (large, seeded thread) side by side in Chrome at 1280×672. Write the gaps into the run-state as a table: divider, grounding line, user bubble, avatar + `KORUME ·` signature, inline `jp` ember chip, example block, context card, followup chips, composer + hint. Do not invent rows that the Figma frame does not show.
- [ ] **Step 2: Unit test** in `message-list.test.tsx`: the divider shows "Today" for a thread created now, and the grounding line appears only for `seenCount > 0`. Run it and expect FAIL until the move.
- [ ] **Step 3: Implement** each gap with tokens only.
  - `.korume-scroll` mirrors `.sentence-rail` (globals.css ~L592–L612): 8px, thumb transparent at rest, `hsl(var(--border))` on `:hover`/`:focus-within`, `hsl(var(--primary) / .5)` on thumb hover, `scrollbar-gutter: stable`, inside the same Firefox `@supports not selector(::-webkit-scrollbar)` guard.
  - Apply it to the sheet's `[data-korume-scroll]`, the rail column and the chat page's scroller.
- [ ] **Step 4: Run** `npx vitest run components/korume components/shadowing-workspace lib/typography-scan.test.ts --reporter=dot` (PASS). Rebuild, then re-screenshot against Figma in the dark theme; every gap row is closed or written up with a reason.
- [ ] **Step 5: Commit** `feat(korume): chat column follows Figma 215:15164; quiet scrollbars`.

### Task 8: Final gates, review, owner look

- [ ] **Step 1:**
  - `npx vitest run --reporter=dot` (full suite), `npm run lint`, `npx tsc --noEmit`, `npm run verify:protocol`.
  - E2E: `korume-sheet`, `korume`, `korume-threads`, `typography`, `practice-listening` (it touches Korume visibility), run ×2 at `--workers=1` on a fresh :3001 build.
  - Before the run, query and remove the fixture prefixes left by any aborted run (L-017).
- [ ] **Step 2:** Chrome at 1280×529 and 1280×672 (the owner's window), plus a 1920-wide same-origin iframe. Check: drag every edge, cross the breakpoint, splitter, mascot drag vs click, reload persistence, reduced motion, dark theme.
- [ ] **Step 3:** Whole-branch review (`git diff master...ask-korume-sheet`) on an opus code-reviewer. Then a fix round, which gets its own review (L-012).
- [ ] **Step 4:** The owner looks in Chrome. Merge `--no-ff` only after their OK.
