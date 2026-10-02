# Shadowing Workspace — Part 1b reframe: Shadowing is the practice surface — Design

- Date: 2026-10-02
- Branch: `shadowing-workspace-1b` (same branch; the reframe lands before T16 and before merge)
- Status: brainstormed with the owner 2026-10-02, approved in conversation with five locked points (all folded
  in below); this file awaits the owner's review of the written text before `writing-plans`.
- Parent: `2026-10-02-shadowing-workspace-part-1b-design.md` (the original 1b spec).

## 0. What this file supersedes

The owner used the built 1b in Chrome and ruled that per-sentence Vocabulary, Grammar and the nine-section AI
accordion make Shadowing cramped and belong elsewhere:

- **Shadowing** is the practice surface on the timeline: listen, repeat, follow the transcript, look a word up,
  take notes, mine.
- **Korume Companion in Shadowing** (a later project) answers deep questions about a sentence, anchored to it.
- **Summary / Analysis mode** (Part 4, Figma `125:1030`) owns curated lesson-level vocabulary, grammar,
  natural expressions, culture and review targets.

| Original 1b spec | Status after this file |
|---|---|
| §6.1 drawer: five tabs, collapsed shows five tabs | **Superseded**: two tabs, Mining · Notes (§2 here) |
| §6.2 entry points: ✨ on Live Sentence, row actions Vocabulary · Grammar · ✨ AI · Note | **Superseded**: the only drawer row action is Note; no ✨ anywhere |
| §6.3 popover: kanji → QuickInspect in the Vocabulary tab; phrase card ✨ Analyze; keyboard path through the Vocabulary tab | **Superseded**: kanji → drawer Inspector (§3); no Analyze; keyboard path §4 |
| §6.4 tabs Vocabulary, Grammar, AI | **Removed** from Shadowing |
| §6.4 tabs Mining, Notes; §6.5 KanjiQuickInspect content and the kanji page; §6.6 | Still in force (QuickInspect's *host* changes, §3) |
| §4 data, §5 services and API, §5.6 untrusted input, R11 | **Still in force.** Nothing in the database changes |
| §7 acceptance items about the removed surfaces; T15 step 5 live AI | Replaced by §6 here; live AI moves to the Korume project |

Anything this file does not mention keeps the original spec's ruling. A reviewer or agent must not restore a
removed surface from the original spec.

## 1. Kept infrastructure, dormant in Shadowing

Kept, unchanged, and still tested: dictionary snapshots and import, `KanjiDataService`, the Vietnamese gloss,
line analysis and `GET /api/lines/[id]/analysis`, lesson vocabulary and its endpoint, the mining-cards
endpoint, notes, the Knowledge core (cache, section registry with all eleven sections, orchestrator,
lease / reserve / settle, quota and cost ledger, kill-switch), `POST /api/knowledge/sections` and
`GET /api/knowledge/usage`.

**Dormant means no caller.** After the reframe, Shadowing has no UI entry point to `POST
/api/knowledge/sections` or `GET /api/knowledge/usage` — no ✨, no Analyze, no shortcut, no hidden control —
and never fetches lesson vocabulary or grammar. The routes keep auth, validation, rate limits, quota,
kill-switch and their transport and security tests. Korume or Summary defines the product-facing flow when it
first calls them.

What Shadowing still calls: line analysis and the dictionary for a word card (only when a selection or the
keyboard path asks), the gloss GET / POST of §6.3 (unchanged), kanji data for the Inspector, the
mining-cards endpoint when the Mining tab opens, notes.

## 2. Drawer

- Tabs: exactly **Mining · Notes**. Header, separator and its four levels, Follow / pinned, Focus hiding and
  restoring, player identity, and the T15 layout fixes are unchanged.
- Transcript rows keep one drawer action, **Note** (opens Notes pinned to that row, as before), beside the 1a
  controls (Mine, Pin to journal and the rest are unchanged); the Vocabulary, Grammar and ✨ AI actions go.
  The Mining tab is reached from the tab bar. Live Sentence loses its ✨ button.
- Drawer state loses `aiSection` and the Vocabulary drill-down (`wordEntSeq`, `kanji`); it gains the Inspector
  (§3).

## 3. Inspector: a transient drawer state

KanjiQuickInspect needs room for stroke order, On / Kun, common words and attribution: it moves from the
Vocabulary tab into a transient **Inspector** state of the drawer. The Inspector is not a tab.

```text
inspector: null | {
  stack:       [InspectorEntry, ...]      kanji (literal) | word (a KanjiCommonWord, shown as a word card)
  returnState: { tab, level, tracking, pinned }   snapshot taken once, when the Inspector opens
}
focusOrigin: the element that opened it    kept in a ref beside the reducer, not in state
```

- **Open**: a kanji button in a word card (popover or Inspector). From no Inspector: snapshot `returnState`,
  start `stack = [kanji]`, open the drawer to peek if it was collapsed. Inside the Inspector: push.
- A common word in a kanji entry pushes a **word** entry (its card is built from the KanjiCommonWord data, GET
  only, never a gloss generation — the T12 ruling); a kanji in that card pushes a kanji entry. One drawer, one
  stack; nothing nests.
- **Back** pops; Back on the root entry closes. **Close** and **Escape** close from any depth.
- **Closing restores `returnState` exactly** — tab, level (a drawer opened from collapsed collapses again),
  tracking and pinned target. Navigation inside the Inspector never edits the snapshot.
- The Inspector **never changes the drawer's target**: opening a kanji neither pins nor unpins a sentence and
  never switches follow / pinned. It is a lexical lookup, not a learning-session target.
- Focus: on close, return to `focusOrigin` if it is still connected; otherwise to the drawer's tab list.
- While open, the drawer shows the Inspector header (**←**, the entry's title, **Close**) instead of the tab
  content; the tab bar stays visible and choosing a tab closes the Inspector into that tab (the snapshot's
  level and target still apply).
- The player never remounts and playback never pauses. **View full details** navigates to `/kanji/[literal]`
  in the same browser tab.
- **Escape order** (one press, one layer): popover → Inspector → drawer (to collapsed) → fullscreen → Focus /
  Full Transcript.

## 4. Selection popover and the keyboard path

- One token → word card (headword, reading, POS, senses, Vietnamese gloss as before, kanji buttons → §3),
  plus **Play sentence · Bookmark sentence · Add to Mining**.
- Several tokens → phrase card: the selected text plus the same three actions. **No Analyze.**
- **Keyboard path (replaces the Vocabulary tab's token buttons):** Live Sentence's Japanese text becomes
  focusable (`tabIndex=0`, labelled "Look up words in this sentence"). **Enter** opens the popover in a
  *token list* state: the sentence's tokens as buttons; choosing one shows its word card, with ← back to the
  list. Same popover, same data (line analysis, fetched only on this Enter). Transcript rows keep their 1a
  keyboard behaviour (the seek button); a keyboard learner looks words up on Live Sentence.

## 5. What is deleted

`drawer/vocabulary-tab`, `grammar-tab`, `ai-tab`, `ai-section`, `ai-usage`, `section-renderers`,
`ai-knowledge-context`, the wrapped AI dispatch in `drawer-context`, their tests and EN/VI strings and pins;
`AI_GRAMMAR_SHORTCUT`, `OPENING_SECTION` and `SECTION_VIEW` from `lib/knowledge/types.ts`; the `/grammar`
page's per-point anchors stay (harmless, linkable). Git history keeps everything.

## 6. Acceptance

Proves what remains **and** that the removed surfaces are gone.

- **Unit:** Inspector open → push word → push kanji → Back ×2 → Close restores tab, level, tracking and pinned
  exactly; opened from collapsed → closes to collapsed; opening never changes the target (pinned and follow);
  Escape closes the Inspector before collapsing the drawer; focus returns to the origin, or the tab list when
  the origin is gone; choosing a tab while inspecting closes into that tab. Keyboard path: Enter on Live
  Sentence lists tokens, a token opens its word card, Back returns to the list.
- **Absence (unit and e2e):** the drawer's tab list contains exactly Mining and Notes; no Vocabulary, Grammar
  or AI tab; no ✨ / AI control on Live Sentence or any row; a multi-token selection shows no Analyze; opening
  the lesson and playing 10 sentences sends **no** `POST /api/knowledge/sections`, **no** `GET
  /api/knowledge/usage`, no lesson-vocabulary request, and creates no `ai_reservations` or `ai_generations` row
  for the learner.
- **Kept flows (e2e):** select → word card → kanji → Inspector → common word → Back → Close (tab and level
  restored, player identity, no pause); note survives a reload; Mining tab lists the lesson's cards; separator
  keys and drag; Escape order; Focus hides and restores; layout at 1280×529 (the T15 test 11 contract).
- **Knowledge core stays proven:** every `verify:db:*` gate, the orchestrator / store / registry suites, and
  the API-level transport tests — a Free learner's response for a locked section never contains the full
  entry's sentinel while a Plus learner's does; a body naming tier or variant is a 400; an uncached section
  with AI disabled is a 503.
- **Chrome pass** at 1280×529, vi and en: drawer, popover, Inspector, row toolbar (now shorter).
- Live AI against a real provider is **not** part of this branch; it moves to the Korume project with the
  first consumer.

## 7. Out of scope

Korume Companion in Shadowing (mascot, sentence-anchored chat, conversation memory); Summary / Analysis mode
(Part 4); Pronunciation (Part 2) and Listening Practice (Part 3); any database change; any change to the
Knowledge core's contracts.
