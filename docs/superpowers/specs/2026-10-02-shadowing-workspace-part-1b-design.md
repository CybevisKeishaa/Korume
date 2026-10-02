# Shadowing Workspace — Part 1b: the intelligence layer — Design

- Date: 2026-10-02
- Branch: `shadowing-workspace-1b` (worktree `.worktrees/shadowing-workspace-1b`, from master `13e9ab9`)
- Status: brainstormed with the owner, sections 1–5 approved in conversation with corrections (all folded in
  below); this file awaits the owner's review of the written text before `writing-plans`.
- Route: `/[locale]/shadowing/[id]` (Shadowing Learning Mode) plus `/[locale]/kanji/[id]`. Web/desktop only.
- Parent: `2026-10-01-shadowing-workspace-part-1a-design.md` (Part 1a, merged `9f032ca`). Everything 1a ruled
  still holds unless this file says otherwise.

## 0. Goal and success

Give the Shadowing workspace its intelligence layer, on real data: while shadowing Ep.729 the learner can
select a word and see what it means (Japanese–English dictionary, Vietnamese gloss, kanji with stroke
order), select a phrase and have it analysed, press ✨ for an AI explanation of the sentence across nine
sections, see the sentence's vocabulary and grammar, review what they mined from this lesson, and keep notes
— without the transcript losing width and without AI spending money the learner did not ask for.

Part 1b also builds the **Knowledge Economy core** that `docs/product/business-model.md` §4 assigned to
Layer 8: a shared, versioned knowledge cache with single-flight generation, per-learner entitlement
(Free sentences / Plus credits), cost accounting per provider call, and a hard global daily USD budget.
PayOS, purchase surfaces and pricing pages remain Layer 8.

## 1. Sources and how they rank

- `docs/design/screens/screen-shadowing-practice.md` (§ Analysis, § Utility Drawer, § Sentence Actions) and
  `docs/design/screens/workspace-patterns.md` (Pattern 03 Bottom Utility Drawer, Pattern 04 Inspector) decide
  the product model.
- `docs/product/business-model.md` §2–§5 decides the AI cascade, Free/Plus access, Knowledge Economy and cost
  defence.
- Figma `28:2041` "Kanji inspect" decides the composition of kanji detail; its mock values do not count (it
  shows 14 strokes and "Total Strokes: 11" for 緑 — dictionary data wins).
- The repo decides source of truth and architecture.

## 2. Decisions (owner rulings, 2026-10-02)

| # | Decision |
|---|---|
| R1 | **Build the Knowledge core in 1b.** Shared knowledge cache, single-flight, entitlement, cost ledger, global kill-switch. Payment stays Layer 8. |
| R2 | **Dictionary = JMdict + KANJIDIC2 + KanjiVG** (EDRDG / KanjiVG), imported into Postgres as versioned reference data. Vietnamese word glosses: `vocab` table first, else AI-generated once and cached. |
| R3 | **Utility Drawer has five tabs:** Vocabulary · Grammar · Mining · Notes · AI. Settings and Playback are not duplicated in the drawer (they live in ⚙ and the player). |
| R4 | **Nine AI sections:** `lite`, `grammar_breakdown`, `culture_notes`, `common_mistakes`, `alternative_expressions`, `native_nuance`, `more_examples`, `quiz`, `conversation`. Plus `phrase_analysis` (Analyze on a selection) and `word_gloss_vi` (system-funded). |
| R5 | **Notes** per sentence and per lesson. |
| R6 | **Drawer target follows the current sentence and can be pinned.** Opening from a specific sentence pins it; "Follow current sentence" unpins. Video never auto-pauses. |
| R7 | **Entitlement is separate from cost.** Free: 3 new sentences/day. Plus: configurable monthly AI-credit budget + a 200 new-section-generations/day anti-abuse fuse. Every provider call records tokens and estimated USD. The global kill-switch is a hard USD/day budget. Raw tokens are never shown to learners. |
| R8 | **Charge only for a successful, cache-missing, leader generation.** Failures, validation errors, kill-switch refusals, cache hits and coalesced concurrent requests never consume learner entitlement. |
| R9 | **Kanji: `KanjiQuickInspect` in the Vocabulary tab only.** The full `28:2041` port is a later project. A shared `KanjiDataService` and a data-driven `StrokeOrder` are built now so that port reuses them. Canonical kanji URL is the literal (`/kanji/緑`). |
| R10 | **Conversation section = a generated 4–6 turn sample dialogue** with per-turn TTS. It never opens or modifies Conversation Partner. |
| R11 | **Playback never initiates AI generation.** Only an explicit learner action does. |

