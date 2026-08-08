# L9a run state — Plan 1 ✅ merged · Plan 2 ✅ merged · style-guide pass ✅ DONE · Plan 3 ✅ MERGED to master `--no-ff` `d7b158c` (2026-07-24; branch `layer-9a-string-extraction` deleted). ALL OF L9a DONE. NEXT = L9b.

## 🔒 FROZEN EXECUTION CHECKLIST — Tasks 16–19 (canonical; briefs REFERENCE this, do NOT re-paste it)
Controller directive (user, 2026-07-23; reaffirmed after Task 16 — the frozen-brief approach worked, keep
using it): stop re-transmitting the full rulebook each task. The workflow is frozen — this block is the single
source; assume it is already established and DO NOT re-explain it. **A task brief (17–19) contains ONLY five
things: (1) today's scope, (2) today's architectural decisions, (3) today's known hazards, (4) today's
carry-forwards, (5) today's acceptance criteria.** Do NOT pad the brief with historical lessons unless today's
module genuinely depends on them. Everything else stays in this memory or the task ledger.
**Separate three classes of finding, always:** permanent architecture → this memory; module-local discovery →
task log / Task 19 audit; implementation detail → commit message only. Do NOT promote a local discovery into a
new STANDING CONVENTION unless it has already appeared in multiple independent modules. Permanent practice
REPLACES prior wording here — it does not accumulate beside it.

**Permanent invariants (every extraction task):**
- Namespace registration = 5 steps: (1) `NAMESPACES` in `lib/i18n/namespaces.ts`; (2) `messages/en/<ns>.json`
  EN verbatim; (3) `messages/vi/<ns>.json` real VN — identical key tree + identical ICU placeholders per key;
  (4) `messages/en/<ns>.pin.test.ts` literal `toBe` pins from the PRE-extraction source (never from the
  catalog); (5) `types/messages.d.ts` `AppConfig.Messages`. `request.ts` auto-merges — no loader edit. EN + VN
  + pin ship in the SAME commit.
- vi plural = CLDR cardinal `other` only (no `one`); en keeps `one`/`other`.
- Translator idiom: `useTranslations(ns)` for ALL synchronous components (client OR non-async server).
  `await getTranslations(ns)` ONLY for a genuinely-async server component. Wire a translator ONLY where literal
  chrome strings exist (a pass-through file with none gets none).
- Content vs chrome (D8): DB/prop/AI-authored content (passages, translations, Japanese words, furigana, chat
  text, AI corrections, user transcripts, filenames) stays RAW; only JSX literal chrome is extracted. Japanese
  inside a chrome string stays in both locales (EN verbatim; VN translates the English part, keeps the Japanese).
- Module-level English string producers (`friendlyXError`, `body.error ?? fallback`, status/enum maps) →
  key-returning classifiers resolved with `t()` in the render body.

**The six standing conventions (review rubric — terse):**
1. Mutation testing reported in TWO layers → `docs/lessons.md` L-007.
2. Audit the DEPENDENCY GRAPH, not the plan list → `docs/lessons.md` L-023.
3. Swap-proof render assertions for type-interchangeable values → `docs/lessons.md` L-008.
4. Server diagnostics never reach the learner DOM. **Recurs across modules via the `friendlyErrorFrom` /
   `body.error ?? fallback` idiom — in EVERY module you touch, grep for `body.error` / `.message` / `?? fallback`
   reaching a `role="alert"` / `setError` / DOM node → `console.error(...)` for devs + render a TRANSLATED state.**
5. Record every `common.*` reuse/promotion's consumer count BY SURFACE (for the Task 19 audit).
6. Proportionality — the general rule is `docs/lessons.md` L-014. Run-scoped: low-value wiring gaps on
   inert pass-through surfaces → carried Minor for Task 19; fix-in-task only on correctness/compliance paths.

**Gates (controller re-runs ALL three ITSELF, never trusts the report):** `tsc --noEmit` clean; `vitest run`
green; `npm run lint` **EXIT 0 with 0 new** — check the exit code + error count, not just the 80-warning/23-file
baseline (an ERROR like `no-empty-function` does not move the 80 but breaks the gate — the Task 15 catch).

**common.* consumer counts (running, for Task 19):** `errors.network`=15 (+forum-board, +forum-composer,
+forum-thread, +peer-review-mine, +peer-review-queue, +playlist-composer, +playlist-detail, +playlist-list,
+public-playlist-list, +save-to-playlist-button, +leaderboard-opt-in-toggle — Task 16, 11 new surfaces) ·
`states.error`=2 · `srs.*`=2 · `states.loading`=5 (+forum-board, +peer-review-queue, +public-playlist-list —
Task 16) · `recommendations.*`=2 · `player.*`=1 (demotion candidate) · `actions.cancel`=4 (+forum-board,
+forum-thread, +playlist-list, +playlists-page — Task 16, new promotion) · `actions.save`=2 (+forum-thread,
+playlist-list — Task 16, new promotion) · `actions.delete`=1 (+playlist-list — Task 16, new promotion) ·
`actions.loadMore`=3 (forum-board, peer-review-queue, public-playlist-list — Task 16, new promotion) ·
`actions.confirmYes`=1 surface but 3 feature namespaces (community, playlists, shadowing — confirm-button.tsx
is the sole consumer, promoted straight to common since no single namespace owns it — Task 16, new promotion).
**Task 17 adds:** `appName` +admin-shell · `actions.cancel` +content-manager +video-queue (→6) · `actions.delete`
+content-manager (→2) · `actions.save` +content-form (→3) · `actions.loadMore` +video-queue (→4) ·
`states.loading` +content-manager (→6) · `a11y.levelFilter` +primitive-sections (reuses "JLPT level" copy) ·
`companion.*`=0 UI consumers at ship (L9b read-time — NOT dead).


## ⭐⭐ STANDING CONVENTIONS — BINDING for Tasks 13–19 (user-codified after Tasks 11–12, 2026-07-22)
Put ALL SIX in every implementer brief AND every reviewer brief. They are not new — Tasks 11–12
rediscovered each the hard way; this block exists so no later task rediscovers them again. Task 12
reinforced #2 (dependency-graph audit) and closed the #4 defect class; #6 (proportionality) is new.

1. Report mutation testing in TWO LAYERS, never one number → `docs/lessons.md` L-007.
2. Audit scope from the DEPENDENCY GRAPH, not the plan → `docs/lessons.md` L-023.
3. Swap-proof render assertions for TYPE-INTERCHANGEABLE values → `docs/lessons.md` L-008.

4. **Server-authored diagnostics NEVER reach the learner-facing DOM — DEFECT CLASS CLOSED after Task 12.**
   The rule stands: `body.error` / `error.message` / raw status text must be LOGGED for developers
   (`console.error(...)`) and the DOM must show a TRANSLATED user-facing state instead. Pass-through is
   acceptable ONLY for genuine user-authored content (transcripts, filenames), never backend diagnostics.
   Five instances belonged to this family and are all fixed: Task 7 (`review-session`), Task 8 (vocab
   examples), 11c (`video-summary-panel`), 11e (recorder), 12 (`mining-review-session`). **Consider the
   class CLOSED — Tasks 13–19 should NOT hunt for it, but MUST still apply the rule to any new instance the
   dependency-graph audit surfaces.**

5. **Task 19 exit criterion for `common.player.*` (make the temporary decision explicit).** It was placed
   proactively, not via a real multi-consumer promotion. At Task 19, re-audit its consumers BY SURFACE:
   if only the `shadowing` surface consumes it → DEMOTE back under `shadowing.*`; if another surface
   genuinely consumes it → keep in `common`. This is a gate criterion, not a matter of convention.
   (Same audit, evidence-based, for every string promoted to `common.*` — RECORD its current consumer count
   at promotion time so Task 19 audits from records, not memory. Counts so far: `common.player.*` = 1
   surface (demotion candidate); `common.srs.*` = 2; `common.states.error` = 2; `common.errors.network` = 3;
   `common.recommendations.*` = 2.)

6. **Proportionality/triage — the general rule is `docs/lessons.md` L-014.** Run-scoped application:
   Task 12's two trivial `mining` `<h1>`/link key swaps are carried to the Task 19 audit, not fixed
   in-task.

## ✅ Manual style-guide pass DONE 2026-07-19/20 (the debt Plan 2 left) — 2 commits on master

Ran at `/vi|/en/admin/style-guide`, both themes, measuring on the LIVE DOM rather than by eye.
Admin access: registered `admin@almostgone.vn` / `styleguide-local-dev-2026` locally (the
ADMIN_EMAILS bootstrap promoted it on first /admin visit — designed path, no SQL escalation).
NOTE: this signed the user's own `shamt2004@gmail.com` dev session out; harmless, just log back in.

**1. Contrast — reviewer's suspicion CONFIRMED, and it was NOT badge-only. FIXED (`b4b4fcb`).**
The `bg-X/10 text-X` tint pattern lives in **13 places** (app-nav active state, admin-shell,
auth-form error, jlpt navigator, dictation view, recommendation rail, badges-grid, video-queue,
badge). Measured failures at the 4.5:1 bar (badge text is 12px/weight-500 → NO large-text
exemption): primary tint light/card 4.14, light/bg 4.00, dark/card 4.34 · success tint light/card
4.10, light/bg 3.95 · danger tint dark/card 4.09 · plus plain `text-success` on light `--background`
4.48. A 10% fill barely moves the surface AND costs ~0.7 contrast vs the bare surface.
**Fix (user chose it over darkening the brand):** one token cannot be both a good fill and good
text, so `--primary` stays the brand vermilion driving fills/buttons/ring **unchanged** (solid
pairings already passed 4.64–9.47), and a NEW `--{primary,accent,success,danger}-strong` tier
carries the legible-as-text tone — darker in light, LIGHTER in dark. New primitives:
vermilion-300/700, green-700, red-300/700. 93 class sites migrated `text-X` → `text-X-strong`.
Live-DOM verification: light 5.50–16.37, dark 5.79–16.70, all pass.
**Deliberately EXCLUDED from the migration (do not "finish" this later):**
`components/video-player/pitch-contour.tsx` and `waveform.tsx` set `text-primary` on a wrapper
that the canvas reads via `getComputedStyle(canvas).color` — that class is the WAVEFORM/contour
colour, not text. Non-text contrast needs only 3:1 and `--primary` clears it; recolouring them
would be a visual change with no a11y basis.
**Enforcement:** `lib/design-tokens.contrast.test.ts` parses globals.css, resolves the semantic
aliases per theme, alpha-blends the tint, and asserts 4.5:1 (spec §2.9). Also a new
`lib/utils.test.ts` case: `text-success-strong` must NOT be misclassified by twMerge as a
font-size and strip `text-caption` out of Badge — the cn() hazard from the other direction.

