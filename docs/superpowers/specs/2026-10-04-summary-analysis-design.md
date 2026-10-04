# Summary / Analysis mode (Part 4) — Design

- Date: 2026-10-04
- Branch: `summary-analysis` (worktree `.worktrees/summary-analysis`), from master `09d2684`
- Figma: `125:1030` (Summary in shadowing), file `IwFHZDZdHW7qsSFiNbWrkd`
- Status: brainstormed with the owner 2026-10-04 in four sections, each approved with amendments, all folded in
  below — **frozen pending the owner's review of this text**. Next: `writing-plans`.
- Parents: `2026-07-31-shadowing-hub-lesson-workspace-design.md` (§0.5, §6.2, §6.8, §7, §10 amended by §0 here),
  `2026-10-01-shadowing-workspace-part-1a-design.md` (Q1 mode registry), `2026-10-02-shadowing-workspace-part-1b-reframe-design.md`
  (Knowledge core dormant until Korume / Summary call it), `2026-10-03-ask-korume-design.md` (one persona, Korume).

## 0. Rulings and what this file amends

| # | Ruling (owner, 2026-10-04) |
|---|---|
| R1 | **Persona is not memory scope.** Korume may appear in Summary as a lesson coach. Summary must not retrieve Companion Memory (`companion_memories`), prior-lesson history, or a learner profile, and must not start a conversation. Historical metrics computed by the learning system may be displayed; they grant Summary no access to Companion Memory. |
| R2 | **Keep the "A quiet reflection" card, written by AI, lesson-local.** One-way, 2–3 sentences, no chat. Cached; deterministic fallback when AI is unavailable. `Open Memory` is navigation only. `Review Tomorrow` acts on this lesson's review targets only. |
| R3 | **Lesson Status reads existing tables**, all four rows as in the frame. A mode with no evidence is `not_started`, never `0`. Lesson Status is deterministic and never calls AI. |
| R4 | **Future learning modes integrate by supplying data to the lesson-status / lesson-snapshot contract. Summary must not be rewritten to accommodate each mode.** Only the adapters behind the contract may change. |
| R5 | **Lesson analysis is generated lazily** on the first Summary open for a lesson + locale, system-funded, deduplicated by the Knowledge-core lease, shared by every learner. No backfill. |
| R6 | **Grounded facts come from deterministic sources. AI supplies selection, prioritization, explanation, nuance, and clearly labelled generated practice.** Vocabulary and grammar originate from deterministic candidates and AI selects them by id; reading, meaning, JLPT, part of speech and grammar metadata always come from the database. Expressions and culture may be proposed by AI but must anchor to a real transcript line and pass server validation. |
| R7 | **Within Summary, Free and Plus are identical.** Summary does not take part in the Free / deep cascade. The reflection is available to both plans, limited only by system safeguards with a deterministic fallback. No `isPlus` branch anywhere in Summary — UI, API shape, or data layer. |
| R8 | **Things You Should Review** is a deterministic lesson-local target list. `Review Again` deep-links to the line in Shadowing now. `Review Tomorrow` upserts those lines as existing sentence-mining cards due tomorrow. No AI, no notification, no new review system. |
| R9 | **Saved Knowledge reports only persisted learner data.** No synthetic "Memory growth" percentage; the fourth tile is Retention, and reads `Not enough data` until review evidence exists. |

**Amendments to `2026-07-31-shadowing-hub-lesson-workspace-design.md`** (that file is edited in the same commit
series to point here):

- §0.5 "Summary understands the lesson. Companion understands the learner." stays, reworded: *Summary understands
  this lesson. Companion understands the learner across lessons.* What is forbidden in Summary is **Companion
  memory retrieval**, not the Korume persona (R1).
- §6.2 "Content split follows the existing cascade free/deep line" is **deleted** (R7).
- §6.8 "Summary Mode was explicitly considered as a possible Companion touchpoint and rejected" is replaced by R1/R2.
- §10 "Summary Mode's AI-summary caching/generation strategy" is decided by §4 here.

## 1. Scope