## 3. Deviation register

| Documentation / Figma says | Part 1b ships | Why | Revisit when |
|---|---|---|---|
| Drawer tabs include Settings (and Playback in Pattern 03) | five tabs, no Settings/Playback | already in ⚙ and the player; two places to change one thing (R3) | — |
| Selection popover "Play (replay just that span)" | **Play sentence** | transcripts carry no word-level timing | word timing exists |
| Bookmark from the selection popover | **Bookmark sentence** | there is no phrase bookmark; `sentence_marks` is per line | — |
| Sentence action "Toggle furigana" changes the global setting | unchanged from 1a (session per-line override) | 1a §7.8 superseded the doc | — |
| Sentence action "Practice this sentence" | absent | needs Pronunciation (Part 2) | Part 2 |
| Kanji inspect `28:2041` full surface | `KanjiQuickInspect` + basic `/kanji/[literal]` page | R9 | full kanji inspect project |
| Conversation cascade section "Conversation practice" | sample dialogue, no partner session | Conversation Partner accepts only a fixed scenario enum (R10) | Conversation supports sentence-seeded scenarios |
| Locked-section CTA "Unlock with Plus" | explanatory text, no button | no purchase/upgrade route exists; a dead control is forbidden | Layer 8 purchase surface |
| Drawer state "Fullscreen" | labelled Fullscreen; internal state `maximized` | avoids confusion with the Fullscreen API states of 1a | — |
| Quiz results feed learning state | session-only | SRS/progress integration is its own ruling | later ruling |

## 4. Data

All new tables live in new migration files. Every new function is `revoke … from public, anon` and granted
explicitly; every new table revokes the default write grants from `authenticated` where writes are
service-role only.

### 4.1 Dictionary reference data (versioned snapshots)

```text
dict_imports      id, source (jmdict|kanjidic2|kanjivg), source_version, source_url, license,
                  file_sha256, entry_count, imported_at
dict_snapshots    id, jmdict_import_id, kanjidic_import_id, kanjivg_import_id,
                  status (staging|active|retired), created_at, activated_at
dict_entries        PK (snapshot_id, ent_seq)  kanji_forms text[], kana_forms text[], senses jsonb,
                                               common bool, jlpt
dict_kanji          PK (snapshot_id, literal)  on text[], kun text[], meanings_en text[], stroke_count,
                                               grade, freq, jlpt_old
dict_kanji_strokes  PK (snapshot_id, literal)  paths jsonb (ordered stroke geometry only),
                                               components jsonb (KanjiVG element grouping, raw primitives)
dict_kanji_words    PK (snapshot_id, literal, ent_seq)  rank (common first)
```

- A unique partial index enforces **at most one** `active` snapshot. The activation / rollback transaction
  guarantees the system finishes with **exactly one** active snapshot, and a failed staging import never
  deactivates the current one. Activation flips the pointer in one transaction; the app never sees JMdict
  from one snapshot with KanjiVG from another.
- The previous snapshot is **kept** (`retired`) for rollback. Retired snapshots are removed only by an
  explicit GC command.
- Indexes: GIN on `kanji_forms` and `kana_forms`; btree on the PKs.
- RLS: `authenticated` may SELECT; nobody but service role writes. `anon` gets nothing.
- `scripts/import-dictionaries.ts --jmdict <file> --kanjidic <file> --kanjivg <zip>`:
  stream-parses each source (it never holds the whole JMdict or KanjiVG representation in memory at once),
  stages a snapshot, validates counts and cross-references, then activates. Same file hashes as the active
  snapshot → no-op. Source files are not committed.
- **KanjiVG is sanitised on import:** only path geometry and element grouping are kept; any markup, script,
  event attribute or external reference is rejected, never rendered.