**2. Elevation — FAILS in dark theme. NOT fixed (design decision, → L9c).**
Light: three levels correctly ordered but subtle; `raised` vs `overlay` barely separable at a
glance. Dark: measured on the live DOM, each shadow vs the page background = **1.05:1** and
between adjacent levels = **1.005:1** — i.e. the shadows convey essentially NOTHING on ink-950.
All apparent depth comes from `--card` (L=12%) vs `--background` (L=8%), which is identical for
all three levels. Proper fix = a dark-theme elevation SURFACE ramp (conventional for dark UIs),
which is a design decision beyond a verification pass.

**3. Type scale — new primitives correct, old ones un-migrated (cosmetic).**
badge/dialog/select/tabs/toast/tooltip all use the token scale. button/input/label still use raw
`text-sm`, card uses `text-lg`. Values coincide (`text-sm`=0.875rem=`--text-body`,
`text-base`=1rem=`--text-body-lg`) so there is NO visual inconsistency — except `card`'s
`text-lg` (1.125rem) which is genuinely OFF-SCALE (no token equals it). → L9b/L9c.

**4. Interaction — ALL PASS.** Dialog: `aria-modal="true"`, labelledby set, focus moves inside on
open, 6× Tab never escapes, Escape closes AND returns focus to the trigger → **L7 WCAG 2.4.3 debt
confirmed genuinely repaid**. Toast renders title+description+dismiss. Theme toggle, vi↔en locale
switch, and the reduce-motion kill switch (animation → `1e-06s` while `--duration-base` stays
300ms) all work.

**5. Style guide was under-reporting the palette. FIXED (`300ee94`).** token-sections.tsx claimed
"a token added to globals.css without being listed here shows up in review" — nothing enforced it
and it HAD already drifted: `--card-foreground`, `--input`, `--ring`, `--primary-foreground`,
`--accent-foreground` were missing before this session. Now a test parses globals.css and asserts
the rendered guide names every colour token (found those five by failing first).

**Gates after both commits:** tsc 0 · **1305/1305 (175 files)** · lint exit 0 / 80 pre-existing
warnings, 0 new · build ✓. One intermittent single-test failure appeared in one full run and two
subsequent full runs were green; it was not captured by name, consistent with the documented
CPU-contention flakes (`pitch-contour.test.tsx`, `waveform.test.tsx`).

## ▶ Plan 3 EXECUTION IN PROGRESS — Tasks 1-10 + 6b + 11a/11b/11c ✅ done, reviewed, COMMITTED (2026-07-22)

## ✅ Task 11e DONE `1795471` + fix `faca02f` — one fix wave, 1 Minor (wiring survivor). Tip `faca02f`.
Gate (controller re-ran all three): **tsc 0 · 1530 tests / 192 files · lint 80 pre-existing / 23 files, 0 new.**
All of Task 11 (11a–11e) is now complete. The `shadowing-recorder-panel` (445 LOC) went into the existing
`shadowing` namespace: 41 new leaves under `recorder.*`, all literal-pinned in `shadowing.pin.test.ts`
(catalog mutations 0 survivors). Handled all 3 recorded carry-forwards — line-331 waveform label →
`recorder.a11y.waveformLabel` (binding-pattern-5 wiring test; threaded value ≠ Waveform's own
`common.player.a11y.waveform` fallback, so a dropped prop is caught); 4 network-error sites → EXISTING
`common.errors.network` (now **3 consumers**: `vocab-examples-panel`, `dictation-view`, this panel — record
for Task 19); all 4 module-level string producers (`friendlyScoreError`/`friendlyUploadError`/
`friendlyShareError` + the `SCORE_NOT_CONFIGURED_MESSAGE` const) → key-returning classifiers, and
`describeStatus` was INLINED into the render body with `recorder.error`/`upload.message` left unwrapped
(they arrive already-resolved). **New pattern instance worth keeping:** the Azure `errorType` closed union
(None/Omission/Insertion/Mispronunciation) → exhaustive `Record<…["errorType"], string> as const satisfies`
map, so the enum is TRANSLATED for VN learners instead of leaking English to the DOM (the Task 8 `body.error`
lesson applied to an API enum). 発音/リズム stay byte-identical in both locales. Review (opus) found ONE
wiring survivor — 発音/リズム labels asserted for presence but never PAIRED with their score, so swapping the
two `t()` keys would mislabel pronunciation↔rhythm undetected — closed by `faca02f` (paired `getByText("発音 82")`
assertions; the swap was empirically verified RED then reverted). **This is the two-mutation-class convention
doing exactly its job at 11e: catalog 0 / wiring 1, and the blended number would have hidden it.**

## ✅ Task 12 DONE `5dde8c8` + fix `4f9b473` — `mining` namespace. Tip `4f9b473`.
Gate (controller re-ran all three): **tsc 0 · 1546 tests / 193 files · lint 80 pre-existing / 23 files, 0 new.**
18 new `mining.*` leaves across 4 components (`mine-line-control`, `mining-deck-list`, `mining-clip-player`,
`mining-review-session`) + 2 pages; all pinned in `mining.pin.test.ts` → catalog 0 survivors. **Plan file list
was WRONG a 5TH TIME** — it omitted `mining-review-session.tsx` (the SRS review UI holding the defect);
controller audited via glob + import-graph and PATCHED the plan doc. That file mirrors
`components/learning/review-session.tsx` (Task 7): reuses `common.srs.*` (again/hard/good/easy/complete/done/
progress/showAnswer/spaceHint) + `common.states.error`; only its empty-state, "Back to deck", and
"sentence(s)" `reviewedCount` are new `mining.*` keys. **Owned defect (the LAST `Error.message`→DOM instance)
CLOSED** by mirroring Task 7's fix. Import-graph CLEAN — `MineLineControl` is consumed only by `transcript-pane`
(already on `@/test/render`); the `save-to-playlist-button`/`reading-body` grep hits were comment path-mentions,
not imports (convention #2 paid off — no cross-module surprise this time). Review (opus): Approved, 0
Critical/Important. **1 fix wave** closed Minor #1 — the owned error-path had NO RTL assertion, so a wiring
mutation there would survive; `4f9b473` added fetch-reject + non-ok-500 tests proving the TRANSLATED
`common.states.error` surfaces and the raw exception does NOT (verified RED-on-revert). **Carried Minor → Task
19:** the 2 trivial mining pages have no render test, so page-level `deck.title`↔`deck.review`/`review.title`
key swaps are wiring survivors (low value, pass-through pages). **Task 19 consumer counts:** `common.srs.*` and
`common.states.error` each now = **2 consuming surfaces**.

## ✅ Task 13 DONE `763c884` — `jlpt` namespace. Tip `763c884`. ZERO fix waves (a run first).
Gate (controller re-ran all three): **tsc 0 · 1581 tests / 194 files · lint 80 pre-existing / 23 files, 0 new.**
81 new `jlpt.*` leaves across 10 components + 2 pages; 107-line en+vi catalogs; all pinned in
`jlpt.pin.test.ts` → catalog 81/0 survivors, wiring 11/0 (RTL-only). **Import-graph audit was the run's FIRST
fully-clean one** — all `components/jlpt/*` consumed only by the two jlpt pages, no cross-module surprise.
**Convention-#2 HOTSPOT handled:** `lib/jlpt-ui.ts`'s `SECTION_LABELS`/`PILLAR_LABELS` (English maps = the
section/pillar NAMES, consumed by attempt-list + pre-start-panel + results-panel) were DELETED and all 5 call
sites rewired to `t(\`sections.${x}\`)`/`t(\`pillars.${x}\`)` (enum values become key suffixes). Safe delete:
`lib/jlpt-ui.test.ts` only covers parse/sum helpers, no cross-module import. `jlpt-test/page.tsx` = pure
redirect, no strings, untouched. metadata `{title:"JLPT"}` left for Task 18. Timer aria-live → `a11y`;
pass/fail + pillar copy extracted; N5–N1 + "JLPT" left untranslated. **The implementer found & closed its own
2 wiring survivors in-task** (pre-start mode-description + sr-only Correct./Incorrect. had no render assertion)
→ why review came back 0-fix. Review (opus): Spec PASS · Quality PASS, 0 Critical/Important; verified EN
byte-verbatim leaf-by-leaf, VN key-tree/ICU parity, and that the swap-proof assertions genuinely fail RED on a
key swap. **Task 19 carries:** (a) `passUnavailableReason` — rendered in `jlpt-results-panel`, authored in
`lib/jlpt/score.ts` (controlled backend copy, 3 unit-tested variants; NOT a diagnostic leak — convention #4
stays closed — but English-untranslated in vi, a backend-engineer i18n gap outside this task); (b)
`common.errors.network` now = **4 consuming surfaces** (+jlpt-test-runner); (c) `common.actions.next` reused.

