# Ask Korume — contextual chat in Shadowing + full Korume Chat — Design

- Date: 2026-10-03
- Branch: `ask-korume` (worktree `.worktrees/ask-korume`)
- Status: **locked.** Brainstormed with the owner 2026-10-03 in four sections; the written text reviewed by the
  owner, who added the single-persona ruling, the `/korume/chat` route and six technical corrections — all folded
  in below. Next: `writing-plans`. No further brainstorm unless implementation finds a genuinely new constraint.
- Figma: `215:15164` "Companion Knowledge Assistant" (visual reference for the chat only).
- Builds on: Knowledge core (`lib/knowledge/**`, migrations 038 + 040), AI port (`lib/ai/port.ts`), line analysis
  (`lib/analysis/**`), the conversation module (`conversation_sessions` / `conversation_messages`).

## 0. Rulings (binding — do not re-litigate)

- Ruling: `/companion` and Ask Korume are **not** the same surface. `/companion` is Korume's Memory home (Figma
  `156:1310`, `180:1770`, `184:3974`, …) and is **out of scope** for this branch. Ask Korume is the conversational
  assistant: same persona, separate surface. Do not route chat to `/companion`, do not turn `/companion` into chat.
- Ruling: **there is exactly one user-facing character / persona: Korume.** "Sensei" is not a product concept,
  persona, navigation label, heading, button, aria-label, i18n value or product-facing doc name. This supersedes
  `docs/product/capability-map.md` §3.1's `/sensei` route (the "one presence" half of §3.1 stands).
- Ruling: canonical structure —
  ```text
  Korume
  ├── Ask Korume
  │   ├── contextual overlay in Shadowing
  │   └── full chat page: /korume/chat
  └── Korume Memory
      └── /companion            (out of scope here)
  ```
  `/sensei` survives only as a **legacy redirect → `/korume/chat`** in `next.config.mjs` `redirects()` (the
  route-rename mechanism, guarded by `next.config.test.ts` and `tests/e2e/route-rename-redirects.spec.ts`); its
  page file is deleted, it renders nothing of its own.
- Ruling: Ask Korume is **one product with two viewports of the same conversation**: the Shadowing overlay and
  `/korume/chat`. "Expand" in the overlay opens `/korume/chat?thread=<id>` on **the same thread**.
- Ruling: a Figma frame name is not proof of route or persona. `215:15164` is the visual reference for Korume
  Chat only.
- Ruling: one thread/message model for both viewports, by **reusing `conversation_sessions` /
  `conversation_messages`** with a discriminated `kind`. No `korume_threads` table.
- Ruling: a thread **owns its anchor context**, captured when the learner opens Korume. Playback never moves it.
  Switching to the current sentence is an explicit action and creates a **new** thread.
- Ruling: Companion memory is **read-only** in this project. Chat never writes `companion_memories`. The pipeline
  "chat → decide what is worth remembering → write memory" is a separate project.
- Ruling: AI goes through the existing provider port. Gemini is today's provider and has its own live smoke; no
  product contract depends on Gemini.
- Ruling: **Ask Korume v1 = a two-stage retrieval planner + one final structured answer.** No native tool calling,
  no agent loop, no streaming, no AI port change. The Knowledge core is a server-side retrieval service for Korume;
  its sections never become a chat menu.
- Ruling: `knowledge_lookup` reads a **ready** cache entry only. Korume never triggers nested Knowledge generation
  on a cache miss (`knowledge_generate` is a later, separately budgeted decision).
- Ruling: `companion_enabled` gates the whole surface; the **server** is the authority.
- Ruling: no streaming and no fake typewriter. "Korume is thinking…" → the complete structured answer.
- Ruling: every turn carries one `turn_id` that is both the telemetry correlation id and the idempotency boundary.

## 1. Scope

In: the data migrations, the `korume_turn` entitlement, `companion_enabled`, the thread/turn API, the planner +
retrieval + answer pipeline, progress-aware exposure, the `AnswerV1` renderer, the Shadowing overlay, the
`/korume/chat` page, the `/sensei` legacy redirect, removing "Sensei" from every user-facing string (§6.5), tests, a
live smoke.

Out: `/companion` Memory home; writing memory from chat; streaming; native tool calling; `knowledge_generate`;
mic / voice conversation; correction mode; server-side TTS; a learner model or "teaching strategy" statements
(`215:15164`'s *"You're strongest when examples come first"* is **not** built — nothing models it, so it would be
fabricated).

## 2. Data model