In: the `/shadowing/[id]/summary` route and its UI per Figma `125:1030`; the deterministic lesson snapshot; the shared
lesson analysis (a new Knowledge-core section); the personal Korume reflection (a new table); Review Tomorrow;
saving words and expressions from Summary; the `LessonHeaderFrame` extraction; enabling Summary in the mode registry.

Out: Pronunciation (Part 2) and Listening (Part 3) modes themselves; deleting the legacy `video_summaries` table,
`/api/videos/[id]/summary` and `VideoSummaryPanel` (kept untouched, per 1a Q4 — Summary never reads them);
notifications; a review-event history table; prewarming analyses.

## 2. Architecture

```
Deterministic (renders immediately, never waits on AI)
  getLessonStatus ─┐
  getSavedKnowledge├─► LessonSnapshot ──────────────────────────► UI rail + review list
  getReviewTargets ┘          │
                              │ projected (no counts, no scores)
  getNextLesson ─► SummaryNavigation ─► UI only (never reaches AI)
                              ▼
Shared lesson analysis (Knowledge core, one per lesson + locale + input hash)
  candidates + transcript ─► Gemini ─► validate ─► store ids + generated text ─► hydrate from DB on read ─► UI
                              │
                              ▼  (only once the analysis is ready, or known unusable → fallback)
Personal Korume reflection (lesson_reflections, one per user + lesson + locale + analysis + evidence)
  ReflectionEvidence + LessonAnalysisView ─► Gemini ─► validate ─► UI card
```

### 2.1 Units

| Unit | Purpose | Reads | AI |
|---|---|---|---|
| `getLessonStatus(userId, lessonId)` | Four rows, each a normalized state (§3.1) | `shadowing_sessions`, `dictation_attempts`, `sentence_mining_cards`, `transcript_lines` | no |
| `getSavedKnowledge(userId, lessonId)` | Vocabulary / Expressions / Grammar / Retention tiles (§3.2) | `sentence_mining_cards`, `user_grammar_progress`, grammar-matcher hits for the lesson | no |
| `getReviewTargets(userId, lessonId)` | Lesson-local review targets (§3.3) | `shadowing_sessions`, `dictation_attempts`, `sentence_marks`, grammar-matcher hits | no |
| `getNextLesson(userId, lessonId)` | Next lesson: next in an ordered collection containing this lesson, else the existing i+1 recommender (`lib/data/recommendations.ts`) | collections, recommendations | no |
| Lesson analysis | Hero overview, Words, Natural Japanese, Grammar, Culture (§4) | Knowledge core section `lesson_analysis` | yes, once per lesson + locale + input |
| Korume reflection | The rail card (§5) | `lesson_reflections` | yes, once per user + lesson + locale + analysis + evidence |

### 2.2 Types that enforce the boundaries

```ts
type LessonSnapshot = {          // lesson-local evidence only
  status: LessonStatus;
  savedKnowledge: SavedKnowledge;
  reviewTargets: ReviewTarget[];
};
type SummaryNavigation = { nextLesson: NextLesson | null };   // UI only

function buildReflectionInput(
  evidence: ReflectionEvidence,      // projected from LessonSnapshot: no scores, no counts (§5.1)
  analysis: LessonAnalysisView,
  lessonTitle: string,
): ReflectionPromptInput;
```

`buildReflectionInput` cannot receive `SummaryNavigation` or the page-level object: a type test pins this
(`@ts-expect-error`). Nothing in Summary imports from `lib/data/companion*` or reads `companion_memories`; a test
pins the import boundary.

## 3. Deterministic snapshot

### 3.1 Lesson Status

`type ModeState = { kind: "not_started" } | { kind: "in_progress"; percent: number } | { kind: "complete" }
| { kind: "scored"; score: number } | { kind: "not_enough_data" }`.

