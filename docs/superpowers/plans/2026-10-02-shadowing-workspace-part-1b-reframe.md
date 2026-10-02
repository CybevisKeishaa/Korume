# Shadowing Workspace Part 1b Reframe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 1b drawer back into a practice tool — Mining · Notes plus a transient kanji Inspector — remove every Vocabulary / Grammar / AI surface and ✨ / Analyze entry point, and keep the dictionary and Knowledge core as dormant, still-tested infrastructure.

**Architecture:** The drawer reducer loses the Vocabulary drill-down and `aiSection` and gains an `inspector` (a stack plus a `returnState` snapshot). The selection popover's kanji buttons open the Inspector; a keyboard path on Live Sentence replaces the Vocabulary tab's token buttons. Word lookup reads a new `scope=lexical` projection of the line analysis that never touches grammar. Server-side Knowledge code is untouched.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind tokens, Radix (only inside `components/ui`), Vitest + Testing Library (jsdom), Playwright, Supabase local.

**Spec:** `docs/superpowers/specs/2026-10-02-shadowing-workspace-part-1b-reframe-design.md` (locked). Parent: `docs/superpowers/specs/2026-10-02-shadowing-workspace-part-1b-design.md` (UI scope superseded). Original plan: `docs/superpowers/plans/2026-10-02-shadowing-workspace-part-1b.md` (T16a / T16b follow this plan).

## Global Constraints