## ✅ Task 14 DONE `ac29966` — `reading` namespace. Tip `ac29966`. ZERO fix waves (2nd in a row).
Gate (controller re-ran all three): **tsc 0 · 1594 tests / 195 files · lint 80 pre-existing / 23 files, 0 new.**
39 new `reading.*` leaves across 7 components + 1 page; 58-line en+vi catalogs; pinned in `reading.pin.test.ts`
→ catalog 4/4 killed, wiring 5/5 killed (1 survivor on reading-list emptyAll/emptyAtLevel swap, fixed in-task
by the implementer). **Import graph CLEAN** — 7 components consumed only by the 2 reading pages; the
community/layout grep hits were JSDoc comment mentions of `word-lookup-popover`, not imports. `lib/reading-
format.ts` (`splitIntoSentences`) + `reading-types.ts` = no chrome, left untouched (NO label-map to delete,
unlike jlpt-ui).
**THE D8 content/chrome boundary was the highest-risk part and was drawn EXACTLY right** (reviewer verified
leaf-by-leaf: no passage/translation/Japanese-word/furigana leaked into the catalog, no chrome left hardcoded).
`translation-disclosure` extracts only "Show translation" (NOT the `{translation}` passage text);
`word-lookup-popover` extracts "Look up: {word}" (`{word}` raw ICU arg carrying Japanese content), "Close",
"Add to flashcard", the disabled-explanation — NOT `{word}`/`{reading}`. Passage titles, JLPT levels, quiz
stems/choices, explanations = CONTENT, left raw.
**NEW Convention-4 instance found & fixed:** `reading-quiz.tsx` `friendlyErrorFrom` was returning the
submit-API's raw `body.error` ("Invalid submission"/"Unauthorized"/"Not found") into a `role="alert"` node →
now `console.error`s it and returns the TRANSLATED fallback (vocab-examples-panel precedent). Both branches
converge on `return fallback`. `common.errors.network` now = **5 consuming surfaces** (+reading-quiz).
**🆕 THIRD standing lesson — REFINES the getTranslations rule (binding, Tasks 15–19):** wire a translator
ONLY where chrome strings actually EXIST. The audit wrongly assumed both reading pages "fetch data → async →
getTranslations"; in fact NEITHER page fetches (client children own the fetch). `reading/page.tsx` got
`await getTranslations` (2 real chrome strings + genuinely async). `reading/[id]/page.tsx` was CORRECTLY left
UNWIRED — a 12-line pass-through rendering `<ReadingDetail passageId={params.id}/>` with ZERO chrome of its
own; a `t` there = dead code + a new lint warning. Do NOT reflexively wire every page; a pass-through page
with no literal chrome gets no translator. The implementer flagged the audit contradiction instead of guessing.
Review (opus): Spec PASS · Quality PASS, 0 Critical/Important, no carried Minors.

## ✅ Task 15 DONE `49553cc` + lint-fix `07cb3fa` — `conversation` namespace. Tip `07cb3fa`. ONE fix wave (a GATE catch, NOT a review finding).
Gate (controller re-ran all three): **tsc 0 · 1619 tests / 196 files · lint exit 0 / 80 pre-existing / 23
files, 0 new.** 6 components + 1 page; 89-line en+vi catalogs; catalog pin 19/19. The AI voice-conversation
module — most error-path-heavy task so far.
**⚠️ GATE CATCH — proof the controller must ALWAYS re-run gates itself, never trust the subagent:** feature
commit `49553cc` shipped a lint ERROR (`message-bubble.test.tsx:88` `let resolveFetch = () => {}` tripped
`no-empty-function`; `npm run lint` exited 1), yet the implementer reported "0 new / unchanged baseline." Sent
back via SendMessage → fixed in `07cb3fa` (comment body). The REVIEW itself was 0 Critical/Important — this fix
wave was a pre-review gate failure, distinct from a review finding. (This is a `no-empty-function`, i.e. an
ERROR not a WARNING — the 80-warning count masked it; ALWAYS check exit code + error count, not just the 80.)
**Load-bearing SCENARIOS 3-consumer rewire (convention #2) — done right.** `SCENARIOS` reduced to
`readonly ScenarioId[]` (labels/descriptions moved to catalog keyed by id); ALL 3 consumers — `scenario-picker`,
`conversation-app` (chat header), `session-history-list` (history rows) — resolve via a shared
`scenarioLabel(t, scenarioType)` helper (t PASSED IN — no hook at module scope), preserving the exact fallback
chain: known id → translated label; unknown → raw `scenarioType`; missing → `scenarios.fallback` ("Conversation").
Reviewer grepped: no `SCENARIOS[i].label`/`.find(...).label` survives. Scenario labels contain Japanese in
parens (`Restaurant (レストラン)`) — EN verbatim keeps it, VN translates English portion + keeps Japanese.
**Implementer found a THIRD convention-#4 leak the audit didn't name:** `conversation-app.tsx`
`friendlyErrorFrom` had the identical `return body.error ?? fallback`→`role="alert"` bug as pre-Task-14
reading-quiz → fixed (console.error + translated fallback). Its 3 catch blocks carried the byte-identical
network string → reused `common.errors.network`, now = **7 consuming surfaces**. Also reused
`common.states.loading` ("Loading…" U+2026) for the play-state; the bubble-specific "…couldn't play that
message." correctly kept OUT of common. **The convention-#4 defect class keeps re-appearing across modules
(reading-quiz, conversation-app) via the same `friendlyErrorFrom`/`body.error ?? fallback` idiom — Task 16+
implementers should GREP for `?? fallback` / `body.error` / `\.message` reaching a `role="alert"`/`setError` in
EVERY module they touch, even though the class was nominally "closed" at Task 12.**
**THREE distinct honest 503 degrade paths** (all must stay honest in both locales — launch state): STT
`voiceRecorder.notConfigured`, TTS `messageBubble.notConfigured`, Claude `app.notConfigured`. Content/chrome
clean — chat `message.content` + AI corrections stay raw (D8). Review (opus): Spec PASS · Quality PASS, 0
Critical/Important.
**Carried Minors (both non-blocking):** (1) `conversation-app.tsx:200` a 503 short-circuits before
`friendlyErrorFrom`, so the 503 body's `error` isn't `console.error`'d — defensible (honest degrade, nothing
leaks), accepted. (2) reviewer couldn't verify from-diff whether `POST /api/conversation/session` returns 503 —
**controller verified: NO 503 in that route**, so startSession's `friendlyErrorFrom`-only handling is correct;
CLOSED, non-issue.

## ✅ Task 16 DONE `884ec34` — `community`+`playlists`+`leaderboard`+`profile` (4 ns, one task). Opus review: 0 findings.
Gate: tsc 0 · 1682 tests / 200 files · lint exit 0 / 80-23 baseline / 0 new. Dependency-graph audit caught 2
consumers off the plan list (`save-to-playlist-button` used by `videos`; `confirm-button` used by `shadowing`).
Swap-proof: forum `topic` map (`FORUM_TOPICS`/`topicLabel`), leaderboard G2 order ("Your week" first). New
`common` leaves: `actions.loadMore` (3 surfaces/2 ns), `actions.confirmYes` (`confirm-button`, spans
community+playlists+shadowing). **Task 19 carry:** `lib/notification-format.ts` still hardcodes EN ("just now",
"Xm ago") — belongs to a future `notifications` namespace, out of Task 16 scope.