One migration per DB-owning task, so a later packet never edits a migration an earlier one already had reviewed
(final numbers follow the repo's sequence at write time):

| Migration | Owner task | Contents |
|---|---|---|
| `…041_ask_korume_threads.sql` | Task 1 | §2.1, §2.2, the anchor-cleanup trigger, `ai_generations.turn_id`, `ai_record_generation` |
| `…042_ask_korume_entitlement.sql` | Task 2 | `korume_turn` CHECKs, `ai_reservations.turn_id` + its index, the `ai_reserve` branch (§3.2) |
| `…043_companion_enabled.sql` | Task 3 | §2.3 |

### 2.1 `conversation_sessions`

Add:

| Column | Type | Notes |
|---|---|---|
| `kind` | `text not null default 'scenario'` | `check (kind in ('scenario','ask_korume'))`; existing rows become `scenario` |
| `origin_video_id` | `uuid references videos(id) on delete set null` | cleared with its dependents, below |
| `origin_line_id` | `uuid references transcript_lines(id) on delete set null` | cleared with its dependents, below |
| `origin_span` | `jsonb` | `{start,end}` UTF-16 offsets into the line's `text_jp` |
| `origin_route` | `text` | server-generated only (§4.2) |
| `title` | `text` | nullable; set after the first successful turn |
| `updated_at` | `timestamptz not null default now()` | bumped on every message |

CHECKs, by `kind`:

- `kind = 'scenario'` → `scenario_type is not null` **and** every `origin_*` and `title` is null. Every existing
  row must satisfy this; the migration test proves it on seeded scenario rows.
- `kind = 'ask_korume'` → `scenario_type is null`. Anchor and title may be null (`/korume/chat` direct entry is free
  chat; the title arrives after turn one).
- `origin_span is null or origin_line_id is not null`.
- `origin_span` shape: exactly the keys `start`, `end`; both integers; `0 <= start < end`.
- `origin_line_id is null or origin_video_id is not null`.
- `origin_route is null or (origin_route like '/%' and origin_route not like '//%' and position(':' in origin_route) = 0)`
  — a basic relative-path guard only; the server is the authority (§4.2).

Index: `(user_id, kind, updated_at desc)` for the thread list.

Thread id: `id` stays `default gen_random_uuid()`, but an Ask Korume thread is inserted **with the client's
`draftThreadId`** (§4.1) — the primary key is the create-thread idempotency boundary.

**Source deletion keeps the chat and clears the anchor atomically.** A bare `on delete set null` would null one
column and then violate the CHECK chain (`origin_span → origin_line_id → origin_video_id`). So `before delete`
triggers on the sources clear dependents in the same statement, before the FK action runs:

- `transcript_lines` row deleted → `origin_line_id = null, origin_span = null` on threads that reference it.
- `videos` row deleted → `origin_video_id = null, origin_line_id = null, origin_span = null,
  origin_route = null`.

(Deleting a video cascades to its transcripts and lines; the line trigger and the video trigger must both leave
every CHECK satisfied, whichever fires first.) A migration test performs a real `DELETE` of a line and of a video
and asserts the thread and its messages survive with a cleared anchor.

### 2.2 `conversation_messages`

**`content` is not renamed.** It stays the plain-text canonical / fallback (export, search, the scenario module).
Add:

| Column | Type | Notes |
|---|---|---|
| `content_json` | `jsonb` | structured `AnswerV1` blocks (§6.1) |
| `content_schema_version` | `smallint` | |
| `grounding_json` | `jsonb` | the turn's `groundedEntities[]` (§5.5), persisted with the answer |
| `grounding_schema_version` | `smallint` | |
| `turn_id` | `uuid` | null for scenario rows |

CHECKs: `(content_json is null) = (content_schema_version is null)`;
`(grounding_json is null) = (grounding_schema_version is null)`; `role = 'user'` → `content_json is null and
grounding_json is null`. Unique: `(session_id, turn_id, role)` where `turn_id is not null`.

Reload and history never re-run retrieval: the rail and every `context_card.entityRef` resolve against the
persisted `grounding_json` of that assistant message (the rail unions a thread's messages).

### 2.3 `user_preferences.companion_enabled`

`boolean not null default true` (existing users keep Korume on). One row in Settings. Turning it off deletes
nothing: threads and memories stay.

### 2.4 Telemetry and reservations

- `ai_generations.turn_id uuid` (nullable; Knowledge rows leave it null). `ai_record_generation` reads
  `p_row->>'turnId'`. Ask Korume writes `section = 'korume_plan'` and `section = 'korume_answer'` rows, failures
  included. Cost of a question = `sum(estimated_cost_usd) where turn_id = …`.
- `ai_reservations.turn_id uuid`, with a **partial unique index on `turn_id` where `status in ('held','settled')`**:
  two concurrent requests for one turn can never both hold money; a released turn can be retried.
- `entitlement_kind` CHECKs on `ai_reservations` and `ai_usage_charges` add `'korume_turn'`.

### 2.5 Grants

Every new or replaced function: `revoke all … from public, anon`, then grant to the role that needs it
(memory `supabase-anon-execute-default`). `erase_companion_memory()` already deletes `conversation_sessions`, so
Ask Korume threads are erased with Korume Memory; a test pins it.

## 3. Entitlement and economics

### 3.1 Contract

- **Free:** 10 successful Ask Korume turns per UTC day — `AI_ASK_KORUME_FREE_TURNS_PER_DAY=10`.
- **Plus:** the **shared monthly AI-credit allowance** (the same pool as `plus_section`) plus an Ask Korume daily
  anti-abuse fuse — `AI_ASK_KORUME_PLUS_TURNS_PER_DAY=100`. Never "unlimited".
- **Both:** the hard global USD budget (`ai_budget_days`) still applies.
- A turn counts against the learner **only when the assistant answer is persisted**. Planner retry, provider
  error, validation error and a network retry of the same `turn_id` never consume an extra turn. Provider money
  actually spent is still recorded against the global budget.

Both env values join `knowledgeEnvSchema` / `KnowledgeConfig` (`askKorumeFreeTurnsPerDay`,
`askKorumePlusTurnsPerDay`).

### 3.2 `ai_reserve` — the `korume_turn` branch

`ai_reserve` already runs `ai_release_expired()` before it counts, so a dead `held` reservation from a crash cannot
eat a day's quota; a SQL test pins it (ten expired `held` rows → the eleventh still reserves).

- Free: count this user's `korume_turn` reservations of the UTC day in `held` or `settled`; `>= freeTurns` →
  `quota_exhausted` with `resets_at` = next UTC day.
- Plus: same count against `plusTurns` → `fuse_tripped`; then the monthly credit check sums **both**
  `plus_section` and `korume_turn` charges and held credits → `credits_exhausted` with `resets_at` = next month.
- The `plus_section` credit check is widened the same way, so the pool is genuinely shared in both directions.

### 3.3 Settlement semantics (unchanged functions, new caller)

- One reservation per turn: `reserved_usd = upperBound(plan) + upperBound(answer)` via `upperBoundCostUsd`.
- Success → one transaction: insert the assistant message, `ai_settle(reservation, answerGenerationId,
  credits, planUsd + answerUsd)`. `ai_settle` returns unused upper-bound USD to the budget and writes one
  `ai_usage_charges` row (credits for Plus, a slot for Free).
- Planner fails, answer succeeds → the turn **succeeds**; one turn is charged; the planner row records its error.
- Answer provider error or `AnswerV1` validation failure → `ai_release(reservation, planUsd + answerUsd)`: the
  money spent stays in global spend, the learner is not charged.
- Settle and release are idempotent (`status = 'held'` guard).

### 3.4 Timeouts and TTL

The port's `PROVIDER_TIMEOUT_MS` (60 s) applies to each provider call; this project does not change the port.

| Stage | Bound |
|---|---|
| planner | provider timeout (60 s) |
| retrieval, whole stage | 4 s; each tool 3 s |
| answer | provider timeout (60 s) |
| hard maximum turn lifetime | ≈ 125 s |
| reservation TTL | **180 s** |

Invariant: **reservation TTL > the hard maximum lifetime of a running turn**, so `ai_release_expired()` only
reclaims dead work and never creates a second leader for one `turn_id`. A unit test asserts
`TTL > 2 × PROVIDER_TIMEOUT_MS + RETRIEVAL_DEADLINE_MS`, so raising a timeout turns it red.

## 4. API

All routes: authenticate first. Then `companion_enabled` (after auth, so preference state never leaks to an
anonymous caller; before anything that can retrieve or spend). Then rate limit.

| Route | Purpose |
|---|---|
| `POST /api/korume/threads` | create a thread, idempotently. Body `{ threadId: uuid, videoId?, lineId?, span? }` |
| `GET /api/korume/threads` | the caller's `ask_korume` threads, `updated_at desc`, paginated |
| `GET /api/korume/threads/[id]` | one thread + its messages (with persisted grounding) + `pendingTurns` |
| `POST /api/korume/threads/[id]/turns` | one turn. Body `{ turnId: uuid, text: string ≤ 2000 }` |

A thread that does not exist or is not the caller's → **generic 404** (no ownership oracle).

### 4.1 Thread creation is idempotent

The overlay (and `/korume/chat` free chat) generates a **`draftThreadId`** with `crypto.randomUUID()` and holds it
in memory; nothing is written. The first send calls `POST /api/korume/threads` with `threadId = draftThreadId`,
then the turn. The insert is `on conflict (id) do nothing`:

- the row exists and is the caller's `ask_korume` thread **with the same anchor** → 200 with that thread (a retry
  after a lost response creates no second row);
- the row exists with a different anchor → 409 `thread_conflict`;
- the row exists but belongs to someone else or is a `scenario` session → generic 404.

Status: 201 on create, 200 on an idempotent replay.

### 4.2 Anchor validation (`POST /threads`)

- `lineId` given → the server loads the line, proves it belongs to `videoId`'s transcript and that the caller may
  read that video (RLS-visible; a private video the caller does not own → 404, no thread).
- `span` given → `{start,end}` integers revalidated against the line's `text_jp` in UTF-16 code units (the same
  convention as `lib/analysis/types.ts` `Utf16Span`). Out of range → 400.
