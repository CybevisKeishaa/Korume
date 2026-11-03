# Ask Korume — resizable sheet, draggable mascot, Learning-context rail to Figma

- Date: 2026-10-31 · Status: **approved by the owner, deferred** (practice-listening ships first) · Builds on
  [2026-10-03-ask-korume-design.md](2026-10-03-ask-korume-design.md) §6.2–§6.3.
- Figma: `IwFHZDZdHW7qsSFiNbWrkd` node `215:15164` **"Companion Knowledge Assistant"** — the chat column and its
  right-hand **"Sidebar"** (`215:15575`: LEARNING CONTEXT / IN THIS CONVERSATION / A SMALL MEMORY).
  Link: `https://www.figma.com/design/IwFHZDZdHW7qsSFiNbWrkd/?node-id=215-15164`.
- Prototype the owner approved (click-and-drag, not a picture):
  [assets/2026-10-31-ask-korume-resizable-sheet-prototype.html](assets/2026-10-31-ask-korume-resizable-sheet-prototype.html).
  Open it beside `public/korume.png` (it loads the mascot from `/files/korume.png`; any static server that maps
  that path works). Its hex colours are copies of tokens, not new values — see §6.
- Where: its own worktree/branch (owner, 2026-10-31), cut from `master` **after** the three fixes of 2026-10-31 are on
  it (`72f0fd52` speech scores + idle worker log, `9013e20d` + `b8740a02` Korume invalid-block dropping).

## 1. Why

The owner opened Ask Korume on a Shadowing lesson and found:

1. The popup is a fixed `400 × 420` box (`--korume-popup-height`): too small to read an answer, and nothing lets
   them make it bigger except one fixed "Enlarge" jump.
2. The mascot that opens it sits in one fixed corner and can cover what they want to read.
3. The enlarged view's *Learning context* rail read as meaningless: a column of bare words, `ピン` three times, no
   meaning, no "seen N times", no lesson link — while Figma shows a few rich, relevant rows.
4. The overall chat "does not look like Figma yet".

Success, in the owner's words: open small and portrait as today, **drag it as big as I want and back**, the rail
appears once it is wide enough, it **looks like the Figma**, and nothing about it feels default-browser (scrollbars).

## 2. Goals

- G1 Resizable sheet: every edge and corner drags (width **and** height, portrait included); header drags to move.
- G2 Two layouts from one sheet: **small** (chat only) below a width breakpoint, **large** (chat + rail) at or above it.
- G3 Large layout is centred: crossing the breakpoint by dragging glides the sheet to the middle **on release**;
  the toggle button and header double-click do the same. Small goes back beside the mascot.
- G4 Splitter between chat and rail, draggable, double-click resets.
- G5 Draggable mascot launcher, position remembered.
- G6 Rail content matches Figma's Sidebar and is **relevant**: meaning + JLPT + "seen N times" + lesson link per row,
  only entities that matter to the conversation, no indistinguishable homographs.
- G7 The chat column's look follows `215:15164` (date divider, grounding line, user bubble, KORUME-signed answer card,
  example block, context card, action chips, composer + hint) — already partly built; this is the alignment pass.
- G8 Korume panes use a quiet custom scrollbar (§5.6).
- G9 Keep a visible way to the full chat page (`/korume/chat`), where past conversations live.

## 3. Non-goals

- No change to retrieval tools, the planner, the answer schema or quotas — except what §5.5 needs for relevance.
- No mobile/touch-first layout (desktop only, as every port so far); pointer events make touch work, untested.
- No new Korume persona block. Figma's top banner ("KORUME · A quiet place to understand Japanese" + "Learning with
  you") and Sidebar's persona card are **not** added as their own rows (owner agreed 2026-10-31): the tagline moves
  into the header in the large layout (§5.1). The persona card's strategy line ("You're strongest when examples come
  first…") stays out — the 2026-10-03 spec §6.3 already ruled "No strategy statement" (it would be invented).
- `/korume/chat` page layout is not redesigned here beyond sharing the improved `KorumeRail` (it renders the same
  component); its Figma pass can follow.

## 4. Anti-goals (would make this a failure even if it works)

- A sheet that jumps under the pointer mid-drag (centring must happen on release, never during).
- Raw hex/px in components: everything comes from tokens (§6).
- A rail that still lists every word of the line, or two rows a learner cannot tell apart.
- Losing the conversation state when switching small ↔ large (it is one dialog, one `useKorumeThread`).