| Row | Adapter (explicit, the only place that changes when Part 2/3 ship) |
|---|---|
| Shadowing | distinct lesson lines with a `shadowing_sessions` row ÷ lesson lines → `in_progress(percent)`; all lines → `complete`; none → `not_started` |
| Pronunciation | mean `pronunciation_score` over this lesson's `shadowing_sessions` rows that have one → `scored`; no scored row → `not_started` |
| Listening | **`dictation_attempts`** for this lesson: mean `accuracy_score` → `scored`; none → `not_started` |
| Retention | all of this lesson's `sentence_mining_cards` (every `source_kind`, including `sentence`): no card ever reviewed (`last_reviewed_at is null` for all) → `not_enough_data`; else share with `srs_stage >= MASTERY_THRESHOLD` → `scored` |

`MASTERY_THRESHOLD` is imported from `lib/data/difficulty.ts` (today `2`: `srs_stage` is the SM-2 repetitions
count, `lib/data/srs.ts`, `lib/data/mining.ts`); never a literal. A score of `0` is `scored(0)`, never
`not_started`.

### 3.2 Saved Knowledge

| Tile | Value |
|---|---|
| Vocabulary | this lesson's cards with `source_kind = 'vocabulary'` |
| Expressions | this lesson's cards with `source_kind = 'expression'` |
| Grammar | distinct `grammar_id`s matched in this lesson that have a `user_grammar_progress` row |
| Retention | count of this lesson's `vocabulary` + `expression` cards with `srs_stage >= MASTERY_THRESHOLD`, shown as "N remembered"; `Not enough data` when none of them was ever reviewed |

`sentence` cards (made by Review Tomorrow) never count here, so pressing Review Tomorrow never changes Saved
Knowledge; they do count in Lesson Status › Retention (§3.1). `getSavedKnowledge` does not depend on the analysis.

### 3.3 Review targets

`type ReviewTarget = { lineId: string; reasons: ReviewReason[]; focusSpan: string | null }`, one per line (a line
flagged for several reasons is one target). Reasons, all from this lesson's rows: the line's latest `pitch_score`
or `pronunciation_score` below `REVIEW_PRONUNCIATION_BELOW` (60), its latest `dictation_attempts.accuracy_score`
below `REVIEW_DICTATION_BELOW` (80), a `difficult` `sentence_mark`, and a grammar-matcher hit inside an
already-flagged line. The repo has no existing "weak score" threshold (verified 2026-10-04), so these two named
constants live in one module with a `ponytail:` note — they are calibration knobs, tuned after the live look.
`focusSpan` priority: the dictation mistake span, then the grammar span, then null. A target that cannot map to a
real transcript line is not produced. Ordered by severity, capped for display; the full list feeds Review Tomorrow.

## 4. Shared lesson analysis

### 4.1 Section and cache key

A new Knowledge-core section `lesson_analysis` (registry entry, `contextPolicy: "video"`, `access: "system"`,
`contentVariant: "full"` only). Key:

- `fingerprint` = sha256 of the **canonical AI input actually sent**: ordered transcript lines `(line_id, text)`,
  the vocabulary candidate tuples and the grammar candidate tuples (§4.2). Anything that changes the candidates
  changes the key; nothing else does.
- `contextKey` = `video_id`; `locale` = the UI locale (`vi | en`); `schemaVersion`, `generatorVersion` from the
  section definition.

### 4.2 Input (built by the server)

- Lines as short ids `L1…Ln`, mapped to uuids server-side; Gemini never sees a uuid. Japanese text sits in a
  delimited data block, never in instructions (the existing section convention).
- Vocabulary candidates `v1…` from `lib/analysis/lesson-vocabulary.ts`: `{ent_seq, surface, line}` (first
  occurrence), the first 60 in that module's existing order (most frequent first, then `ent_seq`).
- Grammar candidates `g1…` from `lib/analysis/grammar-matcher.ts`: `{grammar_id, line, span}` (first occurrence
  per `grammar_id`), the first 40 in transcript order.

Short ids exist only inside one request. The stored artifact holds canonical ids (`ent_seq`, `grammar_id`, real
`source_line_id`), never `v17` / `g4` / `L12`.

### 4.3 Output schema (what Gemini returns)