- **The client never sends `origin_route`.** The server builds it from the validated ids — today only
  `/shadowing/<videoId>?line=<lineId>` (locale prefix added at navigation time). A body field named
  `originRoute` is rejected by the schema (`.strict()`).
- Threads are created by the client **on the first send**, not when the sheet opens: opening and closing Korume
  writes nothing.

### 4.3 Pending-turn projection (`GET /threads/[id]`)

The thread read carries a server projection so a poller learns the outcome without waiting out the TTL:

```ts
pendingTurns: { turnId: string; status: "running" | "retryable" }[]
```

Derived per user message that has no assistant message for its `turnId`:

- its reservation is `held` → `running`;
- no `held` reservation remains (released, or expired and reclaimed) → `retryable`;
- an assistant message exists → the turn is complete and is not listed.

Reservation ids, amounts and statuses are never exposed.

### 4.4 Status contract (`POST /turns`)

| Status | Body | Meaning |
|---|---|---|
| 200 | `{ message }` (grounding inside) | answered (fresh, or a replay of a completed `turnId`) |
| 202 | `{ pending: true }` | this `turnId` is running; poll `GET /threads/[id]` |
| 400 | `{ error: "invalid" }` | bad body |
| 409 | `{ error: "turn_conflict" }` | this `turnId` already holds a **different** question |
| 402 | `{ error: "quota_exhausted", reason: "free_daily_limit" \| "plus_credits_exhausted", resetsAt }` | |
| 403 | `{ error: "companion_disabled" }` | after auth only |
| 404 | `{ error: "not_found" }` | thread absent or not the caller's |
| 429 | `{ error: "rate_limited" \| "fuse_tripped" }` + `Retry-After` | request rate limit or the Plus daily fuse |
| 502 | `{ error: "answer_failed", retryable: true }` | answer failed; reservation released |
| 503 | `{ error: "ai_unavailable", reason }` | global budget exhausted or AI disabled |