- The exact source URL, version and license text of each dictionary source are verified in T0 and persisted
  in `dict_imports`. UI attribution — in the footer of the word card, `KanjiQuickInspect` and the
  `/kanji/[literal]` page — is rendered from that metadata and is never hard-coded. Docs get the exact license
  wording after T0.

### 4.2 Knowledge cache

`knowledge_entries` — shared on the server, **service role only** for every direct statement (SELECT
included); `authenticated` and `anon` have no table access. Content may come from PRIVATE lessons or video
context, so learners read knowledge only through the authenticated API, after the content-access check and the
entitlement projection (§5.3). The ledger tables (§4.3) follow the same rule.

Cache identity (**7 dimensions**): `fingerprint, section, locale, context_key, schema_version,
generator_version, content_variant`.

- `fingerprint` = sha256 of the canonical text. Canonicalisation is conservative: NFKC → normalise line
  endings → trim → collapse accidental repeated whitespace. Lexical text and **all punctuation are
  preserved** (`？`, `！`, `…` change tone). Particles are never touched.
- `context_key` = `''` for context-free sections; the `video_id` for `culture_notes` and `native_nuance`;
  the parent sentence's fingerprint for `phrase_analysis`.
- `content_variant` = `full | preview` (§5.4).
- `word_gloss_vi` entries are keyed by JMdict identity instead: `(ent_seq, sense identity, jmdict import
  version)` + `generator_version`. A changed JMdict sense never keeps serving an old gloss.
- Columns besides the key: `status (pending|ready|failed)`, `lease_until`, `content jsonb`, `model`,
  `provider`, `source='ai_generated'`, `error_code`, `failed_at`, `retry_after`, `attempts`, timestamps.

### 4.3 Cost and entitlement ledger

- **`ai_generations`** — append-only, one row per provider call **including failures**:
  `requested_by_user_id` (nullable), `billing_scope (learner|system)`, `knowledge_entry_id`, `reservation_id`,
  `section`, `provider`, `model`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `latency_ms`,
  `estimated_cost_usd`, `outcome (success|provider_error|validation_error)`, `created_at`.
- **`ai_reservations`** — `id`, `requested_by_user_id`, `billing_scope (learner|system)`,
  `entitlement_kind (free_sentence|plus_section)` — **null when `billing_scope='system'`**, enforced by a CHECK —
  `fingerprint` (Free: the parent sentence), `reserved_credits`, `reserved_usd`,
  `status (held|settled|released)`, `expires_at`, `period_day`, `period_month`.
  - `learner` reserves learner entitlement **and** global budget.
  - `system` (`word_gloss_vi`) reserves global budget only; it never passes through Free/Plus accounting.
    `requested_by_user_id` is still recorded for attribution and per-user rate limiting.
- **`ai_usage_charges`** — the settled entitlement charge: `user_id`, `entitlement_kind`, `fingerprint`, `credits`,
  `generation_id`, `reservation_id`, `period_day`, `period_month`.
  - `UNIQUE (user_id, period_day, fingerprint) WHERE entitlement_kind = 'free_sentence'`
  - `UNIQUE (generation_id) WHERE entitlement_kind = 'plus_section'` — one settled charge per generation.
- **Global budget** — a per-day row (`period_day`, `reserved_usd`, `spent_usd`) updated under row lock.
- SQL functions (security definer, service role only): `knowledge_claim_lease`, `ai_reserve`,
  `ai_settle(reservation_id, generation_id, actual)`, `ai_release(reservation_id)`. Settle and release are
  **idempotent**: a second call changes nothing; release after settle is a no-op. An expired `held`
  reservation is released by the next reserve/claim, so a dead leader never locks quota permanently.
- Config (env, server-only): `AI_FREE_SENTENCES_PER_DAY=3`, `AI_PLUS_CREDITS_PER_MONTH`,
  `AI_PLUS_MAX_SECTIONS_PER_DAY=200`, `AI_GLOBAL_BUDGET_USD_PER_DAY=5`, `AI_CREDIT_USD_UNIT`. Model prices
  live in `lib/knowledge/pricing.ts`. `credits = ceil(estimated_cost_usd / AI_CREDIT_USD_UNIT)`.
- Periods are **UTC** day and UTC calendar month. The UI says "resets in …", never "at your midnight". When
  Layer 8 brings subscription periods, the month function changes in one place.

### 4.4 Learner notes