## ✅ Task 17 DONE `cd7bc1a` (+ `939b60c` MINOR-2 fix) — `admin`+`companion`. Opus review: READY=YES, 0 Crit / 1 Imp / 3 Min.
Gate (controller re-ran): tsc 0 · **1728 tests / 202 files** (1 fail under CONCURRENT tsc+vitest+lint load = the
documented waveform/pitch-contour CPU-contention flake; **1728/1728 standalone** — never run vitest beside other
CPU-heavy gates) · lint exit 0 / 80-23 / 0 new. Companion titles now render at READ time: `titleFor`→
`memoryTitleFor` returning `{key,values}` descriptors, `lib/data/companion.ts` persists `title: null` for
discovered memories (gifted pins keep the learner's own words), P12 four phase phrasings carry no digit. Admin
primitives stay English-defaulted (callers pass `t()`); half-vi `content-form`/`video-queue` finished.
- **MINOR-2 FIXED `939b60c`:** P12 no-digit guard now also runs over `vi/companion.json` (the locale that ships;
  the original violation was Vietnamese). Co-located in `messages/en/companion.pin.test.ts`.
- **⚠ IMPORTANT-1 → L9b CARRY (architecture, no data lost):** the journal read model can't render
  `companion_grew`/`jlpt_passed` titles at read time — `memoryTitleFor` needs `ref` (phase/level), which survives
  ONLY in the `dedupe_key` column (`companion_grew:2`, `jlpt_passed:N4`); `MEMORY_COLUMNS` + the `CompanionMemory`
  interface omit it. Before L9b builds the Journal: expose the ref (parse `dedupe_key`, or persist
  `relationship_phase`/`jlpt_level`). Owner: backend-engineer (`lib/data/companion.ts`).
- **Task 19 carries:** (a) admin `readErrorMessage()` in `content-manager`/`video-queue` passes `body.error`
  through untranslated — ruled ACCEPTABLE (operator tooling, curated EN constants only, NOT learner DOM; not a #4
  violation), residual = EN-only for a VI operator. (b) `confirm-dialog.tsx` `busy` default "Working…" renders EN
  in admin dialogs. (c) `content-type-cards` label/description pairs have no swap-proof test — ruled low-stakes
  (link target uses `type`, not the label; a swap is cosmetic only).
- **`companion` namespace = 0 UI consumers at ship** (consumed at L9b read time). Do NOT flag as dead in Task 19.

## ✅ Task 18 DONE — page metadata sweep. 3 commits `e1b3d36` (root+auth 1/3) · `f9f7573` ((app) 2/3) · `0ab5587` (admin 3/3). Tip `0ab5587`, tree clean.
All 25 `export const metadata` + root layout now `generateMetadata({params:{locale}})` → `getTranslations({locale,
namespace})` with the locale threaded EXPLICITLY (spec §7 risk 2). Gate (controller re-ran ALL): tsc 0 · **1731/1731
/ 202 files** (standalone) · lint exit 0 / 80-23 / 0 new · `npm run build` EXIT 0 — route table verified per group:
every one of the 25 pages stays `●` (SSG), the only `ƒ` locale routes are the 9 pre-existing `[id]`/`[type]`
dynamic ones (incl. `admin/content/[type]`, `reading/[id]`). Key decisions:
- **(app) reused each page's own existing `title`/heading key — ZERO new keys.** This normalized a few EN tab
  strings to match the heading: "Vocab"→"Vocabulary", "Review vocab"→"Vocabulary review", "Review kanji"→"Kanji
  review", "Review mined sentences"→"Mining review", "JLPT"→"JLPT mock tests", "Reading"→"Reading passages",
  "Conversation"→"Conversation practice". peer-review reused `community.tabs.peerReview` (its `<h1>` is "Community").
- **auth tabs reused `common.auth.signIn`/`.signUp`** — no `auth.meta` keys, no auth pin file needed.
- **New keys only where the tab genuinely differs:** `common.meta.{defaultTitle,description}` (root layout; kept the
  literal `"%s · Nihongo Cinema"` template) + `admin.meta.{dashboard,videos,content,contentType}` ("Admin — X" /
  VI "Quản trị — X" prefix ≠ heading). EN+VI+`toBe` pins shipped in-commit (common.pin.test + admin.pin.test).
  style-guide reused `admin.styleGuide.heading` (tab == heading).
- **HAZARD RESOLVED — P1 import boundary:** `Locale` must come from `@/lib/i18n` (barrel), NOT `next-intl` — feature
  pages are not whitelisted (only root `layout.tsx` is). First attempt imported from `next-intl` and the build's
  ESLint gate (no-restricted-imports) failed; fixed to the barrel. `params.locale` must be typed `Locale`, not
  `string`, or `getTranslations` overload-2 rejects it (tsc TS2769) — the plan's example under-specified this.
- `admin/content/[type]` generateMetadata EXTENDED (not replaced): threads locale + localizes the label via
  `contentTypeLabel(t, …)` — the awaited `getTranslations` translator IS assignable to the helper's
  `ReturnType<useTranslations<"admin">>` param (tsc clean), dropped the English-only `CONTENT_TYPE_LABELS` fallback.

## ✅ Task 19 DONE — final gate, Plan 3 CLOSED. Commit `0cea7bf` (code) + memory commit. Tip after memory commit.
Gate (controller re-ran ALL): tsc 0 · vitest **1731/1731 / 202 files** (standalone) · lint exit 0 / 80-23 / 0 new ·
`npm run build` EXIT 0 (25 pages SSG per-locale) · playwright **5/5** (was 4/5 until local Supabase was set up:
`npx supabase db reset` re-applied all 15 migrations incl. grants + N5/N4 content (vocab 60/kanji 45/grammar 10),
which the register→review round-trip needs; NOT a code regression — the local DB had simply not been migrated).
**Direct verification of the Task 18 deliverable:** started prod `next start`, curled `<title>` — `/vi/login`
="Đăng nhập · Nihongo Cinema", `/vi/register`="Tạo tài khoản · Nihongo Cinema", `/vi`="Nihongo Cinema — Học tiếng
Nhật qua video", EN equivalents correct → generateMetadata + VI catalog render end-to-end, template applied.
- **STRING SWEEP (plan Step 1):** 0 hardcoded JSX text nodes app-wide. 3 attribute hits: (a) admin-shell nav
  `aria-label="Admin"` = the ONE genuine miss → FIXED (`admin.shell.navAria`, EN "Admin"/VI "Quản trị", pinned +
  wired); (b) `video-import-form` YouTube-URL placeholder = justified (technical, D8); (c) `notification-bell`
  aria-labels = the notifications feature, NEVER in Plan 3 scope → deferred to a future `notifications` namespace
  (with `lib/notification-format.ts`). Recorded, not fixed.
- **common.* AUDIT + DEMOTION (convention #5 gate):** `common.player.*` consumers (transcript-pane, waveform,
  playback-controls) ALL serve ONLY shadowing (dictation-view uses none) → DEMOTED to `shadowing.player.*`
  (values byte-identical; 3 components switched ns to "shadowing"; Task 11a/11c pins moved common→shadowing
  pin-test). `common.errors.network` + `common.states.loading` KEPT in common (genuinely multi-surface). No other
  `common.*` leaf needed demotion.
- **Carries that remain open** (recorded acceptable / out of scope, NOT defects): admin `readErrorMessage` EN-only
  (operator tooling), `confirm-dialog` "Working…" EN default, `content-type-cards` label/desc no swap-proof test
  (low-stakes), `lib/notification-format.ts` + `notification-bell` need a future `notifications` namespace.
- **L9b carry (backend-engineer):** companion journal read-model can't render `companion_grew`/`jlpt_passed`
  titles — `memoryTitleFor` needs `ref` from the `dedupe_key` column (see Task 17 IMPORTANT-1 above).

## ▶ NEXT = FINISH Plan 3 (branch `layer-9a-string-extraction`). All 19 tasks committed, tree clean, every gate green.
The remaining action is the MERGE decision (superpowers:finishing-a-development-branch) — user's call. On merge:
update `mem:project_status` (L9a fully complete/merged, new baseline 1731/202) and `mem:feature_backlog_deferred`
item #10 with the merge commit SHA. `feature_backlog` #10 already flipped to DONE-on-branch. After L9a merges, the
next layer is L9b (visual restyle — consumes the semantic-colour tier the design system exposed) then L9c (perf +
animation polish). Full branch commit list for Plan 3 in `git log`.

## (superseded) ▶ NEXT was 11e (`shadowing` panel — the LAST 11x sub-task). Tip `9c9b3bf`, tree clean.

Gate at `9c9b3bf`: **tsc 0 · 1481 tests / 192 files · lint exit 0 / 80 pre-existing warnings across 23
files, 0 new** — all three re-run by the controller itself, never taken from a subagent's report.

Commits: `23a8f84` (11b) · `36534b0` (plan-doc patch) · `da41411` (11c) · `9c9b3bf` (11d).
**NOTE the user made their own commit `3e4b4a3` "[LongTNP]: mascot" mid-run**, which committed the
deleted `.docx` and added `MASCOT.md`. Those are now HANDLED — stop excluding them from commits.

**11e scope:** `components/video-player/shadowing-recorder-panel.tsx` (445) + its test (523) = 968 LOC,
into the **existing `shadowing`** namespace (register nothing). Its test already imports `@/test/render`.
Known carry-forwards for it:
- **`shadowing-recorder-panel.tsx:331` passes `label="Your recording waveform"`** — the last hardcoded
  English leak from the 11a player shell. 11d translated both pitch `label` defaults, but this one is an
  explicit prop and must be rewired to a catalog string.
- It has **4 call sites of `"Network error — check your connection and try again."`** (lines ~171, 186,
  223, 251) → consume the existing **`common.errors.network`** (do not re-extract). This will raise that
  key's consumer count from 2 to 3 — record it for the Task 19 gate.
- `friendlyShareError` / the scoring-error mapper (lines 74–79) are **module-level string producers** —
  4th instance of the pattern; convert to key-returning classifiers like 11d's `classifyMicError`.

### Task 11d DONE `9c9b3bf` — one fix wave, 3 Important findings, all wiring gaps

**The two-class mutation convention paid off on its first use:** catalog class **36 mutations / 0
survivors**, wiring class **29 / 9 survivors**. A blended number would have reported 0 and hidden all
nine. All three findings were strings with a correct pin that **no test rendered**. Keep demanding both.

1. **A hook CAN call `useTranslations` — that is the right fix when the alternative crosses a task
   boundary.** `useRecorder`'s error strings were module-scope. Option "return a descriptor and let the
   consumer resolve it" was **rejected** because its only in-scope consumer is 11e's file. Instead
   `describeMicError` → `classifyMicError` returning a key suffix, resolved inside the hook. **Public
   contract `error: string | null` unchanged, zero 11e edits.** Use this shape whenever a hook owns copy.
2. **A template-literal catalog key IS still compile-checked.** `t(\`recorder.errors.${classifyMicError(err)}\`)`
   — the reviewer typo'd the suffix and deleted catalog leaves; **tsc errored every time**. So the Task 10
   rule (a descriptor key with no catalog entry must be a COMPILE error) survives dynamic indexing. Don't
   avoid the pattern out of caution, but do verify it by mutation each time.
3. **THE PLAN'S FILE LIST WAS WRONG A FOURTH TIME — and this one crossed modules.** `useRecorder` has a
   consumer nobody had listed: **`components/conversation/voice-recorder-button.tsx`**. Translating the
   hook broke **13 tests across 2 conversation test files**. Fix was import-only (`@/test/render`),
   verified necessary by stashing. Rule: `docs/lessons.md` L-023. `useRecorder` consumers = 3 files / 2 modules.
4. **Both pitch components had a `label` prop defaulting to English** — memory had recorded only one.
   Neither caller passes a label, so both aria-labels were English under live `vi`. Both now `label ?? t()`
   with the mandatory pattern-5 test pair, broken in both directions by the reviewer.
5. **お手本 / あなた / イントネーション stay byte-identical in BOTH locales** (reviewer concurred): they are
   target-language UI labels in a Japanese-learning app, same class as leaving "shadowing" untranslated —
   not English awaiting translation. Extracted rather than left hardcoded so `t()` stays the single
   rendering path. `pitch.overlay.scoreSuffix` (" / 100") judged justified, not noise.
6. **`test/render.tsx` gained a wrapped `renderHook` export** — purely additive, `customRender` byte-for-byte
   unchanged (reviewer verified; this file is the run's LINCHPIN, a regression there corrupts every later
   task). `export *` excludes names with an explicit export, so the wrapper wins.
7. **Task 19 gate items added:** both pitch `label` props now have **zero production callers** (only the
   pattern-5 tests exercise them) — CLAUDE.md §6 dead-code question, same class as the `common.player.*`
   demotion. And **a glossary collision is coming**: 11d renders *pitch* as "cao độ" while the plan fixes
   *pitch accent* = "Trọng âm cao thấp". Defensible (the EN copy says "pitch", and "đường cong trọng âm
   cao thấp" is unreadable) but **must be decided explicitly before real "pitch accent" strings land**.
8. Unfixed, carried: `voice-recorder-button.tsx:134` is a **mixed-locale surface** under `vi` (Vietnamese
   recorder error beside its own hardcoded English "Requesting microphone access…"). Inherent to
   incremental extraction — **Task 15 owns `conversation`**, do not mistake it for a regression.
   Also `customRender` still takes a bare `RenderOptions` while the new `customRenderHook` correctly
   `Omit`s `"wrapper"` — align in a later task.

### Task 11c DONE `da41411` — one fix wave, 2 Important findings, both real

Created the `shadowing` namespace + finished `common.player.*`. The review ran **95 mutations, 0
survivors against the full test set** — but its second pass is the lesson:

1. **⚠ NEW REVIEW TECHNIQUE, adopt it for 11d/11e and Tasks 12-19: run the mutation pass TWICE — once
   against the full in-scope test set, once against the RTL component tests ONLY (pin tests excluded).**
   Pass 1 found 0 survivors; **pass 2 found 5**. Those five strings had a correct catalog pin but *no
   test rendered them at all*, so a catalog typo was caught while a **wiring** error was not — swapping
   `t("summary.keyVocab")` and `t("summary.keyGrammar")` would have shipped silently. The pin proves
   COPY, the RTL test proves WIRING, and only running them separately shows which one is missing. This
   is the Task 10 `toHaveTextContent`-containment ruling one level up.
2. **A `satisfies`-checked key map does NOT protect a parallel array of the same closed set.**
   `FURIGANA_MODE_KEY` was correctly `as const satisfies Record<FuriganaDisplayMode, string>`, but
   `const FURIGANA_MODES: FuriganaDisplayMode[] = [...]` sitting beside it was a plain annotated array —
   a 4th mode would have compiled and rendered **no button at all**, worse than losing a label. Now
   derived via `Object.keys(FURIGANA_MODE_KEY)`. **Verify exhaustiveness by adding a 4th member and
   watching tsc fail — reading the `satisfies` is not verification.**
3. **`video-summary-panel.tsx`'s `body.error` defect is FIXED** (3rd occurrence of this defect class,
   after Task 7's `review-session.tsx` and Task 8's vocab panel). `friendlyError` → `classifySummaryError`
   returning a descriptor. **`mining-review-session.tsx:61` is the LAST known instance — Task 12 owns it.**
4. `"Loading…"` reads the existing `common.states.loading` rather than duplicating into `shadowing.json`
   (byte-identical, verified at codepoint level → DRIFT ruling says reuse). Two near-identical entries
   `errors.generic` ("Could not…") vs `errors.generateFailed` ("Couldn't…") are **deliberately kept
   separate** — different code paths (non-2xx vs thrown fetch), English is frozen; their vi values are
   identical, which is correct since the contraction distinction doesn't exist in Vietnamese.
5. **Carried, unfixed:** two vi wording nits (`messages/vi/shadowing.json:3` "Video này không thể phát ở
   đây." → "Không thể phát video này ở đây."; `:8`'s trailing `theo` is a literal carry-over of "to
   shadow against") — **batch into the next vi pass**. And `playback-controls.tsx:59` has `aria-label` on
   a **role-less `<div>`** (pre-existing, not a 11c defect): `aria-label` is IGNORED on a generic element
   with no role, so "A–B loop" never reaches AT, which is why its test must use `container.querySelector`
   instead of `getByRole`. Adding `role="group"` fixes both — **separate a11y follow-up, do not widen a
   task diff for it.**
6. `"No transcript yet"` is now byte-identical in BOTH `dictation.json` and `shadowing.json` (duplicated,
   not promoted — 11b shipped it un-promoted first and 11c followed precedent rather than retroactively
   refactoring a committed catalog). Bodies differ per module. **Task 19 should look at this alongside
   the `common.player.*` demotion question.**

### Task 11b DONE `23a8f84` — reviewed clean (0 Critical, 0 Important), 23/23 mutations red

The `dictation` namespace; the controller-ruled promotion of `"Network error — check your connection and
try again."` out of `vocab.json` into **`common.errors.network`** (it appears in **28 places across 8
modules** and was never vocab-specific — the pin MOVED to `common.pin.test.ts`, `vocab-examples-panel.tsx`
rewired; **the other ~26 call sites stay for Tasks 12–16 to consume, do not extract them**);
`summarizeDiff` converted from a module-level string concatenator to a counts object formatted through
ICU (3rd instance of that pattern); `t.rich` for the `<strike>extra</strike>` legend item.
**`DiffCounts` is a `type` alias, NOT an `interface`** — the hand-written `[key: string]: number` an
interface needs silently disabled typo checking, while a type alias gets an implicit one and still
satisfies next-intl's values param. **Do NOT "tidy" it back**; the comment in the file says so.

## ⚠⚠ TWO STANDING REVIEW CONVENTIONS — binding from Task 11d onward (user, 2026-07-22)

Not new process; these codify what Tasks 8, 10, 11a and 11c already proved. **Put both in every
reviewer brief, and require both numbers back in the verdict.**

### A. Mutation testing has TWO CLASSES — general rule now `docs/lessons.md` L-007.

### B. When promoting a string into `common.*`, record the ACTUAL consumer count in the review.

So the Task 19 demotion gate decides from evidence instead of re-deriving usage by hand.

**State the unit explicitly — importing FILES vs consuming SURFACES/modules — because they differ and
P4 ("shared by 2+ modules") is a test on MODULES.** Measured 2026-07-22:

- **`common.player.*` — 3 importing files** (`playback-controls`, `transcript-pane`, `waveform`) but
  **1 consuming surface** (shadowing only). By P4 this is a **demotion candidate**; reporting the bare
  "3" would wrongly justify keeping it. This is the same trap 11a's review already sprang once.
- **`common.errors.network` — 2 consuming components** (`vocab-examples-panel`, `dictation-view`).
  **NOT 8.** The "28 places across 8 modules" figure counts the raw English **string literal** still
  sitting in un-migrated code, which is a migration backlog, not consumers of the key. Tasks 12–16 will
  raise the real count as they migrate. **Never conflate the two figures.**
- `common.recommendations.*` — 2 consuming surfaces (`/dashboard`, `/videos`): a genuine P4 promotion.

## ⚠ THE PLAN DOC'S TASK 11 FILE LIST WAS INCOMPLETE — patched `36534b0`, but keep auditing

Scouting 11c found `shadowing-view.tsx:18` importing `./playback-controls`, a **166-LOC file with real
strings that appeared in neither Task 11's nor Task 12's list**. A full audit of
`components/video-player/` (controller re-verified it independently before editing the plan):

| File | Verdict |
|---|---|
| `playback-controls.tsx` (166 LOC, had NO test file) | was UNASSIGNED → **done in 11c** |
| `pitch-contour.tsx` (230) + test (152) | was UNASSIGNED → **assigned to 11d** |
| `furigana-text.tsx` (55) + test, `pitch-comparison.ts`, `load-youtube-api.ts` | **zero strings — no action, don't re-audit** |

**This was the THIRD time Task 11's plan metadata was wrong** — the LOC count was stale (real scope 6.9×
Task 10), the "both surfaces render it" rationale was false (11a review disproved it), and the file list
was short by two. Rule: `docs/lessons.md` L-023.

**USER DECISION (2026-07-21, honoured in `da41411`):** `playback-controls.tsx`'s strings went to
**`common.player.*`**, joining 11a's, so the whole "player shell, shadowing-only today" cluster lives in
one place and the **Task 19 gate makes ONE demotion decision for all of it**. Keys shipped:
`common.player.a11y.{playbackSpeed,abLoop,furigana}`, `common.player.furigana.{adaptive,all,off}`,
`common.player.loop.{setA,setB,clear}`. Still exactly one consuming surface — the demotion question is
live and recorded in `messages/en/common.pin.test.ts:104-110`.

**⚠ TASK 11 WAS SPLIT into 11a–11e (2026-07-21, plan commit `087b342`).** The plan had written it as
one unit against a stale figure. **Measured: 1977 LOC source across 11 files + 1816 LOC of their
tests = 3793 LOC = 6.9× Task 10** (Task 10 = ~550 LOC → 484K tokens / 118 tool-uses). One implementer
would have hit ~800 tool-uses; the failure mode is not a crash but a task that LOOKS finished with
strings silently unpinned — the exact defect class only reviewers have caught. Split:

| Sub-task | Namespace | Files | LOC |
|---|---|---|---|
| **11a ✅ DONE `9d745bc`** | `common.player.*` | youtube-player, transcript-pane, waveform | 781 |
| **11b ✅ DONE, ⚠ UNCOMMITTED** | `dictation` (+ `common.errors.network`) | dictation-view + page | 550 |
| **11c ← NEXT** | `shadowing` core (+ `common.player.*`) | shadowing-view + page + video-summary-panel + **playback-controls** | 1070 |
| 11d | `shadowing` capture | recorder, pitch-contour-overlay, **pitch-contour** | 972 |
| 11e | `shadowing` panel | shadowing-recorder-panel | 968 |

**Task 11a DONE — SECOND task of the run with ZERO fix waves** (Task 9 was the first). Gate: tsc 0 ·
**1405 tests / 189 files** · lint 80 pre-existing warnings, 0 new. What it settled:

1. **My split rationale was WRONG and the reviewer disproved it — the plan is corrected.** The claim
   was "transcript-pane and waveform are rendered by both surfaces". **False.** `TranscriptPane` ←
   only `shadowing-view.tsx:17`; `Waveform` ← only `shadowing-recorder-panel.tsx:11`. The one
   component BOTH surfaces render is `youtube-player.tsx` — which has **no user-visible strings at
   all** (just `displayName`) and needed zero changes. So **`common.player.*` has ONE consumer and is
   pre-emptive placement, NOT a P4 promotion** like `common.recommendations.*` (Task 10, two real
   consumers). Kept because re-shuffling namespaces mid-split costs a task; **flagged for demotion to
   `shadowing.*` at the Task 19 gate if it still has one consumer.** Don't let a later reader mistake
   it for observed sharing.
2. **Prop-defaults-to-English is the case an EN-only suite structurally cannot check** (binding
   pattern 5, now demonstrated). `waveform.tsx`'s `label = "Recording waveform"` → `label ?? t(...)`,
   prop kept as optional override. TWO tests are required and neither can mask the other: one passes a
   deliberately **non-English** literal, one covers the default. The reviewer broke the threading in
   both directions and confirmed each test catches only its own case.
3. **Promoting a shell string breaks every not-yet-migrated test that renders that shell as a CHILD** —
   `useTranslations` needs the provider, so bare-RTL renders throw "context not found". 11a had to
   import-swap `shadowing-view.test.tsx` and `shadowing-recorder-panel.test.tsx` (11c/11e files) to
   `@/test/render`. **Expect this ripple in 11b–11e and in every later task that promotes to `common`;
   keep the fix import-only.** Reviewer verified it was necessary (reverting each makes it fail),
   minimal (1 line each, zero assertion changes), and complete (no other file renders these two).
4. **Carry-forward for 11e:** `shadowing-recorder-panel.tsx:331` passes `label="Your recording
   waveform"` — still hardcoded English, the ONLY remaining English leak from the shell.
5. **Note for 11b:** there is NO dictation transcript pane — `dictation-view.tsx` imports only
   `youtube-player`. Don't go looking for one.
6. Minor, unfixed: `common` now has two a11y groups (top-level `common.a11y` + `common.player.a11y`);
   nesting under `player` is right but 11b–11e should follow it rather than re-deciding.

**Task 10 (`videos`) DONE `cd000fc` — one fix wave, one Important finding.** Two rulings and one
new pattern came out of it, all binding from here on:

1. **⚠ NEW STANDING CONVENTION — `toHaveTextContent(string)` is a CONTAINMENT match, not equality.**
   The reviewer mutated all six `videos.errors.*` by APPENDING and PREPENDING text: **all 8
   mutations stayed GREEN.** Only mid-string edits went red. This is the Task 8 "a substring regex
   is not a pin" lesson wearing a new costume. **Ruling: the pin is a literal `toBe` against the
   catalog in `messages/en/<ns>.pin.test.ts`; RTL component tests prove WIRING, not copy. Every
   leaf of an EN catalog needs a `toBe`.** Note `toHaveAttribute` and an exact-string `getByText`
   ARE equality — only `toHaveTextContent` and unanchored regexes are the trap. `vocab.pin.test.ts`
   had the identical hole (Task 8's five `errors.*`) and was closed in the same commit; new
   `messages/en/common.pin.test.ts` covers Task 10's `common` additions.
2. **The recommendation rail went to `common`, not `videos`.** It renders on `/dashboard` AND
   `/videos`, and `dashboard.json` already owned `recommendationsHeading`/`recommendationsLoading`
   which `/videos` hardcoded verbatim. Both keys MOVED to `common.recommendations.*` (heading,
   loading, empty, knownWords, band.{ideal,tooEasy,tooHard}) plus `common.noThumbnail`; the
   dashboard pins moved with them. Same P4/DRIFT ruling as Task 7 — later tasks touching
   `/dashboard` should expect these to live in `common`.
3. **FIRST rich-text message in the catalogs.** The rail's empty state has an inline `<Link>`, so
   it uses `t.rich("recommendations.empty", { link: chunks => <Link…> })` over
   `"… — <link>import a video</link> to get started."`. Byte-identity verified by rendering the old
   JSX and the new component side by side (both `{" "}` spaces preserved). **`catalog.test.ts` now
   compares TAG NAMES across locales** — nothing did before, so a vi message could silently drop
   `<link>` and lose the link. That check must compare UNCONDITIONALLY: `routing.defaultLocale` is
   **`"vi"`**, so the usual "reference locale" early-exit made vi its own trivially-matching
   reference and went green with the tag deleted. The implementer hit this bug in its own draft.
4. **Module-level constants that render copy cannot survive extraction** — no `t()` at module scope.
   `BAND_LABEL` → `BAND_LABEL_KEY` mapping band → catalog key, kept `as const satisfies
   Record<RecommendationBand, string>` (verified: a 4th band = 2 tsc errors). `messageForStatus` →
   `descriptorForStatus` returning a descriptor union the component body resolves (verified: a
   descriptor key with no catalog entry is a COMPILE error, not runtime). Expect the same shape in
   Tasks 11-16 wherever a `Record<…, string>` of labels exists.

**PIN AUDIT for the Task 19 gate (produced by Task 10's fix wave, report-only — DO NOT lose):**
`grammar`, `kanji`, `videos`, `nav` fully pinned. `marketing` pinned only via Playwright
(`tests/e2e/home.spec.ts`, exact matches — real pins but OUTSIDE the `npx vitest run` gate); its
`footer.ariaLabel` ("Footer") is asserted nowhere. **`auth` has NO `auth.pin.test.ts`** —
`login.{heading,subtitle,checkEmail}`, `register.{heading,subtitle}` asserted nowhere, and
`errors.invalidCredentials` + `validation.passwordTooLong` have NO test exercising their paths at
all. `dashboard` partial: `srsDue.{title,reviewVocab,reviewKanji,allCaughtUp}`,
`a11y.{badgeEarned,badgeLocked}` and `level.xpToNext` are only touched by unanchored regexes
(= containment). `common`'s pre-existing block was NOT exhaustively audited — spot checks found
`states.error` and `srs.complete` containment-only and `appName`/`actions.save` with no test hit at
all. **Task 19 should do a leaf-by-leaf pass over `common` and write `auth.pin.test.ts`.**

Gate at commit: tsc 0 · **1397 tests / 189 files** · lint exit 0 / 80 pre-existing warnings across
23 files, 0 new. (Controller re-ran all three independently, plus an append-mutation spot check.)

**Task 9 (`grammar`) DONE `8489db4` — FIRST task of the run to need ZERO fix waves.** One page,
three strings (`title`, `subtitleCount`, `empty`); nothing promoted to `common` because Task 7
had already moved LevelTabs' two strings there. Pattern reused verbatim from Task 8's vocab page,
which is a structural twin. **New binding glossary entry: grammar point = "mẫu ngữ pháp"** (user
decision 2026-07-21; Task 13's JLPT weakness links should reuse it). The `· {level}` suffix stays
a raw template literal in kanji/vocab/grammar alike — N5–N1 are data, not copy; do not "finish"
extracting it. The reviewer mutation-tested all three EN values IN ISOLATION (each went red) and
fired the vi plural rules in both directions — that is now the expected review depth, not extra
credit. Gate at commit: tsc 0 · **1367 tests / 186 files** · lint exit 0 / 80 pre-existing
warnings, 0 new.

**REVIEW LESSON worth more than any single fix (Task 8):** the reviewer stopped arguing and ran a
MUTATION TEST — it deleted "(AI)" from the AI-content-labeling button's catalog value and rewrote
the row label, and the suite stayed 12/12 GREEN, because the only guards were substring regexes
(`/ai-generated/i`). **A substring regex is not a pin.** Compliance surfaces need exact literal
assertions, and when several assertions share one `it()` block, mutate each in ISOLATION — the
first failure short-circuits the rest and hides the others' absence. Tasks 6, 6b and 7 each needed exactly one fix wave;
every finding was a real defect, none was polish. Three things later tasks MUST inherit:

1. **`useTranslations` works in NON-ASYNC Server Components** (confirmed by a real build, both
   locales compiled). Only ASYNC server components need `getTranslations` from `@/lib/i18n/server`.
   **Never add "use client" to make something translatable** — Task 5 removed exactly such a
   conversion. This is what keeps presentational components renderable by RTL.
2. **`lib/i18n/catalog.test.ts` now PARSES every message in every locale as an ICU AST** (Task 6b,
   3 rounds). It compares parsed argument names, plural/selectordinal/select shapes, plural
   `offset`, and CLDR branch sets resolved with each plural's own type. Consequences when writing a
   plural: **`vi` carries ONLY `other`** (adding `one` to match EN's branch count is now a FAILURE),
   and **use `{count}`, never ICU `#`** (`#` runs through Intl.NumberFormat, so 1234 renders
   "1,234" — a byte-identity break that shipped undetected in Task 6). The plan doc's key-naming
   section said the opposite on both counts and has been corrected.
3. **Shared components' strings go to `common`, not a module namespace** — but do NOT duplicate keys
   `common` already has. Task 7 promoted `common.srs.*` (Tasks 8/12 consume it),
   `common.filters.all` and `common.a11y.levelFilter` (Tasks 8/9/13). Reason to prefer reuse over
   pre-emptive duplication is DRIFT, not purity.

**Carry-forward defects (in the SDD ledger too):** Task 12 must fix
`components/video-player/mining-review-session.tsx:61`, which still routes raw `Error.message` to
the DOM — the exact defect Task 7 removed from `review-session.tsx`, where it made the translated
error string unreachable. A dedicated sweep task near the end converts all 25 pages'
`export const metadata` to `generateMetadata` (user decision) — module tasks LEAVE metadata in
English. `components/ui/theme-toggle.tsx` a11y copy is still hardcoded English and is owned by no
task.

Method: `superpowers:subagent-driven-development`. Branch **`layer-9a-string-extraction`** off
master @ `e5893e9`. Durable ledger: `.superpowers/sdd/progress.md` (gitignored scratch — if it's
gone, reconstruct from `git log` + this block). Each task = fresh implementer subagent +
independent code-review + fix loop; only merged after review clean.

**Tasks 1-8 + 6b DONE, each reviewed clean, all committed** (branch HEAD = `7790219`):
- Task 1 (`b52a0d2`): test/render.tsx now serves the REAL EN catalogs via import.meta.glob (needs
  `/// <reference types="vite/client" />`). THE LINCHPIN — without it every t() call renders the
  key and breaks the module's own tests.
- Task 2 (`52efa51`): pilot — extracted `nav` + `common`. Cost 3 review rounds; established the
  patterns everything copies. Two Criticals caught & fixed (see below).
- Task 3 (`e4da0f5`): dialog/toast a11y labels — primitives UNCHANGED (keep English-defaulted
  props), CALLERS pass translated text (design-system/i18n independence, spec §4.5). Found a
  second wrapper `components/admin/dialog.tsx` missing the prop.
- Task 4 (`36d6529`): `auth` namespace + OAuth callback unprefixed-redirect fix + login round-trip
  e2e. Pulled zod validation messages (`lib/validation/auth.ts`) into scope — they render to users
  and NO task owned them; now catalog keys resolved in actions.ts.

- Task 5 (`6fa0c7a` + nits `462806e`): `marketing` namespace + the 3 authorized false-"trial" copy
  fixes. **The paused draft was VERIFIED IN PLACE, not discarded** — full gate green as-is.
  Review: APPROVE WITH NITS, 0 Critical, 0 blocking; all 3 nits applied in `462806e`.
  **One user-decided deviation from the draft:** the draft had made `components/layout/site-header.tsx`
  `"use client"` purely so RTL could render it. Reverted to an **async server component** using
  `getTranslations` (matching the marketing layout/page); `site-header.test.tsx` deleted, all 5 of
  its pins moved into `tests/e2e/home.spec.ts`. Reason: the landing page is the most perf-sensitive
  SSG surface and L9c runs a perf audit — don't hydrate a static header just to make it testable.
  Reviewer ran `npm run build` and confirmed `/[locale]` is STILL prerendered for both locales
  (`app/[locale]/layout.tsx:52` still calls `setRequestLocale`). **Consequence for Tasks 6-19: a
  server component's strings can only be pinned in Playwright, so that surface is invisible to
  `npx vitest run`. Accept the trade; do NOT "fix" it by adding "use client".**
- Task 6 (`86d9ecc` + fixes `cfb1e48`): `dashboard`. Review caught that the ICU plural — the one
  piece of rewritten logic in the diff — had only a loose regex test, and that ICU `#` reformats
  1234 as "1,234" (byte-identity break; now `{count}` everywhere). `messages/en/dashboard.pin.test.ts`
  established the pin pattern for strings that live only in an async Server Component: the catalog
  is the SUBJECT, expectations are LITERALS.
- Task 6b (`b3b1dbc`..`b9a0d16`, INSERTED, 3 rounds): `lib/i18n/catalog.test.ts` rewritten to parse
  ICU ASTs. R1's guard let three defect classes through green; R2 fixed those but introduced a
  regression (rejected CORRECT `selectordinal` messages, because `@formatjs` parses them as
  TYPE.plural with `pluralType: "ordinal"` while `Intl.PluralRules` defaults to cardinal); R3
  carried `pluralType` + `offset` through. Controller verified R3 directly instead of a 4th review.
- Task 7 (`567bf0a` + fixes `8ae225a`): `kanji` + the FIRST promotion of shared strings to `common`.
  Review found `review-session.tsx` routed raw `Error.message` to the DOM, making the translated
  error string unreachable — a VN learner saw "Review failed (500)" or the browser's own
  "Failed to fetch". Two controller rulings reversed the controller's own brief: collapse
  `srs.back`/`srs.error` into the existing `common` keys (DRIFT argument), and rename
  `levelTabs.*` → `common.filters.all` + `common.a11y.levelFilter`. `coming-soon.tsx` deleted as
  dead code.
- Task 8 (`ae2bfce` + fixes `8746dc5`): `vocab`. User-approved decisions: stop rendering the API's
  `body.error` (English, server-authored, untranslatable at the client), and promote "Review" to
  `common.actions.review`. Review's mutation test exposed the unpinned AI-labeling compliance
  surface. The long-claimed "no ICU `#`" rule did NOT exist in `catalog.test.ts` (a false claim the
  controller had repeated in three briefs) — it exists now, verified to fire AND not to over-fire
  on a literal `#` in ordinary text.

**⚠ BACKLOG owned by NO task — close before the Task 19 gate:** `components/ui/theme-toggle.tsx:12-13`
ships hardcoded English `aria-label`/`title` ("Switch to {light|dark} theme"). It renders in BOTH the
marketing header and the app-shell nav, so under live `vi` a screen-reader user hears English. Fix per
Task 3's primitive rule: `common.a11y.toLightTheme`/`toDarkTheme` + a `label` prop threaded from
`SiteHeader` and `AppNav` (pattern 5 applies — needs a non-English literal in one test).

**GOTCHA that cost time this session (write it into your debugging reflex):** two e2e register-flow
specs failed with "stuck on /en/register" — the cause was **Docker Desktop being OFF** (local Supabase
down), NOT the code. `home.spec.ts` needs no auth and stayed green, which is the tell. **Run `docker ps`
before debugging any e2e failure involving registration or sign-in.** Separately: running `npx vitest run`
and `npx playwright test` CONCURRENTLY reproduces the documented `waveform.test.tsx` CPU-contention flake.
Run the gates sequentially.

**RESUME next session: Task 6 (`dashboard` namespace), then Tasks 7-19**, same cadence
(fresh implementer subagent → independent code-review → fix loop → commit). Ledger:
`.superpowers/sdd/progress.md`.

**HARD-WON PATTERNS from Tasks 1-4 — every later task MUST follow (don't relearn the Criticals):**
1. **Pin every extracted string BEFORE changing code; the test passes while strings are still
   hardcoded** (characterization test for a behaviour-preserving refactor). Pin ALL strings incl.
   aria-labels, not a sample. Iterate the component's own list where one exists.
2. **NEVER derive a pinned expected value from the catalog under test.** `@/test/render` feeds the
   component that same JSON, so `import enNav from messages/en/nav.json; expect(...name: enNav.x)`
   compares the file to itself and stays green through a typo. Expected values = LITERAL strings in
   the test. (This was a CRITICAL in Task 2, twice.) Importing a catalog only for `Object.keys`
   structural parity is fine.
3. **EN + VN land in the SAME commit** — catalog.test.ts asserts key + ICU-arg parity; an EN-only
   commit is red. Register a namespace in 3 places: namespaces.ts, types/messages.d.ts, both dirs.
4. **English byte-identical** (except Task 5's 3 authorized copy fixes). D6 safety net depends on it.
5. **Prop-threaded copy needs a NON-English literal in one test** — an EN test can't tell a
   correctly-threaded label from its own English fallback (both render the same). tsc catches a
   missing prop, not a dropped one.
6. A component rendering ThemeToggle/ReduceMotionToggle needs `<ThemeProvider>` in the test wrapper.
7. Keep `text-*-strong` classes — plan snippets predate the WCAG fix (b4b4fcb) and would revert it.
8. **VN tone marks = MODERN placement** (Hủy/Xóa, mark on main vowel) — user decision, binding.
9. Client comps: `useTranslations` from `@/lib/i18n`. Server: `getTranslations` from
   `@/lib/i18n/server`. NEVER import next-intl directly (ESLint-enforced, fire-tested).
   Server-action i18n test = mock @/lib/i18n/server getTranslations w/ use-intl/core createTranslator
   seeded from the real EN catalog. Form comps need the vi.mock("react-dom",...) shim (real
   react-dom@18.3.1 lacks useFormState/useFormStatus) — causes an EXPECTED form-action warning.

**Minor findings carried to the FINAL whole-branch review** (don't fix mid-stream unless trivial):
(a) test/messages content-assert covers only `common`; (c) app-nav structural test hardcodes the
"ariaLabel" key exclusion; (d) task-3 report test-count arithmetic off; (e) admin video-queue/
content-form half-translated under live `vi` (Task 17 owns); (f) `use-intl/core` imported but not a
declared dep AND not covered by the next-intl eslint boundary — add devDependency + shared test
helper; (g) translateValidationKey switch hand-lists the 5 keys a 3rd time; (h) login/register
page.tsx headings have no RTL pin; (i) /login never displays ?error=auth|oauth (dead query param).

Plan-3 baseline (verified before Task 5): **1325 tests / 179 files · tsc 0 · lint exit 0 / 80
pre-existing warnings across 23 files · playwright 3 specs green**.

---

## ✅ Plan 3 WRITTEN 2026-07-19 (`66ea4b7`, updated `300ee94`+) — now EXECUTING (see block above)
`docs/superpowers/plans/2026-07-19-l9a-string-extraction-vietnamese.md`, 19 tasks.
**Key deviation from the spec, forced by the repo:** spec §5 splits Phase 2 (extract EN) from
Phase 3 (fill VN), but `lib/i18n/catalog.test.ts` ALREADY asserts identical key sets across
locales — so an EN-only commit is a red test. VN is filled in the SAME task per module. One pass,
not two.
**Task 1 is the linchpin:** `test/render.tsx` currently passes `messages={{}}`; the moment a
component calls `t()` it renders the KEY and every English assertion in that module dies. Task 1
loads the real EN catalogs via `import.meta.glob`. Do it first or every later task fights itself.
**Companion titles (Task 17):** `titleFor()` is called from a service-role write path and
PERSISTS the rendered string into `companion_memories.title`, where no request locale exists — so
`t()` inside it is impossible. Plan replaces it with `memoryTitleFor()` returning a
`{key, values}` descriptor, writes `title: null` for discovered memories, renders at READ time
(L9b Journal). Also fixes the P12 violation: "giai đoạn 2" → four phase-specific phrasings
containing no numbers.
**Third false-trial instance found in the browser pass**, missed by grep: the REGISTER page reads
"Start your 7-day trial" (`app/[locale]/(auth)/register/page.tsx:9`). All three now tabulated in
plan Task 5. Its "No card required." subtitle is TRUE and stays.
**Honest gap in the plan:** Tasks 1–5 and 17 carry full code; Tasks 6–16 carry exact file lists,
namespace, per-module notes and the 9-step procedure, but not pre-written catalogs — deliberate,
since ~1500 VN strings written blind would be worse than written with the source open. The
binding VN terminology glossary + key-naming convention at the top of the plan are what keep 20
independently-executed tasks consistent.

## Plan 2/3 (Design System Foundation) — ✅ MERGED to master (`fcd35af` --no-ff, 2026-07-18)

All 12 tasks done via subagent-driven-development, every task review clean; final whole-branch
review (fable): READY TO MERGE = YES. **User chose merge-now BEFORE the manual browser pass —
that pass is STILL OWED on master** (checklist below). Local branch deleted; NOT pushed (remote
holds stale `origin/layer-9a-design-system` — prune when pushing). Post-merge verify on master:
tsc 0 · 1293/1293. Gates at tip: **tsc 0 · unit 1293/1293 (175 files) · lint exit 0 (80
pre-existing warnings predate branch, 0 new) · build OK · playwright 2/2**. Plan doc (with
execution addendum): `docs/superpowers/plans/2026-07-18-l9a-design-system.md`.

**Shipped:** middleware-composition regression test (`middleware.test.ts` — auth 3xx
short-circuit + Set-Cookie carry, mutation-proven); full token system in `app/globals.css` +
`tailwind.config.ts` (spacing 2xs–3xl, type scale caption→display + `leading-jp`, elevation
raised/overlay/floating w/ dark variants, motion duration/ease tokens, z ladder nav/overlay/
popover/toast) guarded by `lib/design-tokens.test.ts`; primitive→semantic colour tiers
(bit-identical values, exact-mapping test); Radix boundary (ESLint P8 + fire-tests incl.
deep-import, jsdom polyfills, §8 logical-properties scan test); 8 primitives in
`components/ui/` (dialog w/ real focus trap — admin dialog now a thin wrapper, L7 WCAG 2.4.3
debt repaid; tabs; select flat-options; tooltip; popover; toast + `useToast` + ToastProvider
mounted in `app/[locale]/layout.tsx`; badge; skeleton); living style guide at
`/[locale]/admin/style-guide` behind requireAdmin (D9), nav item in AdminShell.

**LOAD-BEARING new in Plan 2 — never "clean up":**
1. **`lib/utils.ts` uses `extendTailwindMerge` configured with EVERY custom scale.** Plain
   `twMerge` misclassifies `text-body`/`text-caption` as colours and silently STRIPS them in
   `cn()` (the final review's one Critical — it corrupted Badge/Select/Tabs). **Any new token
   scale added to tailwind.config.ts MUST also be added to this config**; `lib/utils.test.ts`
   is the guard.
2. `.eslintrc.json` `components/ui/**` override RESTATES the import rule minus the Radix
   pattern (ESLint overrides replace wholesale — editing one copy requires editing both;
   `lib/eslint-rules.test.ts` fire-tests are the net).
3. Style-guide elevation swatches use a literal class map — dynamic `shadow-${x}` is never
   emitted by Tailwind static extraction.
4. Dialog: explicit `aria-modal` + manual focus capture/restore (Radix 1.1.19 doesn't provide
   them for an external-trigger API); ordering is layout-effect-vs-passive-effect, verified.
5. Tailwind `fontWeight`/`letterSpacing` overridden with identical-value var() refs (deliberate).

**Manual browser pass STILL OWED on master (merge happened first, user's choice):** at `/vi/admin/style-guide` —
(1) badge-variant AA contrast in both themes (reviewer estimates tinted variants may be near/
below 4.5:1 — if failing, darken text tones), (2) three visibly distinct elevation shadows,
(3) tab/select/badge text sizes match the type-scale section, (4) dialog focus trap, theme/
reduce-motion/locale controls, toasts.

**Deferred by final-review triage:** scrim-dark-check scope + popover vi.fn + tabs arrow
coverage + select disabled/ref tests → Plan 3 or L9b; toast dismissLabel + viewport label
i18n → Plan 3 (by design, P4); useToast fresh-object + toast queue cap + per-instance
TooltipProvider skip-delay → L9b/L9c; JP colour comments cosmetic → L9b.

**Plan 3 (string extraction + VN) remains NOT WRITTEN.** Its must-dos (from Plan 1 review)
unchanged below, plus: pass translated `closeLabel`/`dismissLabel` into Dialog/ToastProvider.

---

# L9a Plan 1/3 (Localization Architecture) — ✅ COMPLETE & MERGED (`69f22e6`, 2026-07-18)

**Run finished 2026-07-18. All 8 tasks done + reviewed; final whole-branch review (opus) verdict:
READY TO MERGE = YES, 0 Critical, 0 Important-blocking. User chose merge --no-ff → master
`69f22e6`; local branch deleted; post-merge verify tsc 0 + 1229/1229. NOT pushed
(origin/layer-9a-... holds a stale pre-finish tip).** Was branch
`layer-9a-localization-architecture` (off master @ `0419c15`), final tip `cddf961`, 18 commits. Method: subagent-driven-development; full
per-task detail in `.superpowers/sdd/progress.md` (gitignored scratch; if gone, this + `git log`).

## What shipped (Plan 1 of 3)

- `lib/i18n/**`: routing (vi/en, defaultLocale vi, localePrefix "always"), namespaces, request
  config, locale-aware navigation (createNavigation), stripLocale, server barrel (+`getLocale`).
- `app/` → `app/[locale]/` (4 route groups + root layout w/ generateStaticParams,
  setRequestLocale, hasLocale guard, NextIntlClientProvider, `<html lang>`).
- Middleware composed **Supabase FIRST → next-intl**, Set-Cookie copied onto intl's response;
  matcher excludes **api AND auth**; route protection matches locale-STRIPPED paths (security
  matrix generated from routing.locales × PROTECTED_PREFIXES + literal-pin test).
- ALL feature code imports Link/redirect/useRouter/usePathname from `@/lib/i18n/navigation`
  (useSearchParams/useParams/notFound stay on next/navigation).
- ESLint boundary MERGED into Spec A's AI-SDK no-restricted-imports; escape hatches
  `lib/i18n/**`, `app/[[]locale[]]/layout.tsx` (minimatch-escaped), `test/render.tsx`;
  `lib/eslint-rules.test.ts` 7/7 lints REAL source via real resolved config (rules FIRE).
- Zero user-visible change confirmed (text still hardcoded EN; seed catalogs unused by render).

## Verified baseline at ceb7445 (Task 8 gate — Plans 2/3 + L9c compare against THESE)

**Unit 1229 tests / 162 files · lint clean · tsc 0 · build 52s · playwright 2/2 in 37s.**
Build route table: every no-dynamic-segment page = SSG per locale; the 9 ƒ pages are pre-existing
[id]/[type] routes. Curl signed-out matrix: all 4 locale×route pairs redirect to matching-locale
login with locale-prefixed redirectTo.

## LOAD-BEARING — never "clean up" (measured, reviewer-verified at library-source level)

1. **Middleware order Supabase FIRST → intl**, cookie copy loop in `middleware.ts`. next-intl
   4.13.2 forwards `new Headers(request.headers)` at run time, AFTER Supabase's
   `request.cookies.set()` wrote through — reversing reintroduces the stale-token auth bug.
2. **`response = NextResponse.next({request})` AFTER `request.cookies.set()`** in updateSession's
   setAll (`lib/supabase/middleware.ts:54`, commented).
3. **Matcher excludes `auth`** — else `/auth/callback` 307s to `/vi/auth/callback` = every Google
   sign-in broken.
4. **Anti-double-prefix in `app/[locale]/(auth)/actions.ts`**: a PRESENT redirectTo is already
   locale-prefixed (from middleware) — login() strips (stripLocale) then re-adds via getLocale();
   next-intl v4 `redirect` takes **`{href, locale}`**, NOT a string. OAuth absolute URLs pass
   through unprefixed (isLocalizableHref=false for `^[a-z]+:`). Comment at call site load-bearing.
5. **`vitest.config.ts` `server.deps.inline: [/next-intl/]`** — Plan 3's ~62 provider-rendered
   test files depend on it.
6. **ESLint glob `app/[[]locale[]]/layout.tsx`** — unescaped `[locale]` is a minimatch char class.
7. **`lib/i18n/navigation.ts` redirect wrapper fn** — TS can't narrow `never` return destructured
   from generic createNavigation; wrapper is documented, not redundant.
8. `next.config.mjs` (not .js); its webpack edge-alias for @anthropic-ai/sdk stays.

## Patterns Plans 2/3 MUST reuse

- **Server-side redirect**: `const locale = await getLocale(); redirect({ href: "/unprefixed", locale })`
  (see `app/[locale]/(admin)/admin/layout.tsx`).
- **Component tests**: import render from **`@/test/render`** (wraps NextIntlClientProvider,
  locale="en"); href assertions expect `/en/...`-prefixed INCLUDING query preservation.
- Adding a namespace touches 3 places: `lib/i18n/namespaces.ts`, `types/messages.d.ts`, catalog
  dirs (~18 coming in Plan 3; plain template-literal dynamic import, no loader map needed).

## Follow-ups assigned by the final review (do NOT lose)

- **PLAN 2, FIRST**: automated test for the top-level `middleware()` composition (mock
  updateSession → assert Set-Cookie carried onto intl response + 3xx short-circuits before intl).
  The one place a refactor could silently reopen the measured auth-cookie bug.
- **PLAN 3**: re-prefix `app/auth/callback/route.ts` error branch (bare `/login?error=auth`);
  OAuth + login round-trip e2e (closes carried d/g); fix "Start free trial" copy (no-trial model);
  move Companion template titles into i18n.
- Optional: AI-SDK ESLint fire-test (guard currently proven only by manual verification).
- Accepted as-is: `^4.13.2` caret (repo convention); getPathname reserved surface; whole catalog
  in RSC payload (deferred L9c, documented in layout); login() uses login-page locale over a
  hand-crafted mismatched redirectTo locale (cosmetic).
- Known flakes under full-suite CPU contention (standalone-green): pitch-contour.test.tsx,
  waveform.test.tsx. Also: a STALE node process on port 3000 makes playwright reuseExistingServer
  pick it up → kill stale node before e2e.

## Next after merge

Roadmap: **Plan 2 (design system) and Plan 3 (string extraction + VN) — both unblocked now, can
run in parallel** → L9b surfaces → L8 billing → L9c polish/perf. Plans 2/3 are NOT WRITTEN yet
(need writing-plans runs off the spec `docs/superpowers/specs/2026-07-17-l9a-i18n-design-system-design.md`).

## Process lessons this run re-proved

- Reality outranks the plan (redirect signature `{href,locale}`; ESLint "comment" key; brief's
  file counts wrong twice — 33 not 32 next/link, 18+actions.ts not 17 next/navigation).
- Verify claims, don't trust reports: a fixer mislabeled its own test breakage "pre-existing";
  controller disproved via the green-at-base fact and forced the repair.
- Reviewers verifying independently (rereading library source, manually firing lint rules,
  adversarial route probing) caught everything that mattered: 2 missed migration files, the
  matrix blindness, the auth-cookie ordering bug (previous session).