This mirrors the Knowledge routes (`app/api/knowledge/sections/route.ts`: 402 quota, 503 unavailable).

## 5. The turn pipeline

```text
auth
→ companion_enabled gate
→ request rate limit (20 / min, the conversation module's MESSAGE_LIMIT)
→ idempotency check (turnId)
→ ai_reserve('korume_turn', turnId)        402 / 429 / 503 on refusal
→ persist (or reuse) the user message
→ fast planner (generateStructured)
→ validate + normalize + dedupe the plan    invalid → fallback plan
→ retrieval in parallel (allowlisted services)
→ deep answer (generateStructured, AnswerV1)
→ transaction: assistant message (content + content_json + grounding_json) · ai_settle(total real cost) · learner charge · title if first turn · updated_at
→ response
```

### 5.1 Idempotency by `turnId`

`turnId` is the identity of **one logical user turn**, not of an HTTP attempt.

- A user message for `(thread, turnId)` exists and `normalize(text) !== normalize(stored content)` → **409
  `turn_conflict`**: nothing is overwritten, no reservation, no provider call. `normalize` = NFC, trim, collapse
  whitespace runs.
- Assistant message for `(thread, turnId)` exists → 200 with it (replay; no provider call).
- Reservation for `turnId` is `held` → 202.
- Reservation is `released` (an earlier attempt failed) → this request may run: a new reservation, the existing
  user message is reused.