Flat schema; no `maxItems` nested inside an array item (lesson L-042; the adapter strip stays as the backstop).
Each item is parsed with a **strict** object schema: an item carrying any field outside its contract — e.g. a
`reading`, `jlpt` or `meaning` — is **dropped**, so a factual field from AI has no path into the artifact.

| Block | Gemini returns | Count |
|---|---|---|
| Hero | `overview` (1–2 sentences) | 1 |
| Words | `candidate_id`, `why_it_matters`, `usage_note` | 3–6 |
| Natural Japanese | `line`, `span`, `meaning_use`, `nuance`, `commonness` (`very_common \| common \| situational`) | 2–5 |
| Grammar | `candidate_id`, `meaning_short`, `explanation`, `try_it` | 2–4 |
| Culture | `line`, `title`, `body` | 0–3 |

Minimum per block = `min(the block's minimum, candidates available)`; a lesson with one word candidate is not asked
for three.

**Culture boundary.** A culture note is a *pragmatic or social-context interpretation grounded in the utterance*
("this phrasing softens a refusal in a service setting"), never a mini-encyclopedia: no claims about history,
statistics, law, etymology or broad customs the line cannot support. The prompt states this; an item that cannot
meet it is omitted. This boundary is enforced by the prompt and by manual review in the live smoke (§8), not
mechanically — the spec does not pretend otherwise.

`try_it` is the one place AI writes new Japanese; the UI labels it a practice example, never lesson content.

### 4.4 Validation (before storing)