## 5. Behaviour (decided)

### 5.1 Sheet

| | Small | Large |
|---|---|---|
| When | width < breakpoint | width ≥ breakpoint |
| Default size | `400 × 560`, clamped to the viewport minus margins | toggle target `1040 × 680`, clamped |
| Position | opens beside the mascot, growing **away** from the screen corner the mascot is in | centred |
| Header subtitle | "Kiến thức tiếng Nhật" (existing key) | "Một góc yên tĩnh để hiểu tiếng Nhật" (Figma tagline, new key in `messages/{vi,en}/companion.json`) |
| Anchor chip row | shown | hidden (the rail shows the anchor) |
| Rail | hidden | shown, beside the chat |

- Breakpoint: **720px** (prototype default; the owner may tune it — keep it one token).
- Minimum `340 × 380`; maximum viewport minus the margin on each side. A sheet never leaves the viewport; a window
  resize re-clamps it.
- Resize handles on all four edges and four corners (hit area ~10px; an ember hairline shows on hover/drag).
  West/north handles keep the opposite edge fixed.
- Header drag moves the sheet (not from its buttons). Header double-click = toggle.
- Crossing small → large **by dragging**: on pointer-up, animate to the centre (~220ms, the motion tokens).
  The toggle button and double-click: large = centred, small = back beside the mascot.
- Escape: large → small; small → close (replaces today's expanded/close order; the workspace Escape chain of
  2026-10-03 §6.2 is unchanged otherwise).