- The user message insert is `on conflict (session_id, turn_id, role) do nothing`; the reservation insert is
  guarded by the partial unique index. **Proven at the HTTP level**: two concurrent POSTs with one `turnId`
  produce at most one active reservation, one user message, one assistant message and one successful provider
  pipeline (Task 7 acceptance).

### 5.2 Planner

`generateStructured`, tier `fast`, reasoning off. Input: the question, the anchor (sentence text, translation,
video title — inside a delimited data block, never in instructions) and the last 6 turns as plain text.

Output schema (Zod, server-defined allowlist; no free-form function names):

```ts
type PlanStep =
  | { tool: "line_analysis" }
  | { tool: "dictionary_lookup"; term: string }   // 1..32 chars
  | { tool: "memory_lookup"; topic: string }      // 1..64 chars
  | { tool: "learner_exposure"; term: string }    // 1..32 chars
  | { tool: "knowledge_lookup"; section: CascadeSection };
type Plan = { steps: PlanStep[] }                 // ≤ 4
```

Server validation after parsing:

- drop steps whose tool is not in the allowlist (the schema already rejects them; the check is defence in depth);
- NFKC-normalize and trim `term` / `topic`; reject terms with no Japanese or ASCII letters;
- dedupe identical `(tool, argument)` pairs; cap at 4 after dedupe;
- `line_analysis` and `knowledge_lookup` only when the thread has a server-authorized anchor;
- `knowledge_lookup` reads `readCachedSection` only — never `getOrGenerateSection`.

Planner provider error or invalid output → record the `korume_plan` generation with its outcome and use the
**fallback plan**: anchor → `[line_analysis]`; no anchor → `[]`. The turn continues.

### 5.3 Retrieval

`Promise.allSettled`, each tool bounded at 3 s, the stage at 4 s. Every result carries a status; raw exceptions
never reach the model:

```ts
type ToolResult<T> = { tool: PlanStep["tool"]; status: "ok" | "not_found" | "error"; data?: T;
                       errorCode?: "timeout" | "unavailable" };
```

| Tool | Source |
|---|---|
| `line_analysis` | `getLineAnalysisForLearner(anchorLineId, "lexical")` |
| `dictionary_lookup` | the `dict_*` lookup the word card uses |
| `knowledge_lookup` | `readCachedSection` for the anchor sentence; a miss is `not_found` |
| `memory_lookup` | `companion_memories` of the caller: match `topic` against `line_text_jp` / `title`, ≤ 3 rows, read-only |
| `learner_exposure` | §5.4 |

### 5.4 `learner_exposure` — progress-aware "Seen N times"

- Identity: the JMdict `entSeq` of the token's best entry (as `aggregateVocabulary` uses). Tokens with no entry
  (particles such as は, auxiliaries) use `base + pos`.
- A line counts as **seen** when its video has `user_video_progress.completed_at`, or
  `start_time <= last_watched_position`, or the line appears in the caller's `shadowing_sessions`.
- Tokens are not stored; lines are tokenized through `staticAnalyses` (memoized). v1 bounds the work: the 20
  most recently watched videos, at most 3000 seen lines. When a bound is hit the label is **"Seen N+ times"** —
  never an overclaim. `last_watched_position` is the last position, not a high-water mark: a rewind undercounts,
  which is honest.
- Over its 3 s budget → `status: "error"`; the answer runs without a count.

### 5.5 Grounded entities

The server builds `groundedEntities[]` from **validated retrieval results only** (dictionary matches, line
analysis tokens with entries, exposure results):

```ts
type GroundedEntity = { id: string;               // "ent:<entSeq>" | "tok:<base>:<pos>"
  label: string; reading?: string; kind: "vocabulary" | "grammar" | "particle";
  jlpt?: "N5" | "N4" | "N3" | "N2" | "N1"; gloss?: string;
  seenCount?: number; seenCapped?: boolean;
  lessonLink?: { videoId: string; lineId?: string } };  // only videos the caller may read
```

They are passed to the answer prompt by id and **persisted** as the assistant message's `grounding_json` in the
success transaction (§2.2). The rail and every context card render entity facts from here, never from model text.

### 5.6 Answer