1. Strict-parse each item (above); drop failures.
2. Drop an item whose `candidate_id` or `line` does not exist in this request.
3. Drop an expression whose `span` is not a substring of its line after NFKC normalization; same for any span.
4. Drop duplicates (same canonical id, or same line + span).
5. If the server offered at least one valid candidate for Words or Grammar and **both** come back empty after
   steps 1–4 → `validation_error` (the core's backoff / retry applies). If the candidate pool itself was empty,
   store a ready artifact with empty blocks.
6. Culture and Natural Japanese may be empty; the UI shows a real empty state.

### 4.5 Stored artifact and hydration

Stored: `overview`, and per item the canonical id (`ent_seq` / `grammar_id`, or none for expressions and culture),
`source_line_id`, `source_span`, and the generated text fields. Hydrated **on read**, never stored:

| Block | From the database |
|---|---|
| Words | written form, reading, meanings, part of speech, JLPT, `common` from `dict_entries` (active snapshot, by `ent_seq`); source sentence |
| Grammar | `title`, `jlpt_level` from `grammar_points`; "From lesson" = the source line |
| Natural Japanese, Culture | source sentence |
| Hero | title, thumbnail, JLPT, sentence count, duration from the lesson |

A candidate whose `ent_seq` is missing from the active snapshot at read time is not rendered (no placeholder).

### 4.6 Generation flow

- `GET /api/videos/[id]/lesson-analysis` → the ready entry hydrated, or `404 not_ready`. Read-only; the
  kill-switch path uses `readReady` only. (A new path, not under the legacy `/api/videos/[id]/summary`.)
- `POST` same path → the Knowledge-core orchestrator: **`claimLease` first; only the leader calls `ai_reserve`**
  (billing scope `system`, `requestedBy` = the caller, counting toward `AI_SYSTEM_GENERATIONS_PER_USER_PER_DAY`;
  the global USD/day fuse applies). A follower gets `202` + `Retry-After` and **never reserves**. A ready entry
  returns `200`.
- Lease expiry, stale `lease_token`, backoff and retry semantics are the core's, unchanged (migration 038).
- Outcomes the client must distinguish: `ready`, `pending (Retry-After)`, `retryable_error (retry_after)`,
  `unavailable` (kill-switch, fuse, cap — terminal for this request), `no_transcript`.

### 4.7 Frame deviations from AI content

- Word tag **Common** when `dict_entries.common = true`; the frame's "Daily" has no data source and is dropped.
- Expression `commonness` ("Very Common") is an AI judgment (selection / prioritization, allowed by R6); there is no
  dictionary source for an expression.
- The frame's "Native pronunciation" becomes **"Hear in lesson"**: it plays the line's original clip; the source
  does not guarantee a native speaker.

## 5. Personal Korume reflection

### 5.1 Input

`ReflectionEvidence` is projected from `LessonSnapshot` with **no scores and no counts**: per-mode qualitative
state (`not_started | practiced | strong | needs_work`), whether anything was saved, up to three review-target lines
(text + reason), the best-scoring line (text only). Plus `LessonAnalysisView` (overview and the selected items'
labels) and the lesson title. Nothing else (§2.2). AI that never sees a number cannot misstate one.

### 5.2 When it is generated

- Only after the lesson analysis is ready. While the analysis is generating, the card shows a skeleton; once the
  analysis is known unusable (unavailable, failed after backoff, no transcript) the card renders the fallback.
- Not at all when the evidence is empty (every mode `not_started`, nothing saved, no targets): fallback invitation,
  no AI call.
- Single-flight and budget: a `reflection_claim` function with the **same lease state machine** as the Knowledge
  core (pending / ready / failed, `lease_until`, `lease_token`, expired-lease takeover, stale-token rejection) —
  not a new variant. The leader alone calls `ai_reserve` (scope `system`, the per-user daily cap).
- Routes: `GET /api/videos/[id]/lesson-reflection` (the caller's current reflection, or `404`) and `POST` same path
  (claim → generate, `202` + `Retry-After` for a follower). The caller's user id comes from the session only.

### 5.3 Output and validation

Gemini returns `{ text, highlight_line_id?, highlight_span? }`. `text` is 2–3 sentences (≤ ~320 characters) and
**contains no quotation of Japanese**; the UI renders `「highlight_span」` itself. Validation: strict parse;
`highlight_line_id` exists in the lesson and `highlight_span` is a substring of that line (NFKC), else the highlight
is dropped; `text` containing an ASCII digit is rejected (secondary defence — §5.1 is the primary one). Rejected →
fallback.

### 5.4 Identity and regeneration

Unique on `(user_id, video_id, locale, analysis_fingerprint, evidence_fingerprint, schema_version,
generator_version)`.

- `analysis_fingerprint` = the lesson analysis key's fingerprint: a regenerated analysis makes the reflection stale.
- `evidence_fingerprint` = hash of `ReflectionEvidence` (already coarse: qualitative states, not raw numbers), so a
  few more reviews do not regenerate it, finishing Dictation does.
- On a fingerprint change the previous reflection keeps showing while the new one generates
  (stale-while-regenerate); generation happens only when Summary is opened.

### 5.5 Table `lesson_reflections` (new migration)

User-owned derived data, therefore explicit ownership and cascade deletion; shared `knowledge_entries` must never
contain personalized content. Columns: `id`, `user_id → users ON DELETE CASCADE`, `video_id → videos ON DELETE
CASCADE`, `locale`, `analysis_fingerprint`, `evidence_fingerprint`, `schema_version`, `generator_version`, `status`,
`lease_until`, `lease_token`, `content jsonb`, `model`, `provider`, `error_code`, `retry_after`, `attempts`,
`created_at`, `updated_at`. RLS: the owner may SELECT; no write policy for `authenticated`. `reflection_claim` /
complete / fail are `SECURITY DEFINER` with a pinned `search_path`, `revoke all ... from public, anon,
authenticated`, `grant execute ... to service_role`. Account erase covers it through the cascade (the erase gate is
extended to prove it).

### 5.6 Fallback

Deterministic i18n templates from `LessonSnapshot`: with a best line, a sentence naming it; otherwise one per lesson
state. In fallback the eyebrow reads **KORUME** instead of **AI KORUME** — a template is not called AI.

### 5.7 Actions

- `Open Memory` → `/companion`. Navigation only; the card never reads Memory.
- `Review Tomorrow` → §6.2.

## 6. Learner writes

### 6.1 Schema change to `sentence_mining_cards` (edited in place, `20260712000008_sentence_mining_cards.sql`, AGENTS.md §6)

- `source_kind text not null default 'vocabulary' check (source_kind in ('vocabulary', 'expression', 'sentence'))`
- `source_ref text` — `ent_seq` for vocabulary, the normalized span for an expression, null for a sentence card.
- `unique (user_id, transcript_line_id) where source_kind = 'sentence'` (partial unique index)
- `unique (user_id, transcript_line_id, source_kind, source_ref) where source_kind in ('vocabulary', 'expression')
  and source_ref is not null` (partial unique index)

Every environment runs `npx supabase db reset`, so there is no legacy data to migrate. Existing producers (Look-up
→ Mining) keep writing `vocabulary` and set `source_ref` when they know the `ent_seq`.

### 6.2 Review Tomorrow

For each review target: upsert one `source_kind = 'sentence'` card for `(user, line)` — `target_word` =
`focusSpan` when present, else the sentence; sentence, translation, `start_time` / `end_time` from the line — with
`next_review_at = least(existing next_review_at, tomorrow 00:00 in the learner's timezone)`, converted to a UTC
timestamp. A later due date is pulled in; an earlier one is untouched; repeating is a no-op. A target with no real
line creates nothing. No AI, no analysis regeneration. One SQL function, atomic over the target set, behind
`POST /api/videos/[id]/review-tomorrow` (the server recomputes the targets; the client sends no line ids).
**Timezone source:** the repo stores no learner timezone (verified 2026-10-04), so the body carries the browser's IANA
zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`); the server accepts it only if `Intl` recognizes it
(`400` otherwise) and computes "tomorrow 00:00" in that zone. A stored preference is out of scope. On success the
button becomes **`Scheduled for tomorrow ✓`** (disabled, keeps focus) — that string is canonical for UI and tests.

### 6.3 Saving words and expressions

Word cards (bookmark) and Natural Japanese cards (a Save control added — the frame lacks one, but without it
`source_kind = 'expression'` would have no producer) toggle one card keyed by the §6.1 unique index: save = upsert,
un-save = delete that card (its SRS progress with it). `aria-pressed` reflects the persisted state; double clicks
and retries cannot create duplicates because the database refuses them. Transport: the existing `POST /api/mining`
gains optional `sourceKind` / `sourceRef` and upserts on the §6.1 index (returning the existing card on conflict);
a new `DELETE /api/mining/[cardId]` removes one of the caller's cards (RLS already confines it to the owner).

## 7. UI

### 7.1 Route tree and header

```
app/[locale]/(protected)/(focus)/shadowing/[id]/
  (workspace)/layout.tsx   # workspace shell: player, grid, drawer — Shadowing only
  (workspace)/page.tsx     # Shadowing
  dictation/page.tsx
  summary/page.tsx         # NEW — outside (workspace); no [id]/layout.tsx is added (it would wrap dictation)
```

`WorkspaceHeader` reads workspace context, so a props-only `LessonHeaderFrame` (Back, title, source line, JLPT,
slots) is extracted; `WorkspaceHeader` and a new `SummaryHeader` both wrap it. Summary must not import workspace
context, player or drawer modules (an import-boundary test pins it). The Shadowing workspace keeps its keyboard,
drawer and player behaviour after the extraction (its existing tests plus the Shadowing e2e prove it).

`LEARNING_MODES` sets `summary.complete = true`; per 1a Q1 the mode bar then appears in the Shadowing header with
Shadowing · Summary. Summary's header: Back to Lesson, title, eyebrow SUMMARY, `ModeNav`, lesson bookmark, overflow.

### 7.2 Layout

Desktop reference viewport `1280×529`; two columns (main + ~300px rail) from the design system's existing `lg`
breakpoint; one column below it. **One DOM** ordered hero → reflection → words → expressions → grammar →
culture / review → status → saved → next, placed with CSS grid areas — never a desktop rail and a mobile copy hidden
by CSS. Sidebar hidden by default (the `(focus)` chrome). The page scrolls (a document, not a workspace).

| Block | Behaviour |
|---|---|
| Hero | Lesson thumbnail under a dark overlay. Eyebrow **LESSON COMPLETE** only when `user_video_progress.completed_at` is set, else **LESSON SUMMARY**. Meta: JLPT · sentences · duration (a missing part is dropped). `Replay Lesson` → Shadowing at the first line (`?line=<first>`), never resets or deletes progress. `Return to Shadowing` → the learner's resume position; with no resume state, the first line. Both hrefs are computed by `SummaryNavigation`, not guessed in the component. |
| Words | Grid of cards: word, reading, meaning, Common tag, POS, source sentence, `Hear in lesson`, save bookmark. |
| Natural Japanese | Expression, commonness, Meaning & use, Native nuance, Save. |
| Grammar | Pattern, JLPT, short meaning, explanation, From lesson, Try it (labelled practice). |
| Culture / Review | Two columns. Each review target: reason, line, `Review Again` → `/shadowing/[id]?line=<lineId>`. |
| Rail | Reflection card, Lesson Status, Saved Knowledge, Where to go next (`Start Next Lesson`; hidden when null). |

### 7.3 Clip player

One floating mini player (dock, bottom right) for the page, opened by the first `Hear in lesson`. YouTube requires a
visible player; `controls=0` is not used (it breaks unmuted API playback). It seeks to the line's `start`, stops at
`end`. Contract: no auto-focus on open; Close has an accessible name; play / pause state is announced; closing
returns focus to the control that opened it; route change stops and tears it down; on narrow viewports it does not
cover primary content or CTAs.

### 7.4 Data flow and states

The server component loads `LessonSnapshot`, `SummaryNavigation` and the analysis if ready (`readReady`, no writes).
Props to the client island are JSON-safe only — strings, numbers, booleans, plain objects; timestamps as ISO
strings; never a function, `Date`, `BigInt` or class instance (lesson: RSC client props). The island POSTs when the
analysis is missing, polls per `Retry-After` with **one** poll chain, aborts on unmount / navigation and leaves no
timer or request behind; then the same for the reflection.

| | Lesson analysis blocks | Reflection card |
|---|---|---|
| generating | skeleton, `aria-busy`, height reserved | skeleton |
| ready | content | AI text, eyebrow AI KORUME |
| retryable error | in-block message; Retry enabled after `retry_after` | fallback |
| unavailable (kill-switch, fuse, cap) | "Not available right now", **no Retry** | fallback |
| empty pool / empty block | real empty state ("Nothing stood out in this lesson") | — |
| no transcript | "Needs a transcript", no request | fallback |
| no evidence | — | fallback invitation, no AI call |

Deterministic blocks never show a skeleton. One page-level `aria-live="polite"` region announces the analysis
becoming ready, once.

### 7.5 Accessibility and i18n

`h1` = lesson title, `h2` per block; tab order = visual order; Japanese text carries `lang="ja"`; controls have full
names ("Save 注文"); Review Tomorrow's result goes through `aria-live`; `prefers-reduced-motion` disables shimmer.
All chrome and fallback templates in the vi / en catalogs; AI content locale = UI locale; Japanese is never
translated in place.

### 7.6 Frame deviations

| Frame | Built | Why |
|---|---|---|
| App sidebar shown | hidden by default | `(focus)` chrome contract |
| `194 / 194`, Study Environment, fullscreen | absent | they control the player workspace; Summary has none |
| "Daily" word tag | Common (from `dict_entries.common`) | no data source for "Daily" (R6) |
| "Native pronunciation" | "Hear in lesson" | native speaker not guaranteed |
| Natural Japanese has no save control | Save added | `expression` needs a producer (§6.3) |
| "Memory growth +8%" | Retention, "N remembered" / Not enough data | no review-event history (R9) |
| Hero always "LESSON COMPLETE" | depends on `completed_at` | no fabricated completion |

## 8. Testing and gates

Mutation discipline applies strictly to the new high-risk invariants — lease ownership, grounding, the retention
boundary, uniqueness, RLS, AI isolation — each RED without its fix; not to presentation detail.

**Unit (vitest).**
- Status: `not_started` vs `scored(0)`; Listening reads `dictation_attempts`; Retention `not_enough_data` before
  any review; `MASTERY_THRESHOLD` imported (mutating the constant turns a test red).
- Saved Knowledge counts by `source_kind`; `sentence` excluded there, included in Status › Retention.
- Review targets: one per line, `focusSpan` priority, no target without a real line.
- Analysis: canonical input hash stable, and changes with transcript or candidates; short ids never stored; every
  §4.4 drop rule; empty pool → ready + empty, non-empty pool + all invalid → `validation_error`; minimum =
  `min(required, pool)`; a strict-schema item with an extra `reading` / `jlpt` is dropped; hydration reads the DB;
  the Gemini schema pin (no nested `maxItems`).
- Reflection: the `@ts-expect-error` boundary; `ReflectionEvidence` carries no number; highlight validation; digit
  rejection; all four fallback paths (no evidence, analysis unusable, cap, validation failure); the eyebrow.
- Import boundaries: Summary never imports companion data or workspace context / player / drawer.

**SQL gate (`verify:db:summary`, fresh reset).**
- `lesson_reflections` RLS: owner reads, another user reads 0 rows, anon nothing, `authenticated` cannot write;
  functions have pinned `search_path` and no EXECUTE for `public, anon, authenticated`.
- Account erase removes the user's reflections.
- Uniqueness: saving the same word twice → one row; Review Tomorrow twice → one card per line; `least(...)` pulls a
  later due date in and leaves an earlier one.
- Lease and recovery, **for both `lesson_analysis` and `lesson_reflections`**: two parallel claims → one leader, one
  reservation, one `ai_generations` row, the follower reserves nothing; a leader that dies after claiming → the
  lease expires → the next request claims; a stale `lease_token` cannot complete or release the new leader's entry;
  two workers taking over the same expired lease do not deadlock.

**Timezone.** Review Tomorrow with a frozen clock just before midnight in at least two learner timezones: the due
time is the learner's next local midnight converted to UTC, never `now + 24h`.

**E2E (Playwright, seeded).**
- `AI_PROVIDER=none`: deterministic blocks render; unstarted rows read "Not started"; analysis blocks read "Not
  available right now" with no Retry; the reflection shows the fallback with eyebrow KORUME.
- A seeded ready `knowledge_entries` row → the ready path renders hydrated content.
- Poll path, with a deterministic test provider or route fixture returning `202, 202, 200`: one poll chain,
  `Retry-After` respected, the live region announces once, navigating away aborts, no request or timer survives.
- Save: double click → +1; persists across reload. Review Tomorrow → `Scheduled for tomorrow ✓`, persists across
  reload, the cards are not due today.
- The mode bar appears in the Shadowing header; `Review Again` lands on its line; Shadowing keyboard / drawer /
  player behaviour unchanged after the header extraction.
- Clip player: focus returns to the opener on close; a route change stops playback.
- Layout measured by geometry, not presence: two columns at 1280×529; one column in DOM order at 390 wide.

**Live smoke (`SUMMARY_LIVE=1`, Gemini free tier, pre-approved).** Ep.729, vi and en, run twice: every item
grounded; the reflection generated; the second open is a cache hit (no new `ai_generations` row). A second user on
the same lesson + locale: the analysis is a cache hit with no new generation, the reflection is generated separately
for that user. Culture notes read by hand against §4.3's boundary.

**Final gates.** tsc, lint, `verify:protocol`, full vitest (`--maxWorkers=2`), every `verify:db:*` touched on a
fresh reset, e2e on a clean worktree build, the high-risk mutations above, whole-branch review, the owner's Chrome
look at 1280×529, merge by the owner.

## 9. Execution

Branch `summary-analysis`, worktree `.worktrees/summary-analysis`. Codex implements from task packets via Paseo;
Claude reviews and commits each task (Codex's sandbox cannot commit and never runs Docker, Supabase or Playwright);
tasks run back to back. `npx supabase db reset` is needed for the in-place migration edit and the new migration —
owner approval to be confirmed on this branch. A reset wipes the local dictionary and the Ep.729 demo lesson:
re-import with the 1b worktree's `.tmp/import.sh` and `scripts/seed-real-lesson.ts` before any live or Chrome check.