- Branch `shadowing-workspace-1b`, worktree `.worktrees/shadowing-workspace-1b`; base `32b5e07`. Never build in the main checkout; serve e2e with `AI_PROVIDER=none npx next start -p 3000` from the worktree (the owner's dev server is on 3005).
- No database change. No change to `lib/knowledge/{orchestrator,store,memory-store,registry,cache-key,canonical,config,entitlement,periods,pricing,backoff}.ts`, `lib/knowledge/sections/*`, `app/api/knowledge/**`, `lib/data/knowledge.ts`.
- Drawer tabs are exactly `["mining", "notes"]`. No ✨, no "AI", no Analyze control anywhere in Shadowing.
- Shadowing never calls `POST /api/knowledge/sections`, `GET /api/knowledge/usage` or the lesson-vocabulary endpoint; every analysis request it sends carries `scope=lexical`.
- Every user-facing string in `messages/en/shadowing.json` and `messages/vi/shadowing.json`; insert JSON textually (never re-dump the catalog); every new EN leaf gets a pin in `messages/en/shadowing.pin.test.ts`; removed keys lose their pins.
- No component in `app/` or `components/` spells a compound section name (registry grep test). Radix only inside `components/ui`. Icons are inline SVG in `player-glyphs.tsx`.
- TDD: each test watched failing first; one mutation per behaviour fix; gates after the LAST edit: `npx tsc --noEmit`, `npm run lint`, `npm run verify:protocol`, `npx vitest run --minWorkers=1 --maxWorkers=2`.
- e2e sources never call `Date.now()` (repo guard). Every ledger deviation is a `Ruling:` line.

## Review Focus

1. Inspector opened from a **pinned span** target, then a tab chosen from the tab bar → the pin and its span survive (the tab-select path must restore `drawerTarget`, not just close).
2. Inspector opened while **following**, playback advances 5 sentences, Close → still following, target = the *current* sentence (the snapshot stores `tracking: follow`, not a frozen line).
3. A kanji whose data fails to load inside the Inspector → the error text shows, ← and Close still work, focus does not get lost.
4. Keyboard path on Live Sentence while the sentence **advances** under an open token list → the list keeps the line it opened on (content fixed at open, like the popover).
5. A cached **full** analysis in the server memo (from a `full` request) must not be served to a `lexical` request with its `grammar` field, and a `lexical` memo entry must not satisfy a later `full` request.

Each line has its test in the owning task (Tasks R1–R4), marked "(Review Focus n)".

---

### Task R1: Lexical scope of the line analysis

**Files:**
- Modify: `lib/analysis/line-analysis.ts`, `lib/analysis/types.ts`, `app/api/lines/[lineId]/analysis/route.ts`, `components/shadowing-workspace/use-line-analysis.ts`
- Test: `lib/analysis/line-analysis.test.ts`, `app/api/lines/[lineId]/analysis/route.test.ts`

**Interfaces:**
- Produces: `type AnalysisScope = "lexical" | "full"` (in `lib/analysis/types.ts`); `LexicalLineAnalysis = Omit<StaticLineAnalysis, "grammar">`; `staticAnalyses(supabase, lines, now?, scope?: AnalysisScope)`; `getLineAnalysisForLearner(lineId, scope?: AnalysisScope)`; client `fetchLineAnalysis(lineId)` always requests `?scope=lexical` and returns `LexicalLineAnalysisDto` (= `LineAnalysisDto` without `grammar`).

- [ ] **Step 1: Failing service tests** in `lib/analysis/line-analysis.test.ts` (reuse the file's supabase mock):
  - `staticAnalyses(supabase, [line], now, "lexical")` returns an analysis **without a `grammar` key** and the mock records **zero** `from("grammar_points")` calls.
  - `full` after `lexical` for the same line returns `grammar` (memo keys differ) and loads grammar once (Review Focus 5).
  - `lexical` after `full` returns no `grammar` key (Review Focus 5).
- [ ] **Step 2: Failing route tests:** `GET …/analysis?scope=lexical` calls `getLineAnalysisForLearner(lineId, "lexical")`; no scope → `"full"`; `?scope=other` → 400 and the service is not called.
- [ ] **Step 3: Run** `npx vitest run lib/analysis/line-analysis.test.ts "app/api/lines/[lineId]/analysis/route.test.ts"` — Expected: the new tests FAIL.
- [ ] **Step 4: Implement.** In `staticAnalyses` add `scope: AnalysisScope = "full"`; load grammar only for `full`:

```ts
const [snapshotId, grammar] = await Promise.all([
  getActiveSnapshotId(),
  scope === "full" ? grammarPatterns(supabase, now) : Promise.resolve(null),
]);
const keyOf = (lineId: string) => `${scope}|${lineId}|${snapshotId ?? "none"}|${grammar?.revision ?? ""}`;
// … per line:
const analysis = grammar
  ? { lineId: line.id, snapshotId, tokens: analysisTokens, grammar: matchGrammar(analysisTokens, grammar.patterns) }
  : { lineId: line.id, snapshotId, tokens: analysisTokens };
```

  Type the memo as `Map<string, StaticLineAnalysis | LexicalLineAnalysis>` and the return as `Map<string, LexicalLineAnalysis>` for lexical (overloads or a generic on `scope`). `lesson-vocabulary.ts` passes `"lexical"` (it never reads `grammar`). `getLineAnalysisForLearner(lineId, scope = "full")` forwards the scope. The route reads `new URL(request.url).searchParams.get("scope")`: `null → "full"`, `"lexical" | "full"` pass, anything else → `400 { error: "Invalid input" }`. The client hook fetches `/api/lines/${lineId}/analysis?scope=lexical`.
- [ ] **Step 5: Run** the two files — Expected: PASS. Mutation: compute `matchGrammar` for lexical too → the "no grammar key / zero grammar_points" test FAILS; restore.
- [ ] **Step 6: Commit** `feat(analysis): lexical scope that never runs the grammar matcher`.

### Task R2: Drawer state — Mining · Notes and the Inspector

**Files:**
- Modify: `lib/shadowing-workspace/drawer-state.ts`, `lib/shadowing-workspace/workspace-view.ts`
- Test: `lib/shadowing-workspace/drawer-state.test.ts`, `lib/shadowing-workspace/workspace-view.test.ts` (create if absent; otherwise extend the existing escape tests)

**Interfaces:**
- Produces:

```ts
export const DRAWER_TABS = ["mining", "notes"] as const;
export type InspectorEntry = { kind: "kanji"; literal: string } | { kind: "word"; word: KanjiCommonWord };
export interface InspectorReturnState { tab: DrawerTab; level: DrawerLevel; tracking: "follow" | "pinned"; drawerTarget: DrawerTarget | null }
export interface DrawerState {
  level: DrawerLevel; tab: DrawerTab; tracking: "follow" | "pinned"; pinned: DrawerTarget | null;
  inspector: { stack: InspectorEntry[]; returnState: InspectorReturnState } | null;
}
export type DrawerAction =
  | { type: "open"; tab: DrawerTab; target?: DrawerTarget }
  | { type: "set-level"; level: DrawerLevel } | { type: "step"; delta: 1 | -1 }
  | { type: "select-tab"; tab: DrawerTab } | { type: "follow" } | { type: "collapse" }
  | { type: "inspect"; entry: InspectorEntry }      // opens, or pushes when already open
  | { type: "inspector-back" }                       // pops; on the root entry, closes
  | { type: "inspector-close" };
export const initialDrawerState: DrawerState = { level: "collapsed", tab: "mining", tracking: "follow", pinned: null, inspector: null };
// workspace-view.ts
export type EscapeAction = "close-popover" | "close-inspector" | "collapse-drawer" | "exit-fullscreen" | "exit-view" | "none";
export function escapeAction(state: { popoverOpen: boolean; inspectorOpen: boolean; drawerOpen: boolean; fullscreen: FullscreenTarget; view: WorkspaceView }): EscapeAction;
```

- [ ] **Step 1: Replace the obsolete reducer tests** (Vocabulary drill-down, `aiSection`, "a new target drops the word and kanji") with failing tests:
  - initial state: collapsed, tab `mining`, following, no inspector;
  - `inspect` from collapsed + pinned `{line-42, span {2,5}}`, tab notes → level `peek`, `inspector.stack = [kanji]`, `returnState = { tab: notes, level: collapsed, tracking: pinned, drawerTarget: {line-42, span {2,5}} }`, and `pinned` / `tracking` **unchanged**;
  - `inspect` word, then `inspect` kanji → stack length 3, `returnState` identical (deep-equal to the first snapshot);
  - `inspector-back` ×2 → stack length 1; `inspector-back` again → `inspector: null`, level `collapsed`, tab notes, pinned `{line-42, span {2,5}}`;
  - `inspector-close` from depth 3 restores the same snapshot;
  - following (no pin) → `inspect` → `inspector-close` → `tracking: follow`, `pinned: null` (Review Focus 2);
  - `select-tab` mining while inspecting → `inspector: null`, tab mining, level = snapshot's level opened (`peek` if the snapshot was collapsed, since a tab select opens), `pinned` = snapshot's target with its span (Review Focus 1);
  - `open` (a row action) while inspecting → inspector closed, new target pinned.
- [ ] **Step 2: Failing escape tests:** `escapeAction({ popoverOpen: false, inspectorOpen: true, drawerOpen: true, … })` → `close-inspector`; popover still wins over the inspector; with the inspector closed the old order holds.
- [ ] **Step 3: Run** `npx vitest run lib/shadowing-workspace` — Expected: FAIL.
- [ ] **Step 4: Implement.**

```ts
const snapshot = (state: DrawerState): InspectorReturnState => ({
  tab: state.tab, level: state.level, tracking: state.tracking, drawerTarget: state.pinned,
});
const restore = (state: DrawerState, back: InspectorReturnState): DrawerState => ({
  ...state, inspector: null, tab: back.tab, level: back.level, tracking: back.tracking, pinned: back.drawerTarget,
});
// in drawerReducer:
case "inspect":
  return state.inspector
    ? { ...state, inspector: { ...state.inspector, stack: [...state.inspector.stack, action.entry] } }
    : { ...state, level: opened(state.level), inspector: { stack: [action.entry], returnState: snapshot(state) } };
case "inspector-back": {
  if (!state.inspector) return state;
  const stack = state.inspector.stack.slice(0, -1);
  return stack.length > 0 ? { ...state, inspector: { ...state.inspector, stack } } : restore(state, state.inspector.returnState);
}
case "inspector-close": return state.inspector ? restore(state, state.inspector.returnState) : state;
case "select-tab": {
  const base = state.inspector ? restore(state, state.inspector.returnState) : state;
  return { ...base, tab: action.tab, level: opened(base.level) };
}
case "open": {
  const base = state.inspector ? { ...state, inspector: null } : state;
  const next = action.target ? { ...base, tracking: "pinned" as const, pinned: action.target } : base;
  return { ...next, tab: action.tab, level: opened(state.level) };
}
```

  Delete `open-kanji`, `open-word`, `back`, `kanji`, `wordEntSeq`, `aiSection`. `escapeAction` returns `close-inspector` after `close-popover` and before `collapse-drawer`.
- [ ] **Step 5: Run** — Expected: PASS. Mutation: `restore` sets `pinned: state.pinned` → the span-restore tests FAIL; restore.
- [ ] **Step 6: Do not commit yet** — `tsc` breaks until R3 removes the consumers; R3 commits both.

### Task R3: Remove the analysis surfaces; drawer renders Mining · Notes · Inspector

**Files:**
- Delete: `components/shadowing-workspace/drawer/{vocabulary-tab,vocabulary-tab.test,grammar-tab,ai-tab,ai-tab.test,ai-section,ai-usage,section-renderers,section-renderers.test,ai-knowledge-context,phrase-card}.tsx`
- Create: `components/shadowing-workspace/drawer/inspector.tsx`, `components/shadowing-workspace/drawer/inspector.test.tsx`
- Modify: `drawer/drawer-context.tsx` (drop the AI-wrapped dispatch and `AiKnowledgeProvider`; add `focusOrigin` ref), `drawer/utility-drawer.tsx`, `drawer/drawer-header.tsx` (doc comment: two tabs), `drawer/word-card.tsx` (drop `requestGloss`), `drawer/study-tabs.test.tsx` (delete the Grammar describe), `drawer/utility-drawer.test.tsx`, `selection-popover.tsx`, `selection-popover.test.tsx`, `live-sentence.tsx`, `live-sentence.test.tsx`, `transcript-row.tsx`, `player-glyphs.tsx`, `workspace-shell.tsx` (Escape), `lib/knowledge/types.ts` (remove `AI_GRAMMAR_SHORTCUT`, `OPENING_SECTION`, `PHRASE_SECTION`, `SectionView`, `SECTION_VIEW`), `components/ui/token-scale.test.ts` (scan count), `messages/{en,vi}/shadowing.json`, `messages/en/shadowing.pin.test.ts`

**Interfaces:**
- Consumes: R2's `DrawerState`, `InspectorEntry`, actions `inspect | inspector-back | inspector-close`, `escapeAction({ inspectorOpen })`.
- Produces: `useDrawer()` returns `{ state, dispatch, target, focusOrigin: MutableRefObject<HTMLElement | null> }`; `<Inspector />` rendered by `UtilityDrawer` when `state.inspector` is set; transcript row actions `[{ tab: "mining", label: "workspace.transcript.openMining", Glyph: CardsGlyph }, { tab: "notes", label: "workspace.transcript.openNote", Glyph: NoteGlyph }]`; `WordCard({ token, onOpenKanji })` always uses the GET → POST-if-missing gloss flow.

- [ ] **Step 1: Failing tests.**
  - `inspector.test.tsx` (render the workspace shell like `study-tabs.test.tsx`; stub `GET /api/kanji/[literal]`-style data the way `kanji-quick-inspect.test.tsx` does): a kanji button in the popover's word card opens the Inspector — header **Back**, the kanji as title, **Close** — showing QuickInspect; the tab list still has exactly two tabs; a common word opens its word card inside the Inspector and its Vietnamese gloss is POSTed once when GET says `missing` (vi locale); a kanji in that card pushes; Back walks back; Close restores the tab and level; focus lands on the tab list when the origin (the popover's kanji button) is gone; a kanji whose data request fails shows the error and Back / Close still work (Review Focus 3); the player DOM node is the same before and after; Escape closes the Inspector first, then the drawer.
  - `utility-drawer.test.tsx`: "two tabs, Mining and Notes" replaces "five tabs"; delete "Live Sentence ✨ …" and "on the AI tab without a single request" and add **absence** tests: no tab named Vocabulary / Grammar / AI; Live Sentence has no ✨ / "AI" control; each row's action group has "Cards from this sentence" and "Note" and nothing named Vocabulary, Grammar or AI explanation; ten sentence changes with the drawer open on Notes → `fetch` never called with `/api/knowledge/` or `/vocabulary`.
  - `selection-popover.test.tsx`: a multi-token selection shows the phrase text and the three actions and **no** "Analyze"; the kanji button dispatches `inspect` (the Inspector opens) and does not change the drawer target.
- [ ] **Step 2: Run** `npx vitest run components/shadowing-workspace lib/shadowing-workspace` — Expected: the new tests FAIL (and tsc errors from R2 remain).
- [ ] **Step 3: Implement.**
  - Delete the files listed above. `selection-popover.tsx`: replace `PhraseCard` with an inline `<p lang="ja" className="font-jp text-body text-foreground">{resolved.text}</p>`; `onOpenKanji={(literal) => { focusOrigin.current = document.activeElement as HTMLElement | null; dispatch({ type: "inspect", entry: { kind: "kanji", literal } }); close(); }}`.
  - `inspector.tsx`:

```tsx
const BACK = "inline-flex h-control-sm items-center gap-2xs rounded-md px-xs text-caption text-muted-foreground hover:bg-muted hover:text-foreground";

export function Inspector() {
  const t = useTranslations("shadowing");
  const { state, dispatch, focusOrigin } = useDrawer();
  const entry = state.inspector?.stack.at(-1);
  if (!entry) return null;
  const title = entry.kind === "kanji" ? entry.literal : entry.word.headword;
  return (
    <section aria-label={t("workspace.inspector.label", { title })} className="space-y-xs">
      <div className="flex items-center gap-xs">
        <button type="button" onClick={() => dispatch({ type: "inspector-back" })} className={BACK}>
          <BackGlyph className="size-icon-xs" />{t("workspace.inspector.back")}
        </button>
        <h3 lang="ja" className="min-w-0 flex-1 truncate font-jp text-body font-semibold text-foreground">{title}</h3>
        <button type="button" onClick={() => dispatch({ type: "inspector-close" })} className={BACK}>{t("workspace.inspector.close")}</button>
      </div>
      {entry.kind === "kanji"
        ? <KanjiQuickInspect key={entry.literal} literal={entry.literal} onOpenWord={(word) => dispatch({ type: "inspect", entry: { kind: "word", word } })} />
        : <WordCard key={entry.word.entSeq} token={commonWordToken(entry.word)} onOpenKanji={(literal) => dispatch({ type: "inspect", entry: { kind: "kanji", literal } })} />}
    </section>
  );
}
```

    (`commonWordToken` moves here from the deleted vocabulary tab, unchanged.) Focus on close: in `DrawerStateProvider`, a `useEffect` on `state.inspector === null` transitions from non-null focuses `focusOrigin.current` if `isConnected`, otherwise the selected tab button (`document.getElementById(drawerTabId(state.tab))`), then clears the ref.
  - `utility-drawer.tsx`: when `state.inspector` render `<Inspector />` instead of the target sentence + tab content; otherwise `mining` → `<MiningTab />`, `notes` → `<NotesTab />`.
  - `workspace-shell.tsx`: pass `inspectorOpen: drawerShown && drawer.state.inspector !== null` to `escapeAction`; `close-inspector` → `drawerDispatch({ type: "inspector-close" })`.
  - `live-sentence.tsx`: delete the ✨ button. `transcript-row.tsx`: `DRAWER_ACTIONS` = Mining cards + Note; add `CardsGlyph` to `player-glyphs.tsx` (two stacked rounded rectangles, inline SVG); remove `SparklesGlyph`, `VocabularyGlyph`, `GrammarGlyph`.
  - `word-card.tsx`: drop the `requestGloss` prop (spec §3: an opened common word may generate).
  - Messages (EN / VI, textual edits): delete `workspace.ai`, `workspace.vocabulary`, `workspace.grammar`, `workspace.drawer.tabs.{vocabulary,grammar,ai}`, `workspace.transcript.{openVocabulary,openGrammar,openAi}`, `workspace.liveSentence.explain`, `workspace.selection.analyze`; add `workspace.transcript.openMining` = "Cards from this sentence" / "Thẻ của câu này", `workspace.inspector` = `{ "label": "Look-up: {title}", "back": "Back", "close": "Close" }` / `{ "label": "Tra cứu: {title}", "back": "Quay lại", "close": "Đóng" }`. Update the pins (delete the AI / Vocabulary / Grammar describes; add Inspector; update the drawer and transcript pins).
  - `lib/knowledge/types.ts`: remove the five UI-only exports; `npx tsc --noEmit` finds any straggler.
  - `token-scale.test.ts`: recount `components/shadowing-workspace` sources (`ls components/shadowing-workspace components/shadowing-workspace/drawer | grep -v test`) and update the number with a `Part 1b reframe:` comment line.
- [ ] **Step 4: Run** `npx vitest run components/shadowing-workspace lib/shadowing-workspace lib/knowledge messages components/ui/token-scale.test.ts` and `npx tsc --noEmit` — Expected: PASS, 0. Mutations: (a) `Inspector` close forgets the snapshot (dispatch `collapse`) → the restore test FAILS; (b) restore a ✨ button on Live Sentence → the absence test FAILS. Restore both.
- [ ] **Step 5: Commit** `refactor(shadowing): drawer is Mining and Notes with a kanji Inspector` (includes R2).

### Task R4: Keyboard path — token list on Live Sentence

**Files:**
- Modify: `components/shadowing-workspace/live-sentence.tsx`, `components/shadowing-workspace/selection-popover.tsx`, `messages/{en,vi}/shadowing.json`, `messages/en/shadowing.pin.test.ts`
- Test: `components/shadowing-workspace/selection-popover.test.tsx`

**Interfaces:**
- Consumes: R1's lexical `fetchLineAnalysis`; R3's popover (no phrase card).
- Produces: `Opened.at` gains `{ list: true }`; Live Sentence's text container `tabIndex={0}`, `aria-label` = `workspace.liveSentence.lookUp`.

- [ ] **Step 1: Failing tests:** focus Live Sentence's text (role / label "Look up words in this sentence"), press Enter → the popover opens listing the line's content tokens as buttons (one per token with `entries.length > 0`); choosing one shows its word card with **Back** to the list; Escape closes and focus returns to the text; the analysis request carries `scope=lexical` and is sent only on Enter (none on focus, none on sentence change); after opening the list the sentence advances 2 lines → the list still shows the first line's tokens (Review Focus 4).
- [ ] **Step 2: Run** `npx vitest run components/shadowing-workspace/selection-popover.test.tsx components/shadowing-workspace/live-sentence.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.** Live Sentence's text div: `tabIndex={0}`, `aria-label={t("workspace.liveSentence.lookUp")}`, `onKeyDown` Enter → `window.dispatchEvent(new CustomEvent("workspace:lookup", { detail: { lineId, anchor: element } }))`. `SelectionPopoverHost` listens for `workspace:lookup` and opens `{ lineId, at: { list: true }, anchor: element.getBoundingClientRect(), returnFocus: element }`. In `SelectionPopover`, `at.list` renders `<ul aria-label={t("workspace.selection.words")}>` of token buttons; a picked token is local state that renders `WordCard` with a **Back** button resetting it. Strings: `workspace.liveSentence.lookUp` = "Look up words in this sentence" / "Tra từ trong câu này", `workspace.selection.words` = "Words in this sentence" / "Các từ trong câu", `workspace.selection.back` = "Back" / "Quay lại".
- [ ] **Step 4: Run** — Expected: PASS. Mutation: key the list's tokens on the *current* line instead of `opened.lineId` → Review Focus 4 test FAILS; restore.
- [ ] **Step 5: Commit** `feat(shadowing): keyboard word lookup on Live Sentence`.

### Task R5: Acceptance — e2e, absence, Knowledge core, Chrome

**Files:**
- Modify: `tests/e2e/shadowing-intelligence.spec.ts`
- Delete: `tests/e2e/knowledge.live-ai.spec.ts` (live AI moves to the Korume project; spec §6)
- Keep: `tests/e2e/fixtures/knowledge-data.ts`

- [ ] **Step 1: Rewrite the spec's UI tests** (keep 4, 8, 9, 11; keep the helpers):
  - 1 · select → word card → kanji → Inspector (title 今, two tabs, Back, Close) → a common word → its card → Back → Close: tab and separator level restored, `fakeYt.mounts === 1`, the fake player still PLAYING if it was;
  - 2 · transport boundary at the API: as a Free learner `page.request.post` `native_nuance` → 200, `access: "preview"`, body without the sentinel; as Plus (makePlus) → body contains the sentinel; a seeded preview `culture_notes` reads as preview;
  - 5 · API-level 503: an uncached section (`quiz`) with AI disabled → 503 `ai_unavailable`, while `lite` still returns its seeded content;
  - 6 · absence: the drawer's tablist has exactly "Mining" and "Notes"; Live Sentence has no ✨ / "AI" control; a hovered row's actions include "Cards from this sentence" and "Note" and nothing named Vocabulary, Grammar or AI explanation; a multi-token selection popover has no "Analyze";
  - 7 · dormant: open the lesson, open Notes, play 10 sentences → zero requests to `/api/knowledge/` or `/vocabulary`; every `/analysis` request URL contains `scope=lexical`; then `data.admin` finds no `ai_reservations` / `ai_generations` row for this learner;
  - 10 · Escape: popover → Inspector → drawer; Focus hides and restores the drawer (unchanged otherwise).
  - Delete the old 202 / 402 UI test (no UI consumer).
- [ ] **Step 2: Build and serve** (`npm run build`, then `AI_PROVIDER=none npx next start -p 3000`, both in the worktree); run `npx playwright test tests/e2e/shadowing-intelligence.spec.ts tests/e2e/shadowing-workspace.spec.ts --workers=2` — Expected: all pass. Stop the server afterwards (find the node child by command line on Windows).
- [ ] **Step 3: Knowledge core gates:** every `npm run verify:db:*` script and `npx vitest run lib/knowledge app/api/knowledge lib/data` — Expected: green.
- [ ] **Step 4: Chrome pass** at 1280×529, vi and en: drawer collapsed / peek / Inspector, popover (word, phrase, token list), the shorter row toolbar; screenshots into the scratchpad; note the video width at peek.
- [ ] **Step 5: Full gates after the last edit** (Global Constraints), then commit `test(shadowing): reframe acceptance — kept flows and absent surfaces`.

### Then

Continue with the original plan's **Task 16a** (docs — describe the reframe, not the removed tabs) and **Task 16b** (whole-branch review against both specs; the ledger's `Ruling:` lines, including every T14 ruling about the removed AI tab marked "superseded by the reframe").