`generateStructured`, tier `deep`. System blocks: the Korume persona (cacheable), then the anchor, retrieved
results and grounded entities as delimited data (uncacheable). Output: `AnswerV1` (§6.1). Validation failure →
§3.3 release path, 502.

On success the server derives `content` (plain text) from the blocks and persists both.

### 5.7 Title

First successful turn: the first question, `trim`, whitespace and newlines collapsed to single spaces, cut to 40
Unicode code points, `…` appended when cut. No AI call.

## 6. UI

### 6.1 `AnswerV1` (`content_schema_version = 1`)

```ts
type Run = { text: string; strong?: boolean } | { jp: string };       // jp → inline chip
type Block =
  | { type: "paragraph"; runs: Run[] }
  | { type: "example"; jp: string; ruby: { base: string; reading?: string }[]; translation: string }
  | { type: "context_card"; entityRef: string; note?: string }
  | { type: "followups"; chips: string[] };                            // ≤ 4, each ≤ 40 chars
type AnswerV1 = { blocks: Block[] };                                   // 1..12
```

- The renderer renders **only** these block types. No HTML, no Markdown-to-HTML, no `dangerouslySetInnerHTML`.
- A `context_card` whose `entityRef` is not in `groundedEntities` is dropped by the server before persisting.
- `example` ruby reuses `components/shadowing-workspace/ruby-sentence.tsx`.
- A followup chip sends its text as a new turn.
- **Listen** on an example uses the browser `speechSynthesis` — a quick-listen convenience, not a pronunciation
  reference. Contract: shown only when a voice whose `lang` starts with `ja` exists; wait for `voiceschanged` when
  the voice list is not loaded yet; `speechSynthesis.cancel()` before each new utterance; `utterance.lang = "ja-JP"`;
  no Japanese voice → the button is absent (no English fallback, no disabled button). A future server TTS replaces
  the implementation without touching `AnswerV1`.

### 6.2 Viewport A — the Shadowing overlay

- **Floating mascot**: `components/companion/companion-sprite.tsx`, 44 px, bottom-right of the transcript column,
  never over the video. `aria-label` "Ask Korume". Hidden in Immersive / fullscreen (doctrine: "No Companion").
  Not rendered and no request made when `companion_enabled` is false.
- **Shortcut `K`** via `use-workspace-shortcuts`, ignored when focus is in an `input`, `textarea`,
  `contenteditable`, the selection popover, or any composer; not registered when Korume is disabled.
- **Opening** captures the anchor: the active line, or the open selection's span when there is one. It opens a
  right **side sheet** over the transcript column (**owner ruling 2026-10-03: a floating popup at the bottom right of
  the transcript column, where the mascot sits, at most 420px tall — not a full-height sheet**): `width: min(400px, 40vw)`, `min-width: 340px`, height bounded by
  the workspace. It overlays; it never resizes or remounts the player. At a viewport too narrow for 340 px beside
  the player it may cover most of the transcript, still without a player remount. The video keeps playing.
- The sheet is **not** a drawer tab and does not touch Mining / Notes.
- **Sheet content**: header "Korume", the anchor chip (`「私は日本語を…」 · 01:23`; click seeks to it), **Expand**
  (`/korume/chat?thread=<id>`; disabled until the thread exists), close. Body: messages. Composer: textarea, send, hint
  "Enter to send · Shift+Enter for a new line".
- **Anchor is immutable.** When playback has moved to another line the chip offers "Ask about the current line",
  which starts a new draft with the new anchor; the old thread is untouched.
- **Reopen rule**: within one page session, closing and reopening the sheet returns to the active thread. After a
  reload or navigation, the mascot starts a **new draft from the current line**. A DB thread is created on the
  first send. Older threads are reached through history on `/korume/chat`, never auto-attached.
- **Escape order**: popover → Korume sheet → Inspector → drawer → fullscreen → Focus / Full Transcript.

### 6.3 Viewport B — `/korume/chat`

Built to `215:15164`, inside the `(app)` chrome.

- **Header**: Back, "Korume · Japanese Knowledge", and on the right **"Korume Memory"** (links to `/companion`;
  not "Conversation Memory"), settings.
- **Back**: `origin_route` when the thread has one (Shadowing at that line); else `history.back()` only when the
  previous entry is an in-app navigation; else `/dashboard`. Never leaves the site.
- **Chat column**: date divider; a **grounding line** (*"You've already met … in 3 Shadowing lessons"*) only when
  `learner_exposure` returned real data, otherwise absent; user bubbles; KORUME-signed answer cards; followup
  chips; composer. No mic, no correction mode, no disabled placeholders for them.