- The old backdrop (`korume-backdrop`) goes: the large sheet is still non-modal (`aria-modal="false"`), the video
  stays visible around it. *(Builder's call if a11y review wants it back — keep it optional.)*
- Remembered per browser (localStorage): mascot position, sheet rect, rail width. Opening from the mascot after a
  reload starts **small beside the mascot** (owner's default); the remembered rect is reused within the session.
  *(My call — the owner was told and may flip it.)*
- Header buttons: **open full chat** (icon; icon + "Tất cả cuộc trò chuyện" in large) → `/korume/chat?thread=<id>`
  through the existing `ensureThread()` + guarded navigation; **toggle size**; **close**.

### 5.2 Splitter

- Between chat and rail, large layout only. Rail width `260…520px`, chat never below `380px`. Default `320px`.
  Double-click resets. Remembered. No grid transition while dragging (it lags the pointer).
- `role="separator"`, `aria-orientation="vertical"`, keyboard: ←/→ moves it in steps when focused.

### 5.3 Mascot launcher

- Drag to move anywhere in the viewport (pointer capture; a press that moves < 4px is a click = open).
  Keyboard: Enter/Space opens (as today); arrow keys nudge it (builder's call on step).
- Remembered; re-clamped on resize. Hidden while the sheet is open (as today).
- It currently lives in the transcript column's grid cell (`workspace-shell.tsx` → `KorumeMascot`); dragging means it
  becomes `position: fixed` within the workspace. Keep `korume.rememberSelection` on press.

### 5.4 Chat column (Figma alignment)

Follow `215:15164` (and the prototype) for: `HÔM NAY` divider; the grounding line (only when `learner_exposure`
returned data — unchanged rule); right-aligned user bubble; avatar + `KORUME ·` signature + answer card; inline `jp`
runs as ember chips; example block with ruby, **Listen** and translation; context card (kind label, JLPT badge,
label + gloss, note, "open lesson"); followup action chips; composer card with the send button inside and the
"Enter để gửi · Shift+Enter xuống dòng" hint. Content rules (escaped text, no Markdown) are unchanged.

### 5.5 Rail — content and data

Rows follow Figma's Sidebar: a 32–36px glyph tile with the label, then meaning, then `JLPT Nx · Đã gặp N lần`
(or "Chưa gặp"), chevron → lesson link. Sections: **NGỮ CẢNH HỌC TẬP** (anchor sentence, translation, `mm:ss`
+ lesson title, click seeks/opens), **TRONG CUỘC TRÒ CHUYỆN NÀY**, **MỘT KỶ NIỆM NHỎ** (absent when none).

Data problems found 2026-10-31 on thread `37234c71-…` (local DB, `conversation_messages.grounding_json`):

1. **Every token of the anchor line becomes an entity.** `buildGroundedEntities` (`lib/korume/grounding.ts`) adds
   all `line_analysis` tokens with a dictionary entry → 美味しい, そう, 言う, 留める… for a question about ピン.
2. **Homographs.** `dictionary_lookup` returns every JMdict entry of a surface → `ent:1107060` pin, `ent:2855585`
   (one on dice/cards), `ent:2322860` ping — three rows labelled ピン.
3. **Rail shows only `label`.** `KorumeRail` (`components/korume/korume-rail.tsx`) ignores `gloss`, `jlpt`, `reading`.
4. **Meaning is English.** `gloss` is `glossEn`; for `vi` the row should prefer the Vietnamese gloss where the app has
   one (the vi word-gloss path, `word_gloss_vi`), else English.
5. **No "seen N times".** No row carried `seenCount`; `learner_exposure` either was not planned or returned 0.
   Investigate first — measure before choosing a fix.
6. **No translation** under the anchor (the line had no vi translation).
7. **Sheet passes `memory={null}`** always (`korume-sheet.tsx`); the chat page may differ. Wire the same memory source.

Decided direction:

- **Relevance:** the rail shows the entities **this turn's answer used** — those its `context_card`s reference — plus
  those the question names, ordered by that; tokens merely present in the line are not listed. Builder decides the
  exact rule after reading real threads; the anti-goal (§4) is the bar. Keep `grounding_json` storage as is (cards
  still validate against it); filter for display, or narrow what is stored — builder's call, with a migration note
  if stored shape changes (none expected).
- **Homographs:** collapse rows with the same label to the one the answer/line actually uses (the `line_analysis`
  `entSeq` for that token wins); if none can be chosen, show one row with the meanings joined, never three rows.
- Show `gloss` (vi-first), `jlpt`, `seenCount` per row (§5.5 layout).

### 5.6 Scrollbars

The app already restyles every scrollbar globally (`app/globals.css` ~L558: 12px, `--border` capsule, transparent
track, Firefox guard). Korume's chat scroller and rail use a quieter variant, like `.sentence-rail`: 8px, thumb
transparent at rest, `--border` on pane hover / focus-within, ember-tinted on thumb hover; track always reserved so
nothing shifts. Respect the Firefox `@supports` guard pattern already in `globals.css`.

## 6. Constraints

- **Tokens only.** Colours `hsl(var(--background|card|muted|border|foreground|muted-foreground|primary|primary-strong))`,
  spacing `--space-*`, type `--text-*` utilities (the 2026-10-14 type-normalization rule and its G4 gate), radius
  `rounded-sm/md/lg/full`, sizes via the existing `--korume-*` variables in `globals.css` (density-scaled with
  `--density-unit`, both theme blocks ~L272 and ~L487). New numbers (breakpoint, min/max, rail bounds, launcher size)
  become `--korume-*` tokens, not literals in TSX.
- The prototype's hex values map 1:1 to tokens: `#0b0d11` `--background`, `#12151b` `--muted`, `#171a20` `--card`,
  `#20242c` `--void-800` surface, `#26292e` `--border`, `#f5f4f0` `--foreground`, `#89909f` `--muted-foreground`,
  `#ff8a3d` `--primary`.
- Motion: existing motion tokens/doctrine; honour `prefers-reduced-motion` (no glide, jump instead).
- A11y: the sheet stays a labelled non-modal `dialog`; handles and splitter are pointer affordances with keyboard
  equivalents for the splitter and launcher; focus returns to the mascot on close (unchanged).
- Must not remount the player or the thread state on any resize/toggle (one component, CSS layout switch).
- Build/serve only in the worktree, never in the main checkout (shared `.next`).
- Proof in a real browser at the owner's viewport (1280×529 and taller): jsdom cannot measure drag, layout or focus.

## 7. Left to the builder

Exact handle hit sizes, easing curve, keyboard step sizes, whether rect persistence is localStorage or the existing
settings store, the relevance rule's details (§5.5), and test split (unit for pure geometry/clamping helpers;
Playwright for drag, centring-on-release, splitter, launcher drag-vs-click, persistence, reduced motion).

## 8. Files known to be involved

`components/shadowing-workspace/korume-sheet.tsx`, `korume-mascot.tsx`, `workspace-shell.tsx`;
`components/korume/korume-rail.tsx`, `message-list.tsx`, `answer-blocks.tsx`, `composer.tsx`;
`lib/korume/grounding.ts` (+ its tests); `app/globals.css` (`--korume-*`, scrollbar); `messages/{vi,en}/companion.json`
(`ask.sheet.*`, `ask.chat.*`, new tagline / open-all-chats label).