- `sentence_notes` — PK `(user_id, transcript_line_id)`, `body text check (char_length(body) <= 4000)`,
  `updated_at`. Insert checked with `exists` on `transcript_lines` under the learner's RLS (as
  `sentence_marks`).
- `lesson_notes` — PK `(user_id, video_id)`, `body check (char_length(body) <= 20000)`, `updated_at`. Insert
  and upsert `with check (user_id = auth.uid() and exists (select 1 from videos where id = video_id))`; the
  `exists` runs under the learner's RLS, so a note cannot be created on a PRIVATE lesson by UUID. The API
  returns a generic 404 for a video the learner cannot read.
- Own-row RLS; cascades on user, line and video deletion; included in `lib/data/user-export.ts` and the
  account-deletion path.

### 4.5 Unchanged

`vocab`, `grammar_points`, `sentence_mining_cards`, `video_summaries`, the conversation subsystem.

## 5. Services and API

### 5.1 Deterministic line analysis (no AI)

`GET /api/lines/[lineId]/analysis` — the line is read under the learner's RLS; a line they cannot read is a
generic 404.

- **`StaticLineAnalysis`**: tokens (surface, base, reading, POS, span), JMdict matches per token, grammar
  matches (`grammar_points.structure_pattern` over kuromoji tokens) with spans. Cached in process by
  `(lineId, dictSnapshotId, grammarRevision)` (short TTL while `grammar_points` has no revision column).
- **`UserLearningState`** (`vocabId`, mastery/SRS state) is joined **per request** and never cached.
- **Spans are UTF-16 code-unit offsets into `transcript_lines.text_jp`.** The server validates every span
  and snaps it to token boundaries; it never trusts a client span.

`GET /api/videos/[id]/vocabulary?cursor=&limit=` — whole-lesson content words aggregated **on the server**
(entry, occurrence count, JLPT, mastery, a few example line ids), paginated, read in pages so no
`max_rows = 1000` truncation is possible. Occurrences of one word are fetched when that word is opened.

### 5.2 Dictionary

- `KanjiDataService` (server): dictionary identity, readings, meanings, stroke/frequency/grade, stroke
  geometry, common words, composition primitives — all from the active snapshot, plus the hand-written
  `kanji` table's Vietnamese meaning and mnemonic when that kanji exists there.
- `GET /api/dictionary/kanji/[literal]` — serves QuickInspect.
- `GET /api/dictionary/gloss?entryId=` — Vietnamese gloss from `vocab` or the cache, else `missing`. No side
  effect.
- `POST /api/dictionary/gloss { entryId }` — requests a system-funded `word_gloss_vi` generation
  (`billing_scope='system'`, `requested_by_user_id` recorded). Rate-limited per user. Never counts against
  learner entitlement; always subject to the global budget.

### 5.3 Knowledge sections

`POST /api/knowledge/sections { transcriptLineId, section, locale, span? }`

- **The client never sends text, tier, variant or credits.** The server reads the line under RLS, derives the
  tier from subscription state (`getActivePlanTier`), and chooses the variant.
- `span` (UTF-16, validated, snapped) selects `phrase_analysis`; Free entitlement for a phrase is charged
  against its **parent sentence**.
- Model tier `fast`, `reasoning: false`; output language = UI locale (vi/en).
- **Section registry** — one module, every section declared once:

  ```text
  section · schema · previewSchema · prompt / generator_version · cache context policy
  · access policy (Free full | Free preview) · max output tokens (full, preview)
  ```

  Routes, orchestration and UI read the registry; nothing switches on section names elsewhere.

**Flow:**

1. auth → zod → rate limit → read the line (404 if refused).
2. Resolve variant (§5.4) and key. `ready` → project for this learner → `200`. No charge.
3. Miss → `knowledge_claim_lease` (insert-on-conflict, or CAS takeover of an expired lease:
   `update … where status='pending' and lease_until < now() returning`). Not leader → `202 {status:'pending',
   retryAfterMs}` + `Retry-After`; the client polls. `failed` with `retry_after` in the future → `503`.
4. Leader → `ai_reserve()` → `reservation_id` (Free sentence slot / Plus section fuse + upper-bound credits /
   global upper-bound USD, one transaction). Refused → release the lease; `402 quota_exhausted {resetsAt}`
   or `503 ai_unavailable`.