- **Rail**:
  - *Learning context*: the thread's anchor (sentence, translation, lesson). No strategy statement.
  - *In this conversation*: `groundedEntities` raised in this thread, with "Seen N times" / "Seen N+ times" and the
    lesson link.
  - *A small memory*: the one most relevant `companion_memories` row; the block is absent when there is none.
- `/korume/chat` with no `?thread` is free chat without an anchor. Past threads are in the `⋯` menu.
- `companion_enabled = false` → a disabled state with a link to Settings; old threads are kept.

### 6.4 Inline error presentation (no toast, no modal)

| Server | UI |
|---|---|
| 402 `free_daily_limit` | composer locked; "You've asked 10 questions today · back at HH:mm" (local time of `resetsAt`) |
| 402 `plus_credits_exhausted` | composer locked; "This month's AI credits are used up · renews on <date>" |
| 429 | "Slow down a little" with a `Retry-After` countdown |
| 503 | "Korume is resting" + retry |
| 502 | the user bubble stays; "Try again" resends the **same** `turnId` |
| 202 (reload mid-turn) | "Korume is thinking…"; poll `GET /threads/[id]` every 2 s, stop on a result or after 180 s |
| 403 `companion_disabled` | the sheet closes; `/korume/chat` shows the disabled state |

Every string ships in `messages/en` and `messages/vi`.

### 6.5 One persona: no "Sensei" anywhere user-facing

- `app/[locale]/(protected)/(app)/sensei/page.tsx` is deleted; `next.config.mjs` `redirects()` maps `/sensei` (every
  locale prefix) → `/korume/chat`, through the existing route-rename mechanism and its guards.
- The `upcoming.sensei` copy (`messages/{en,vi}/upcoming.json`, pinned by `messages/en/upcoming.pin.test.ts`) is
  removed with the page; `upcoming-routes.test.tsx` and `app-nav.test.tsx` drop `sensei` from their route lists.
- Settings "Talk with Korume" (`components/settings/settings-page.tsx`) links to `/korume/chat`.
- The Pronunciation hub rail's **"AI Sensei Recommendation"** / *"Đề xuất từ AI Sensei"* and its empty copy
  (*"…Sensei will match a lesson…"*) are rewritten to name Korume (`messages/{en,vi}/pronunciation.json`
  `hub.rail.sensei.*` values; the tests that pin them follow). Only user-visible values change: i18n key names and
  code identifiers such as `getSenseiRecommendation` may stay — they are not user-facing.
- A test scans every `messages/{en,vi}/*.json` value and fails on `/sensei/i`.
- No navigation item, heading, button, aria-label or page title reads "Sensei".
- The product docs that map `215:15164` to `/sensei` (`docs/product/capability-map.md` §3.1,
  `docs/product/ia-proposal.md`, `docs/product/screen-inventory.md`) are updated to `/korume/chat` with a pointer to
  this spec.

## 7. Acceptance (merge gates)

### 7.1 SQL (`verify:db` + migration tests)

- `kind` CHECKs; every pre-existing `scenario` row valid after the migration.
- `origin_span` shape; `origin_route` guard; `origin_line_id` → `origin_video_id`.
- **Source deletion**: a real `DELETE` of an anchored line, and of an anchored video, leaves the thread and its
  messages in place with the anchor cleared and every CHECK satisfied.
- `content_json` / version pairing; `grounding_json` / version pairing; user rows carry neither;
  `(session_id, turn_id, role)` unique.
- `korume_turn` quota: Free 10; ten expired `held` rows do not block the eleventh; `released` not counted; Plus fuse;
  credits pool shared with `plus_section` in both directions.
- Partial unique `ai_reservations.turn_id`.
- Every new / replaced function revoked from `public, anon`.
- `erase_companion_memory()` removes Ask Korume threads.

### 7.2 Security and ownership

- User B can neither GET nor send a turn to A's thread → generic 404.
- `POST /threads` with a `threadId` that is B's thread, or a `scenario` session → generic 404.
- An anchor on a private video / line the caller cannot read creates no thread.
- An `origin_span` of the right shape but outside `text_jp` → 400.
- A client-supplied `originRoute` is rejected.
- No Korume code path writes `companion_memories` (asserted on recorded queries, not mock-returned rows — the
  Supabase test mock ignores filters).

### 7.3 Unit (fake provider)