5. Provider call through the AI port → `ai_generations` row → schema validation.
6. Success → one transaction: entry `ready` + `ai_settle(reservation_id, generation_id, actual)`; unused
   upper-bound credits/USD are returned. Provider error → `ai_release`, entry `failed` with backoff
   30 s → 2 min → 10 min. **Validation error** → the generation keeps its real cost and the global budget
   settles that real USD (the money was spent), but the learner reservation is **released**.
7. Kill-switch or provider outage never hides cached content: reads of `ready` entries keep working.

`GET /api/knowledge/usage` → Free `{used, limit, resetsAt}`; Plus `{remainingPercent, resetsAt}`.

### 5.4 Preview and full variants

| Situation | Behaviour |
|---|---|
| Free, `lite` / `grammar_breakdown` | `full` variant, full access |
| Free, locked section, `full` already cached | deterministic preview **projection** of the full content, done on the server |
| Free, locked section, nothing cached | generate and cache the **`preview` variant** only (preview schema, low max output); counts toward that sentence's daily slot |
| Plus | `full` variant; preview derived locally if ever needed |

Free never receives a full payload over the network. Quiz previews carry no answers. Conversation previews
carry the context and at most two opening turns.

### 5.5 Notes

`PUT`/`DELETE /api/sentence-notes`, `PUT`/`DELETE /api/videos/[id]/notes` — idempotent, zod-validated,
rate-limited. Client autosave: debounce 800 ms + blur; **per note key at most one request in flight**; a
newer body replaces any queued older body and is sent after the current request settles. Multi-tab is
last-write-wins in 1b.

### 5.6 Untrusted input and output

Transcript text is untrusted data. It is delimited as data, never inserted as instructions; the model gets
no tools or secrets; outputs must satisfy section-specific structured schemas. Cache keys scope generated
content to the exact canonical input and context. These measures reduce prompt-injection and cache-poisoning
risk but are not treated as a proof that model output cannot be manipulated. The UI renders only structured
fields as escaped text — never raw model HTML or Markdown-to-HTML. Every AI block carries an "AI-generated"
label. Improving a prompt bumps `generator_version`, which retires the old cache by key.

## 6. UI

### 6.1 Utility Drawer

- A band at the bottom of the workspace spanning both columns. Opening it makes the columns **shorter, never
  narrower**; the 1a height budget shrinks the video. The player never remounts.
- Internal states `collapsed | peek | expanded | maximized` (labelled Fullscreen in the UI):

  | State | Height | Shows |
  |---|---|---|
  | collapsed | 36 px | the five tabs + target label |
  | peek | ≈ 40 % of the workspace, min 160 px | compact tab content |
  | expanded | ≈ 70 % | full |
  | maximized | the whole area below the header | full; video keeps playing behind |

- Resize handle: `role="separator"`, `aria-orientation="horizontal"`, `aria-valuemin/now/max`; Arrow Up/Down
  step a level; Home/End → collapsed/maximized; mouse drag snaps to the four levels; visible focus ring.
- Selecting a tab while collapsed opens peek. State and height are session-only.
- **Escape priority** (one press, one thing): popover → drawer (to collapsed) → fullscreen → Focus / Full
  Transcript.
- Focus Mode **hides** the drawer without resetting target, tab or height; leaving Focus restores them; a
  pending AI request may still complete. Full Transcript and workspace fullscreen contain the drawer; player
  fullscreen does not.
- Reduce Motion: no transitions.

### 6.2 Target model

```text
currentSentence   from playback (1a CurrentSentenceContext)
drawerTarget      the sentence (and optional span) the drawer is about
drawerTracking    follow | pinned
```

- `follow`: Vocabulary, Grammar and Notes passively show the current sentence (a gap keeps the sentence just
  spoken).
- `pinned`: **all five tabs** speak about `drawerTarget`; notes save to it; actions use it; playback moving on
  never changes it. The header shows `Sentence 42 / 282 · 📌` and **Follow current sentence**.
- Entry points pin: ✨ on Live Sentence (→ AI), the new transcript row actions **Vocabulary · Grammar ·
  ✨ AI · Note** (→ that tab), and every popover action that opens the drawer. A collapsed drawer opens to
  peek.