Planner validation / normalization / dedupe / allowlist / fallback; `ToolResult` statuses and timeouts; grounded
entity resolution and `entityRef` filtering; `AnswerV1` → plain text; title; progress-aware exposure (particles,
the `N+` cap, rewind undercount); the turn idempotency matrix **including same `turnId` + different text → 409
with no reservation and no provider call**; the settle / release matrix (success, planner fail, answer provider
error, answer validation fail); the `pendingTurns` projection (`held` → running, released / reclaimed →
retryable, answered → absent); the TTL invariant; `speechSynthesis` with mocks (a `ja*` voice shows Listen,
`voiceschanged` updates it, no `ja*` hides it, `cancel()` precedes a new utterance). Every fix lands with one
mutation that turns its test red (memory `codex-tests-need-mutation`).

### 7.4 Regression

The scenario conversation suites (`/api/conversation/*`, `lib/data/conversation.ts`) stay green **without editing
a test**.

### 7.5 HTTP concurrency

- Task 4: two parallel `POST /threads` with one `threadId` → one row; both responses name the same thread.
- Task 7: two parallel POSTs with one `turnId` → at most one active reservation, one user message, one assistant
  message, one successful planner + answer pipeline.

### 7.6 Playwright (deterministic, fake provider)

- Mascot → sheet → send → answer; the video keeps playing and the anchor chip does not change when playback moves.
- "Ask about the current line" starts a new thread.
- Expand → `/korume/chat?thread=…` on the same thread; Back returns to the source line.
- Reload `/korume/chat?thread=…` → the rail renders from persisted grounding with **no retrieval request**.
- `/sensei` (each locale) redirects to `/korume/chat`.
- No visible text and no accessible name "Sensei" in the navigation, `/korume/chat`, the overlay, Settings or the
  Pronunciation hub.
- `/companion` is still Korume Memory and renders **no chat composer**; `/korume/chat` links "Korume Memory" →
  `/companion`.
- Escape order; `K` inside the composer types a `k`.
- At 1280×529: the sheet's measured geometry (`min(400px, 40vw)`, ≥ 340 px) and **no player remount** — geometry,
  not presence.
- `companion_enabled` off → no mascot and **no `/api/korume/*` request** (network log).
- The 402 (both reasons), 503, 502 and 409 states; a reload during a failed turn shows "Try again" without waiting
  out the TTL.
- No Playwright test depends on the machine having a Japanese voice.

### 7.7 Live smoke (Gemini; **ask the owner before running — it spends real money**)

On Ep.729, after clearing the fixture: two turns. Per turn, exactly one successful `korume_plan` and one
successful `korume_answer` generation sharing its `turn_id`, and no third call in the clean run; one settle; one
charge. (Deliberate retry or provider-error runs may legitimately hold more rows per `turn_id`.) "Seen N" is checked
against an **independent oracle**: a fixture with predetermined progress and a reference SQL/script count computed
outside `learner_exposure`.

### 7.8 Owner

The owner looks at a worktree build in Chrome before the merge decision (memory `never-build-in-main-checkout`).

## 8. Delivery

Branch `ask-korume`. Codex implements from packets (one task per exec, `## Context budget` in every packet),
Claude reviews and commits; if Codex hits its quota Claude finishes the task. Each DB-owning task owns its own
migration (§2). Order:

1. Migration `…041_ask_korume_threads` (sessions, messages, grounding, anchor-cleanup triggers,
   `ai_generations.turn_id`) + SQL tests + types.
2. Migration `…042_ask_korume_entitlement` (`korume_turn`, `ai_reservations.turn_id`, `ai_reserve` branch) +
   config env.
3. Migration `…043_companion_enabled` + Settings row + server gate helper.
4. Thread / message data layer: idempotent create by `threadId`, anchor validation, route builder, list / read with
   `pendingTurns`, ownership; the thread-create concurrency proof.
5. Planner + retrieval allowlist + the four simple tools.
6. `learner_exposure` (progress-aware) + `groundedEntities`.
7. Answer `AnswerV1` + `POST /turns` + idempotency (incl. 409) + settle / release + grounding persistence + the turn
   concurrency proof.
8. `AnswerV1` renderer + Listen + shared chat components (message list, composer, error states).
9. Shadowing overlay: mascot, sheet, shortcut, Escape order, reopen rule, `draftThreadId`.
10. `/korume/chat`: page, rail, Back, thread list, disabled state; the `/sensei` redirect and the §6.5 copy sweep.
11. E2E, then the live smoke (owner approval first), then the whole-branch review.