- **Playback and `follow` never initiate an AI generation** (R11). Generation starts only on ✨, Analyze,
  "AI Grammar Breakdown", or the learner opening an AI section. A request's target is fixed when it starts.
- Rows with a note show a tiny note indicator alongside the 1a bookmark/difficult indicators.

### 6.3 Selection popover

- Surfaces: Live Sentence, transcript rows, Full Transcript rows.
- Opens on a text selection inside **one** sentence; a selection crossing a line boundary opens nothing. On
  Live Sentence a plain click on a word also opens it; on transcript rows a click still seeks (1a), so only a
  selection opens it.
- The client maps the selection to UTF-16 offsets through data attributes on base text; `<rt>` is excluded
  (`user-select: none`). The server validates and snaps (§5.1).
- **One token → word card:** headword, reading, POS, 1–3 English senses, Vietnamese gloss (requested by POST
  only when this card opens and none exists; one request per card, pending deduplicated). Each kanji in the
  headword is a button → QuickInspect in the Vocabulary tab.
- **Several tokens → phrase card:** the text and **✨ Analyze** → AI tab, `phrase_analysis`.
- Both: **Play sentence** · **Bookmark sentence** · **Add to Mining** (`targetWord` = the selection; disabled
  with a visible reason above 50 characters, the existing API's limit).
- Non-modal dialog, no focus trap; closing returns focus to the text container or trigger. A popover on
  Live Sentence keeps its original selection's content after the sentence advances.
- Keyboard path: the Vocabulary tab lists every token as a button leading to the same word card.

### 6.4 Tabs

- **Vocabulary:** tokens of the target (reading, short gloss — existing data + English fallback, never bulk
  AI — mastery badge) → word card → kanji → QuickInspect, with ← back. A **Whole lesson** switch shows the
  paginated lesson vocabulary (§5.1); opening a word lists its sentences; a sentence seeks.
- **Grammar:** deterministic matches with structure, explanation, examples and a link to the grammar page;
  an "AI Grammar Breakdown →" shortcut to the AI tab; an empty state when nothing matches.
- **Mining:** cards mined from this lesson by time; the target's cards highlighted; a card seeks.
- **Notes:** the target's note, the lesson note, then every note in the lesson (a note seeks). Save status:
  Saved / Saving / Failed — retry.
- **AI:** usage line (Free `1/3 sentences today · resets in 5 h`; Plus a remaining-% bar), then `lite`
  (generated on the explicit action that opened the tab), then the other eight sections as a lazy accordion.
  Locked sections show 🔒 + preview + explanatory Plus text (no button). A `phrase_analysis` block heads the
  tab when present. States: skeleton, generating (live region announces completion), 402 with reset time, 503
  "AI is resting" with cached content still shown, error with retry. Quiz: 3–5 multiple-choice questions,
  graded on the client, session-only. Conversation: 4–6 turn dialogue (context, two roles, Japanese,
  reading, translation) with per-turn TTS.

### 6.5 KanjiQuickInspect and the kanji page

- Large glyph, TTS for On/Kun (existing `POST /api/speech/tts`), English meanings (+ Vietnamese meaning and a
  short mnemonic when the hand-written `kanji` table has the character), stroke count · frequency · grade ·
  JLPT, `StrokeOrder` from snapshot geometry with Replay, up to five common words (existing data only; a word
  opens its word card), **View full details** → `/kanji/緑`, attribution footer.
- `StrokeOrder` takes geometry as data; its public API stays so the current `/kanji/[id]` keeps working;
  `lib/kanji-strokes.ts` stops being the source.
- `/kanji/[id]`: the canonical id is the literal. A legacy UUID resolves and redirects to the literal URL. A
  kanji not in the hand-written table renders a basic page from `KanjiDataService`, so no "View full details"
  link is ever dead.

### 6.6 Cross-cutting

Every string in the vi/en catalogs. Drawer `role="region"`; tabs a `tablist` with arrow-key navigation.
Colours follow the reading colour preset × atmosphere tokens of 1a. All server→client data is plain
serializable DTOs.

## 7. Testing and acceptance

| Layer | Covers | Runs |
|---|---|---|
| Unit (vitest) | canonicalisation (`？/！/…` kept, は≠が, NFKC, whitespace) · 7-dimension cache key · UTF-16 spans + snapping incl. `𠮷` and ruby-adjacent selections · preview projection (never contains full-only content; quiz preview has no answers; conversation preview ≤ 2 turns) · credit and upper-bound estimation · failure backoff · drawer state machine, separator keys, Escape chain · target model (`follow`/`pinned`) · **10 sentence changes while following → zero generations, zero provider calls, zero reservations** · autosave serialisation · grammar matcher · `assertPlainSerializableDto()` on every data façade output (rejects functions, class instances, `Map`, `Set`, `BigInt`) | CI |
| Component (RTL) | drawer + separator (Up/Down/Home/End) · tablist keyboard · five tabs in every state · word/phrase cards and their action names · Mining disabled > 50 chars · QuickInspect · usage line · popover focus return, no focus trap · no dead control | CI |
| Integration (deterministic) | **N concurrent requests on one cache miss → the fake provider is called exactly once** · Free never receives a full payload over the network, even when `full` is cached; request fields cannot raise tier or variant · PRIVATE line of another user → generic 404 on `/analysis` and `/knowledge/sections` · span on another line / bad offsets → rejected · `vi` and `en` never share a cache entry | CI |
| SQL gate `verify:db:knowledge` | **N independent connections released by a barrier:** exactly one lease leader; CAS takeover of an expired lease; a Plus user's parallel reserves never overshoot fuse or credits; the global hard budget never overshoots · lifecycle: provider error → release restores capacity; validation error → cost recorded, learner reservation released; expired held reservation does not lock quota; settle below upper bound refunds the difference; repeated settle/release changes nothing; one charge per generation · Free: nine sections of one sentence = one slot; the fourth sentence refused · `authenticated`/`anon` cannot EXECUTE the functions and cannot SELECT or write `knowledge_entries` or any ledger table · a `system` reservation consumes global budget only, never Free/Plus entitlement, and a `learner` reservation with a null `entitlement_kind` is rejected · notes own-row RLS; a sentence note on another user's PRIVATE line and a lesson note on another user's PRIVATE video are both refused; cascades; length CHECKs | local DB |
| SQL gate `verify:db:dictionary` | install A, install B, activate B → reads see only B; a staging import that fails validation or activation leaves A active (never zero active); roll back to A; GC deletes only retired; read-only for `authenticated`, nothing for `anon` | local DB |
| Real import | each source's `entry_count` equals the count parsed from that file and passes a sanity lower bound; `緑` = 14 strokes and 14 geometry paths; `苦手` has senses; no stored geometry contains markup, script, `on*` or external refs; a second run with the same files is a no-op. Records source, version, hash, counts, duration, peak memory when measurable | local, in T2 |
| > 1000 rows | line analysis and lesson vocabulary on a transcript longer than 1000 lines are complete | CI / local DB |
| Playwright deterministic | 1a's fake `YT.Player` + the existing `fake` AI provider: select → popover → QuickInspect · ✨ → pinned → AI tab → Lite · play 10 sentences with the AI tab open → no generation · Free fourth sentence → 402 · kill-switch → 503 with cached content visible · note survives reload · separator drag/keys, Escape order, Focus hides and restores · follow vs pinned · **the player does not remount** on any drawer change | CI |
| Contrast | the 1a contrast harness extended to drawer and popover surfaces over all 4 presets × 7 atmospheres | CI |
| Live Ep.729 | the 1a live gate still green | local, before merge |
| Live AI (owner approval first — real money) | Plus fixture, dedicated test sentence / cleared fixture keys, `testStartedAt` recorded; for each of the nine sections assert a **new** `ai_generations` row (`created_at >= testStartedAt`, matching `knowledge_entry_id`, `provider='anthropic'`, `outcome='success'`, tokens and cost > 0). Real tokens and cost recorded in the run state | local, before merge |
| Chrome | 1280×529 in vi and en: collapsed bar does not overflow, peek leaves the Japanese line of Live Sentence visible, geometry, wrapping, hierarchy; then the owner's look | before merge |

**Discipline:** every fix ships with one mutation proving its test catches the defect; the unit gate runs
after the last edit; vitest `--minWorkers=1 --maxWorkers=2`, never alongside Codex; build and serve only in
the worktree; an independent review per task.

**Merge gates:** `tsc`, `lint`, `vitest`, `verify:protocol`, every `verify:db:*` on a fresh reset, the
deterministic e2e plus the existing shadowing specs, live Ep.729, live AI, an independent whole-branch
review after those gates, the owner's Chrome look and merge decision.

## 8. Tasks and order

| # | Task | Owner | Depends on |
|---|---|---|---|
| T0 | Probe (throwaway): KanjiVG archive choice and format · JMdict source/version/license · current Haiku pricing · user-export / account-deletion seams · selection mapping over ruby in Chrome | Claude | — |
| T1 | Dictionary migrations + `verify:db:dictionary` | Codex | — |
| T2 | Streaming importer, KanjiVG sanitiser, kanji→words, snapshot activation, GC command, parser tests. **Done only when Claude's real import passes** (§7) | Codex + Claude | T0, T1 |
| T3 | `KanjiDataService`, data-driven `StrokeOrder`, `/kanji/[literal]` + UUID redirect + dictionary fallback page, `GET /api/dictionary/kanji/[literal]` | Codex | T2 |
| T4 | Knowledge + ledger migrations and SQL functions | Codex | — |
| T4b | `verify:db:knowledge` multi-connection barrier harness, full reservation lifecycle | Claude | T4 |
| T5 | Notes migrations, RLS, API, export, account deletion | Codex | — |
| T6 | Knowledge pure logic: canonicalisation, keys, pricing/credits, preview projection, backoff, server-side entitlement, env config | Codex | T0 |
| T7 | Orchestration: single-flight + reserve → provider → settle/release over the AI port; N-miss → one provider call | Codex | **T4b**, T6 |
| T8a | Section registry + framework + `lite`, `grammar_breakdown`, `common_mistakes`, `more_examples`, `phrase_analysis`, `word_gloss_vi` + `/api/knowledge/sections` + `/api/knowledge/usage` + transport tests | Codex | T7 |
| T8b | `culture_notes`, `native_nuance` (video-context policy), `alternative_expressions`, `quiz`, `conversation` on the same registry | Codex | T8a |
| T9 | `StaticLineAnalysis` + grammar matcher + `UserLearningState` join, `/analysis`, paginated lesson vocabulary, gloss GET/POST, > 1000-row tests. **Publishes the analysis/drawer DTO contract first** | Codex | T2, T8a |
| T10 | Drawer shell: state machine, separator, target model, Escape chain, Focus hide, entry points, note indicator | Codex | T9's DTO contract |
| T11 | Selection popover | Codex | T9, T10 |
| T12 | Vocabulary tab + QuickInspect + whole-lesson list | Codex | T3, T9, T10 |
| T13 | Grammar + Mining + Notes tabs | Codex | T5, T9, T10 |
| T14 | AI tab, incl. Quiz, Conversation dialogue, `phrase_analysis` block, zero-generation invariant | Codex | T8b, T10 |
| T15 | Deterministic e2e, contrast extension, live Ep.729, live AI (asks first), Chrome measurement | Claude | T11–T14 |
| T16a | Docs: deviation register into `screen-shadowing-practice.md`, `domain-model.md` (Dictionary Snapshot, Knowledge Entry, AI Ledger, Notes), attribution, run state | Claude | may start early |
| T16b | **Independent whole-branch review after fresh-reset gates**, fixes, then 1b declared complete | Claude | T15 |

Parallelism: T1, T4, T5, T6 are independent; T0 runs beside them. After T10, T11–T14 touch separate files.
One Codex run at a time on this machine. Codex implements; Claude reviews each task before committing. If
Codex's quota runs out, Claude finishes the current packet without changing the architecture.

**Known risks:** JMdict parse memory (streaming is the acceptance, no fixed MB number before T0/T2 measure);
local DB grows ≈ 200 MB per snapshot, two snapshots kept; T8 may need the a/b split already planned.

## 9. Out of scope

The full Kanji inspect surface (SRS status, mnemonic coverage, corpus examples, lesson occurrences, writing
practice, similar kanji); Conversation Partner integration; quiz results in SRS; PayOS and any purchase
surface; per-account time zones; a translation-language selector; word-level audio timing; mobile layouts;
Parts 2–4.
