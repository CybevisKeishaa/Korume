# Shadowing practice modes — Pronunciation (Part 2) and Listening Practice (Part 3)

Status: **design approved section by section in conversation 2026-10-15; this written spec awaits the owner's review.**
No product code, migration or merge happens before the spec and then the plan are approved.

One spec, two branches, built in order:

| Branch | Scope | Starts |
|---|---|---|
| **B1 `practice-pronunciation`** | the shared practice frame (§3) + Pronunciation (§4) + its data, Summary, Dashboard and Mission changes | after this spec and its plan are approved |
| **B2 `practice-listening`** | Listening Practice (§5) + its data, Summary, Dashboard and Mission changes + retiring the legacy dictation route | after B1 is merged with the owner's approval |

Every section below says which branch owns it. A section without a tag belongs to both.

## 1. Sources and how they rank

- **Figma** (file `IwFHZDZdHW7qsSFiNbWrkd`) decides composition and visual intent inside the approved workspace:
  Pronunciation `120:2027`, Listening Practice `123:2835` (both 1278×983). Both frames draw a long scrolling
  page; the owner ruled that the approved `h-dvh` workspace wins (D1), so the frames contribute their **practice
  panel** content, not their page layout.
- **The shipped workspace** (Part 1a `2026-10-01-shadowing-workspace-part-1a-design.md`, 1b reframe, Summary
  `2026-10-04-summary-analysis-design.md`) decides the shell, the player and the mode model.
- **The repo** decides the source of truth (L-051, L-052; shared `--text-*` type tokens; desktop-only; no
  fabricated data; "port = complete port").

### 1.1 Debts the earlier Shadowing specs left for Parts 2/3 (all taken here)

| Debt | Where it was deferred | Taken in |
|---|---|---|
| Recorder + Azure scoring return to a surface ("temporary loss of surface access, not capability") | 1a Q4 | B1 §4 |
| Transcript row action "Practice this sentence" | 1a §6 rows, 1b table | B1 §3.7 |
| "Same player instance across mode routes" is a required gate | 1a §11 | B1 (two modes), B2 (three) |
| Derived difficult from learning evidence (Part 2+) | 1a Q5 | B1/B2 via Summary review rules §6 |
| Summary adapters for Pronunciation and Listening, "the only place that changes when Part 2/3 ship" | Summary §3.1 | B1 §6.1, B2 §6.2 |
| Legacy `/shadowing/[id]/dictation` route left outside the workspace | 1a §4.1 | B2 §5.10 |

No earlier plan scheduled Parts 2/3; nothing was half-built. The one unmerged 1a commit pair (`1a2a08a8`, merged
`-s ours` as `94dbb8c3`) is a superseded WIP and carries nothing needed here.

## 2. Owner decisions (2026-10-15)

| # | Decision |
|---|---|
| D1 | Keep the approved `h-dvh` Shadowing workspace and one player instance; swap content per mode. No long scrolling page. The practice panel scrolls on its own; the workspace never scrolls. |
| D2 | Left column keeps the player; lesson info and stats collapse into one compact strip (§3.5). Figma's two lesson cards and bottom strip are not reproduced. |
| D3 | Figma's "Optional reports" do not appear in the workspace. They belong to Summary or a later report, shown only on real data. Live Feedback stays in the practice panel. |
| D4 | Listening hides subtitles, transcript and every answer surface while the learner works; the answer shows only after Check, Show answer, or the parts a Hint revealed. |
| D5 | Listening has two formats in one mode: **Word Bank** (default, Figma `123:2835`) and **Typing** (advanced). Switched inside the panel; no extra mode on the mode bar. Results are stored, scored and reported separately. |
| D6 | Each mode has its own metric and source: Shadowing = how far the learner has watched; Pronunciation = Azure-scored lines; Listening = dictation attempts per format. Pronunciation never advances Shadowing progress. Summary never counts one action twice. |
| D7 | Shadowing progress is shown as **"Watched to sentence X/Y"** from `user_video_progress.last_watched_position`, never as "X sentences completed" and never as complete. Per-line listened tracking is a later improvement (§11). |
| D8 | Word Bank chunks are bunsetsu-style phrases from kuromoji on the server, at most 8, no distractors, deterministic shuffle per sentence. Grammar endings are never split; punctuation attaches to its chunk; merging past 8 follows grammatical boundaries; an unreliable cut is never shown. |
| D9 | A sentence that cannot be cut reliably (or yields one chunk) falls back to Typing **with a visible notice**, never silently. |
| D10 | Hints are unlimited, one next unrevealed unit per press; hinted parts never count as self-recalled; a fully hinted sentence scores 0. The server stores which units were hinted and computes the score itself. |
| D11 | "Show answer" is stored as `revealed`: it puts the line into Review but is never a 0% score and never a mission outcome. |
| D12 | Only the current sentence's answer opens. Changing sentence or starting a new attempt conceals again. Concealment is a learning aid, not anti-cheat. |
| D13 | Pronunciation Live Feedback is complete (score, word colouring, Accuracy/Rhythm/Completeness, pitch, overlay, own-take replay, history, progress line) but layered: essentials always visible at 1280×529, detail expandable inside the scrolling panel. |
| D14 | Pitch is labelled a reference measure of intonation against a synthesized voice, never as proof of correct pronunciation. |
| D15 | A progress remark appears only with ≥2 valid scored attempts of the same sentence, comparing the same metric. |
| D16 | Azure failure (503, 429, timeout, error) never loses the recording and never shows a fake score. 429 shows a wait time only when the backend supplies one. |
| D17 | Player is sentence-bound in Pronunciation and Listening (plays the current sentence, then stops). Starting a recording pauses the player first. Shadowing playback is unchanged. |
| D18 | "Practice this sentence" on a Shadowing transcript row opens Pronunciation on exactly that sentence. |
| D19 | Listening defaults to listen-only: the video picture is covered (burned-in subtitles cannot be detected). "Show video" is the learner's choice; a new sentence or a new attempt covers it again; other modes never inherit the cover. No preference or column stores it. |
| D20 | Dashboard keeps its approved layout. Its Listening skill reads **Typing submitted** attempts only, and its empty state says the measure is based on Typing. Summary shows Word Bank and Typing separately. |
| D21 | Legacy rows are kept: existing dictation attempts become `typing`; scored ones `submitted`; unscored ones a legacy-only `unscored` that new code never writes. |
| D22 | `/shadowing/[id]/dictation` redirects to Listening with Typing open, keeping the lesson id. `DictationView` is deleted only after Listening works, E2E passes and grep finds no caller. |
| D23 | Pronunciation stores 16 kHz mono WAV; the server scores from the stored file and the line's own text (§4.2). Accuracy/completeness/words are persisted in a versioned `assessment` (§4.4). |
| D24 | Each mode is switched on (`LEARNING_MODES[].complete = true`) **inside its branch** once it is ready for the owner's Chrome review; merge follows the owner's approval of the real mode bar and flow. |
| D25 | Learners cannot write score rows directly (spec review 2026-10-15). `authenticated` loses INSERT/UPDATE on `shadowing_sessions` (B1) and `dictation_attempts` (B2); the server writes them with the service-role client after verifying the user (§7.1). Remaining accepted risk: `pitch_score` is measured on the client by design (§11). |

## 3. Shared practice frame — B1

### 3.1 Routes

```
app/[locale]/(protected)/(focus)/shadowing/[id]/
  (workspace)/
    layout.tsx                  unchanged: bootstrap -> <ShadowingWorkspaceShell>
    page.tsx                    Shadowing (unchanged)
    pronunciation/page.tsx      B1: <PronunciationModeBody>
    listening/page.tsx          B2: <ListeningModeBody>   (?format=word_bank|typing)
  summary/page.tsx              unchanged (outside the group)
  dictation/page.tsx            B2: permanent redirect -> ./listening?format=typing
```

The player lives in `WorkspaceLayout` (`components/shadowing-workspace/workspace-shell.tsx`), above `{children}`. No
`template.tsx` and no pathname-derived `key` may be added between the layout and the mode pages, on the shell, on
a provider or on the player; either would remount the iframe.

**Gate (one instance, not a restored timestamp):** E2E stamps a marker property on the YouTube iframe element and
counts the adapter's `onReady` events; after switching modes the same element still carries the marker and
`onReady` fired once. B1 proves Shadowing ↔ Pronunciation; B2 proves all three.

### 3.2 Mode-aware shell

The shell derives the mode from `usePathname()` **during render** (no effect, so the first frame is already right)
through one helper `practiceModeFromPath(pathname)` in `lib/shadowing-workspace/learning-modes.ts`. It changes
exactly these things in the left column and around it:

| | Shadowing | Pronunciation | Listening (B2) |
|---|---|---|---|
| Below the player | `LiveSentence` | `LessonStatStrip` | `LessonStatStrip` |
| Subtitle overlay | CC toggle | CC toggle | hidden unless the current line's attempt is checked or revealed (§5.8) |
| Video picture | shown | shown | covered by default (§5.9) |
| Utility drawer, Korume mascot | shown | shown | hidden (they can quote the sentence) |
| Playback | continuous (unchanged) | sentence-bound | sentence-bound |

### 3.3 Sentence-bound playback

`usePlaybackController` gains a `sentenceBound` flag set by the mode. When on:

- Play plays the current line from its `start` and pauses at its `end` (the existing line-boundary detection with
  the `now - last < 1.5` seek guard, not a timer).
- Previous / Next / a navigator chip cancel any loop, seek to the new line's exact `start`, and stay paused; the
  previous line's audio never bleeds into the new one.
- Loop (Listening, B2) repeats only the current line until Loop is turned off or the line changes.
- Speed uses the existing control; Listening offers 0.75× as in Figma.
- Shadowing passes `sentenceBound = false`; its behaviour and tests are unchanged (regression gate).

### 3.4 `PracticePanel`, `SentenceNavigator`

`PracticePanel` is the right column for both modes: a scroll container (`overflow-y: auto`, own scrollbar) with
three slots — navigator, the mode's practice area, the mode's Live Feedback. The workspace grid stays `h-dvh`
`overflow-hidden`.

`SentenceNavigator` reads and writes the **same** `currentLine` the player and transcript use (workspace session
context); it owns no state. It shows chips for a window around the current line (Figma shows 8) with ←/→ to move
the window, and the line number of the current line. Each chip carries the line's real state from §3.6: none,
scored (score band), unscored recording (B1), needs review (B1/B2), revealed (B2). Chips are buttons with an
accessible name "Sentence 51, scored 86".

### 3.5 `LessonStatStrip`

One strip under the player, target height ~56px (a target, not a fixed size). Uses the shared `--text-*` tokens.

- Pronunciation: `Ep.729 · Sentence 51/194 · Scored 12/194 · Avg 84`. "Scored X/Y" = distinct lines with at
  least one Azure-scored session; "Avg" = mean of each line's **latest valid scored** session. No score yet →
  "No score yet", never a Figma number.
- Listening (B2): the active format only, labelled: `Word Bank · Submitted 20/194 · Avg 91%` or
  `Typing · Submitted 5/194 · Avg 72%`. The two formats are never averaged together.
- Narrow (split divider dragged, or short viewport): drop the title, then the average; keep `Sentence X/Y` + one
  metric. Player and its controls keep priority.
- No time metrics ("Speaking 18 min", "Remaining 18 min") and no timestamp/sentence-length cell: there is no
  per-mode time source, and the player already shows position.

### 3.6 `GET /api/shadowing/[id]/practice-stats?mode=…`

- `mode`: `pronunciation` (B1); `word_bank` | `typing` (B2).
- Auth required; 401 without a session. Reads through one `security invoker` SQL function
  `practice_stats(p_video uuid, p_mode text) returns jsonb` (RLS and `auth.uid()` scope every row), aggregated in SQL
  so no PostgREST `max_rows` cap truncates it. `revoke execute … from public, anon; grant … to authenticated`.
- Response `Cache-Control: private, no-store`.
- Shape: `{ lineCount, scoredLines, mean, lines: [{ lineId, state, score }] }` where for each line:
  - **score** = the latest *valid scored* attempt of that line (and format);
  - **state** = from the latest attempt of *any* status — `revealed` wins as `needs_review` even when an older
    attempt scored high (§5.7 rule R2).
- Refetched after each save/score/submit; never cached across learners.

### 3.7 "Practice this sentence" (D18)

A row action in `transcript-row.tsx` (hover/focus, like the existing row actions). It sets `currentLine` to that row
and client-navigates to `/shadowing/[id]/pronunciation`. Shared state carries the line; no query string, no reset to
the first sentence.

### 3.8 Shortcuts and text entry

- Workspace shortcuts (`use-workspace-shortcuts.ts`) ignore events whose target is an input, textarea or
  contenteditable; Space/←/→ while typing are characters.
- No answer is submitted while an IME composition is active (`event.isComposing` or keyCode 229).

## 4. Pronunciation — B1

### 4.1 Panel (Figma `120:2027`, layered per D13)

Always visible at 1280×529:
- the sentence, large (reading tokens), word-coloured after scoring (§4.6), a weak word opens its Azure error type;
- the round mic button with a live waveform while recording;
- overall score + label (Excellent / Good / Keep practising, by threshold);
- **Replay Native** (player plays the current line), **Play my take**, Previous, Next.

"Details" (expandable, inside the scrolling panel):
- Accuracy · Rhythm (Azure fluency) · Completeness;
- **Intonation (reference, compared with a synthesized voice)** — `pitch_score` + the existing
  `PitchContourOverlay` (D14);
- what Azure heard (`recognizedText`);
- this sentence's history (time, score, replay, scored/unscored, rescore);
- the progress line (D15): only with ≥2 valid scored attempts of this sentence; latest vs the previous one on the
  same metric, e.g. "Rhythm 72 → 80". No generic praise sentence.

### 4.2 Attempt flow

```
idle --mic--> requesting-permission --granted--> recording --stop | auto-stop--> converting
converting --ok--> saving --201--> scoring --ok--> scored
converting --error--> convert-failed            (original blob kept; "Try again")
saving --error--> save-failed                   (WAV kept in memory; "Save again")
scoring --503--> unscored-unavailable | --429--> unscored-throttled | --409--> (refresh session state)
scoring --timeout/error--> unscored-error
unscored-* --"Score again"--> scoring           (same sessionId, no re-recording)
```

- Mic press pauses the player before opening the microphone (D17).
- Max length `min(lineDuration × 2 + 3 s, 30 s)`; auto-stop at the limit, a second press stops early.
- Convert with `blobToWav16kMono` **before** saving; the upload is the WAV (one upload, not webm + WAV).
- Pitch: computed client-side from the recording within the existing 3 s budget and sent with the session; past the
  budget the session saves without it (existing behaviour).
- "Saved" is shown only after the server's 201.
- Permission denied → how to re-enable in the browser; no device or no `MediaRecorder` → explained, mic hidden.
- 429 → "Try again in N s" only when the response carries `Retry-After`; otherwise "Busy, try again shortly".

### 4.3 Server: save

`POST /api/shadowing/session` (existing route, `lib/data/shadowing.ts::createSession`):
- accepts WAV only for new sessions; the server **parses the RIFF header** (never trusts `Content-Type`):
  `RIFF`/`WAVE`, a `fmt ` chunk with PCM (format 1), 1 channel, 16000 Hz, 16 bit; duration from the `data` chunk
  ≤ 31 s; size ≤ 1.1 MB. Anything else → 422.
- ownership/line check as today (line must belong to the lesson); rate limit unchanged (30/min).
- storage path `${user.id}/shadowing/${sessionId}.wav` in the private `recordings` bucket; the plan verifies the
  bucket's `allowed_mime_types` (and migrates it if `audio/wav` is not allowed).
- order: upload → insert row → on insert failure delete the file; if the delete also fails, log the path and return
  the error. A session row therefore never lacks its file; an orphan file needs two failures and leaves a log line.
- `recordActivity(source "shadowing", lineId)` stays at creation (mission progress counts distinct lines, §6.1).
- The user-scoped client verifies the user and the line; the **row insert uses the service-role client** with
  `user_id` set to the verified user (D25). The storage upload stays on the user-scoped client (its RLS path policy
  `${user.id}/…` is the ownership proof).

### 4.4 `assessment` (versioned, D23)

`shadowing_sessions.assessment jsonb`, validated by zod on write and on read:

```ts
{ v: 1,
  accuracy: number | null, completeness: number | null, recognizedText: string | null,
  words: { word: string; accuracy: number | null;
           errorType: "None" | "Omission" | "Insertion" | "Mispronunciation" }[] | null }
```

Missing Azure parts are `null`. An unknown `v` or an invalid object reads as `null`. Every UI piece renders only
when its field exists; legacy rows (`assessment = null`) show "No detail recorded for this attempt".

### 4.5 Server: score by session

`POST /api/pronunciation/score` with JSON `{ sessionId }`:
1. auth (user-scoped client); rate limit (10/min) unchanged; 503 when speech is not configured.
2. **claim with a lease token.** Columns `scoring_claim uuid` + `scoring_started_at timestamptz`. The server calls
   `claim_pronunciation_scoring(p_user uuid, p_session uuid) returns table (claim uuid, video_id, transcript_line_id,
   recording_url)` (`security definer`, executable by `service_role` only, D25):
   ```sql
   update shadowing_sessions
      set scoring_claim = gen_random_uuid(), scoring_started_at = now()
    where id = p_session and user_id = p_user and pronunciation_score is null
      and (scoring_claim is null or scoring_started_at < now() - interval '90 seconds')
   returning scoring_claim, video_id, transcript_line_id, recording_url
   ```
   No row → `409` (already scoring, already scored, or not the caller's). The client then refetches the session.
3. reference text = the session's line `text_jp` (the client sends none); the line must still belong to the
   session's lesson.
4. download the session's own file from storage; a `.webm` legacy recording → release the claim, `409
   legacy_format` (§4.7).
5. Azure assess with a 30 s request timeout, well inside the 90 s lease.
6. success → `finish_pronunciation_scoring(p_session, p_claim, scores, assessment)` (service-role only):
   `update … set pronunciation_score, rhythm_score, assessment, scoring_claim = null, scoring_started_at = null
   where id = p_session and scoring_claim = p_claim and pronunciation_score is null`, returning whether a row
   changed. **Only when it changed** run `captureShadowScoreMemories` (Companion memory once per session).
7. failure → `release_pronunciation_scoring(p_session, p_claim)`: `set scoring_claim = null, scoring_started_at =
   null where id = p_session and scoring_claim = p_claim`. Scores stay `null`; the error maps to 429/502/503 as
   today.

The token makes a late request harmless: a request whose lease expired and was re-claimed holds a stale `p_claim`,
so its finish and its release both match no row — it can neither write a score nor free the newer claim. A late
finish that matches no row returns `409` to its (already superseded) caller.

A scored session is immutable: a new score means a new recording. Scoring never creates a session and never
touches missions. The legacy multipart path (`referenceText` + audio from the client) is removed if the plan's grep
finds no caller other than the orphaned `ShadowingRecorderPanel`, which B1 then deletes (1a Q4's promise is kept:
the capability is back on a surface).

### 4.6 History, word colouring, race safety

- `GET /api/shadowing/session?lineId=` adds per session: `pronunciationScore`, `rhythmScore`, `pitchScore`,
  `assessment`, `state: scored | unscored | legacy`, `format: wav | webm`. Auth, RLS, `private, no-store`; signed URLs
  only for the caller's own files with the existing 1 h TTL; newest first, existing limit 10.
- **Word colouring:** align the concatenated Azure words to the line text by character (the Levenshtein alignment
  in `lib/dictation/score.ts`). Colour only when ≥90% of the line's characters align; below that show the overall
  remark and no colours. Tested on real sentences with kanji, kana, punctuation, omitted words and Azure word splits
  that differ from ours.
- **Race safety:** each attempt is its own state record keyed by `{lineId, sessionId}` and stored per `lineId`; the
  panel renders only the current line's record, so a score for line 51 arriving while line 52 is shown lands on 51.
- **Unsaved states** = `recording`, `converting`, `convert-failed`, `saving`, `save-failed` — every state before the
  server's 201. In any of them:
  - the navigator and Previous/Next are disabled with a hint ("Finish saving this take first"); in `recording`, Esc
    or the mic stops;
  - a `beforeunload` guard covers reload/close;
  - an in-app confirm dialog (not `window.confirm`) covers the mode bar, the header back link and any other
    in-workspace navigation; confirming discards the take.

  > Build note (2026-10-19, whole-branch review N-1): the dialog also covers the app nav rail and programmatic
  > navigation (Korume's "Open full chat"). It skips `saving`: that request finishes after the mode unmounts and
  > lands on the shell's store, so leaving loses nothing, and discarding it would let its 201 attach to a newer take
  > on the same line. `beforeunload` still warns in every unsaved state, `saving` included.

  After the 201 (`scoring`, `scored`, `unscored-*`) changing sentence or mode needs no warning; a running score
  lands on its own line. Unmount stops every microphone track. A blob is never promised to survive a browser crash;
  no IndexedDB.

### 4.7 Legacy recordings

Webm sessions from before Part 1a stay playable and keep their scores. Their "Score again" is disabled with "Older
recording format, cannot be rescored". The migration only adds columns; no existing row is rewritten. The plan
counts legacy rows on the owner's local DB before migrating (Docker was off at spec time, so nothing assumes zero).

## 5. Listening Practice — B2

### 5.1 Formats

A segmented control at the top of the panel: **Word Bank** (default) | **Typing**. The choice lives in `?format=`
(no preference, no column). Switching with an attempt in progress (a placed chunk or typed text) asks to confirm;
the new attempt starts concealed.

### 5.2 Chunker (D8, D9)

`lib/dictation/chunk.ts`, server-only, kuromoji (`lib/japanese/tokenizer`). `kuromoji` and its dictionary are pinned
to an exact version in `package.json`.

- A chunk starts at an independent word (noun, independent verb/adjective, adverb, adnominal, conjunction,
  interjection); a prefix binds to the word after it.
- Attached to the previous chunk: particles, auxiliary verbs, dependent verbs/adjectives, suffixes, punctuation;
  `する` after a サ変 noun; consecutive nouns (compounds). So `勉強します。` is one chunk and `ました` is never split.
- More than 8 chunks: repeatedly merge the adjacent pair across the **weakest** boundary, weakest first —
  noun|noun, modifier|head, adverb|predicate, after a case particle, after `、`; ties go to the shorter pair.
- **Unreliable → no Word Bank** (Typing with a notice, D9) when: the surfaces do not concatenate back to the
  normalized line; any kuromoji `UNKNOWN` token; Latin letters or digits; a single chunk.
- Versioned registry `CHUNKERS = { 1: chunkV1 }`. A version is never edited; a new algorithm is a new key.
- Shuffle: Fisher–Yates with a seed from a hash of `lineId`; if the result equals the original order and n > 1,
  rotate by one.

`GET /api/lines/[id]/chunks` → `{ version, textHash, reliable, reason, chunks, typingHintUnit }` (auth + lesson access as the
existing `/api/lines/[id]/analysis`; per-process memo; `private`). The server never trusts chunks sent by a client.

**Coverage gate:** `scripts/dictation/chunk-coverage.ts` runs every local line through the chunker and reports the
Word Bank-usable share and the fallback share per reason with samples, recorded in the run state for the owner.
The rules are not loosened before that report exists.

### 5.3 Data: `dictation_attempts` migration

| Column | Type | Notes |
|---|---|---|
| `format` | `text` check in (`word_bank`, `typing`) | backfill `typing`, then no default |
| `status` | `text` check in (`submitted`, `revealed`, `unscored`) | backfill: score present → `submitted`, else `unscored`; then no default |
| `hint_unit` | `text` check in (`chunk`, `grapheme4`) null | null when no hint |
| `hinted_units` | `int[]` not null default `'{}'` | |
| `chunk_order` | `int[]` null | Word Bank arrangement, slot → chunk index |
| `chunker_version` | `smallint` null | the version scored against |
| `chunk_snapshot` | `text[]` null | the reference chunk texts, for audit independent of later algorithms |

CHECKs: `status = 'submitted' ⇔ accuracy_score is not null`; `status = 'revealed' ⇒ accuracy_score is null`;
`format = 'word_bank' ⇒ chunk_order is not null or status = 'revealed'`. Index
`(user_id, transcript_line_id, format, created_at desc)`.

**`unscored` is legacy-only, enforced by a trigger** (a CHECK on `status` cannot tell an old row from a new one,
and `created_at` is writable). The migration backfills first, then installs
`dictation_attempts_no_new_unscored` — `before insert or update`, raising when `new.status = 'unscored'` and
(`tg_op = 'INSERT'` or `old.status is distinct from 'unscored'`). Existing `unscored` rows stay; nothing can create
one or turn a row into one. The zod schema also has no `unscored`. DB tests prove: insert `unscored` fails, update
`submitted → unscored` fails, the backfilled legacy rows still read.

### 5.4 Submit / reveal API

`POST /api/dictation/attempt` (existing route, extended; rate limit 60/min unchanged; zod-validated):

```ts
| { kind: "submit"; videoId; lineId; format: "word_bank"; version; textHash; chunkOrder: number[]; hintedUnits: number[] }
| { kind: "submit"; videoId; lineId; format: "typing"; version; textHash; input: string; hintUnit: "chunk" | "grapheme4"; hintedUnits: number[] }
| { kind: "reveal"; videoId; lineId; format: "word_bank"; version; textHash; hintedUnits: number[] }
| { kind: "reveal"; videoId; lineId; format: "typing"; version; textHash; hintUnit: "chunk" | "grapheme4"; hintedUnits: number[] }
```

zod objects are `.strict()`: a Word Bank body carrying `hintUnit` is a 400.

**Hint unit is decided by the server from the line, never chosen freely by the client:**
- Word Bank → always `chunk` (the server sets it; the client sends none).
- Typing → `typingHintUnit(line)` = `chunk` when the chunker is reliable **and** yields ≥ 2 chunks, else
  `grapheme4`. The client sends the unit it used (it got it from `GET /chunks`); a mismatch is a 400.
- Stored `hint_unit` is the server's value, or `null` when `hintedUnits` is empty.

Server, in order: auth (user-scoped client) → line belongs to lesson → `textHash` matches the current line text,
else `409 line_changed` ("This sentence changed, start again") → recompute chunks with `CHUNKERS[version]` (unknown
version → 409) → validate:
- `chunkOrder` is a permutation of `0…n−1` (length n, each index once);
- `hintedUnits` unique integers within `[0, unitCount)`, where `unitCount` is the chunk count for `chunk` or the
  number of 4-grapheme units for `grapheme4`;
- otherwise 400, nothing scored or stored.

`submit` → score (§5.5), insert `status = submitted` with snapshot/version/hints through the **service-role
client** with the verified `user_id` (D25), `recordActivity(source "dictation", lineId)`, return the result.
`reveal` → insert `status = revealed`, `accuracy_score = null` (same client), **no `recordActivity`, no mission
claim**, return the full answer.

Validation tests cover both formats and both units: a non-permutation, a duplicate or out-of-range hint index, a
Word Bank body with `hintUnit`, a Typing `hintUnit` that disagrees with the line, and a `grapheme4` line.

### 5.5 Scoring

- **Word Bank:** slot `i` is correct when `chunks[chunkOrder[i]].text === chunks[i].text` (identical texts are
  interchangeable). Score = correct and not hinted ÷ n × 100. All slots must be filled before Check.
- **Typing:** both sides normalized by `normalizeJa` (NFKC, whitespace removed) and then **punctuation removed**
  (`。、！？「」『』（）…・` and their NFKC forms); the displayed answer keeps punctuation. Align with
  `scoreDictation`. Hinted units map to character ranges of the **reference** (through the chunk boundaries, then the
  punctuation-strip index map), so a hint in mid-sentence is excluded at its own position even when the learner's
  typing is offset. Score = reference characters matched **and** not hinted ÷ reference length × 100. Fully hinted
  → 0.
- **`grapheme4`** units (unreliable lines) are 4 grapheme clusters each, cut with
  `Intl.Segmenter("ja", { granularity: "grapheme" })` — never inside a multi-code-point character.
- Result: `{ score, diff, slots?, metrics }` with diff ops match / wrong / missing / extra / hinted.

### 5.6 Live Feedback metrics (shown only when computable)

| Metric | Word Bank | Typing |
|---|---|---|
| Recall | correct non-hinted slots ÷ slots | matched non-hinted reference chars ÷ reference chars |
| Slots | correct slots / slots | — |
| Kanji | hidden (chunks are chosen, not written) | reference positions in `\p{Script=Han}`: matched non-hinted ÷ total; hidden when the line has no kanji |
| Grammar | hidden | reference positions covered by kuromoji `助詞`/`助動詞` tokens (tokenized on the original line, mapped through the strip map): matched non-hinted ÷ total; hidden when none |

Plus the score, its label, the coloured diff, "Try again" (same shuffle, new attempt, concealed) and "Next sentence".

### 5.7 Hint and Show answer

- **Hint** reveals the next unhinted unit, unlimited presses. Word Bank: the chunk jumps into its correct slot,
  locked, tagged "hint". Typing: the chunk text (or 4 graphemes) appears on a hint line above the input; the learner
  still types it. `hinted_units` is sent with the submit.
- **Show answer** (secondary button): POST `reveal`; the panel shows the full answer and its subtitle (video stays
  covered).
- R1 — average: per line and format, the **latest `submitted`** attempt.
- R2 — review: per line and format, the **latest attempt of any status**; `revealed` → review even if an older
  attempt scored high; `submitted` < 80 (`REVIEW_DICTATION_BELOW`) → review.

### 5.8 Concealment (D4, D12)

- On entering Listening, the subtitle overlay is hidden from the **first render** regardless of the CC toggle
  (mode derived in render, §3.2). `LiveSentence`, the transcript, the utility drawer and the Korume mascot are not
  rendered in Listening.
- The current line's attempt state is `answering | checked | revealed`. The overlay may show **only the current
  line** and only in `checked | revealed`. Changing line or starting a new attempt resets to `answering` in the same
  state update that changes the line, so no frame shows a neighbouring line's subtitle.
- Concealment is a UI learning aid; the line text is present in the workspace bootstrap.

### 5.9 Listen-only cover (D19)

A cover sits above the iframe and below the workspace control bar and centre play button, so play/pause, seek,
speed and loop stay usable (the workspace already drives the player with its own controls). "Show video" lifts it
for the current line; a line change or new attempt restores it; leaving Listening removes it. Chrome gate: every
control works with the cover on.

### 5.10 Legacy dictation route (D22)

`dictation/page.tsx` becomes a permanent redirect to `../listening?format=typing` (locale and lesson id kept). The
Dashboard mission link for `dictation_lines` points at `/shadowing/[id]/listening`. `DictationView` and its test
are deleted only after Listening E2E passes and grep shows no caller.

## 6. Summary, Dashboard, Mission

### 6.1 B1

- **Summary · Shadowing row:** new `ModeState` kind `{ kind: "reached"; line: number; total: number }` →
  "Watched to sentence X/Y". `X` = number of lesson lines with `start_time ≤ last_watched_position`; no progress row
  or position 0 → `not_started`. Never `complete`, never "X completed".
- **Summary · Pronunciation row:** mean of each line's latest **scored** session (was: mean of all sessions).
  Pitch for a line = its latest session with a pitch score.
- **Summary · review:** unchanged rules, fed by latest scored values.
- **Mission:** progress already counts `DISTINCT item_key` (line ids) from `learning_outcomes`
  (`daily_mission_item_progress`), so retakes cannot inflate it. `practice_activity` (used to *suggest* missions)
  changes `shadow_lines` to distinct lines. The `shadow_lines` mission is now fed by Pronunciation recordings (the
  only per-line speaking evidence); its learner copy says "Practise speaking N sentences" and its link opens
  `/pronunciation` (Claude's decision under the owner's principles; flagged for the spec review).

### 6.2 B2

- **Summary · Listening row:** two labelled values, Word Bank and Typing, each `scored(mean of R1)` or
  `not_started`. Review list reasons add `revealed` ("Answer shown") next to `dictation`.
- **Dashboard:** `weekly_skill_windows` and `weakness_scores` read `dictation_attempts` with
  `format = 'typing' and status = 'submitted'`. Copy change only: the Listening empty state says it is based on
  Typing ("Word Bank results are in each lesson's Summary").
- **Mission:** `practice_activity.dictation_lines` = distinct lines with a `submitted` attempt (both formats).
  `revealed` never records an outcome, so it never advances a mission, the heatmap or the streak.

## 7. Migrations

- **B1:** `shadowing_sessions add assessment jsonb, add scoring_claim uuid, add scoring_started_at timestamptz`
  (+ check that `assessment` is null or an object with `v`); `claim_` / `finish_` / `release_pronunciation_scoring`;
  `practice_stats` (pronunciation); replace `lesson_summary_evidence` (reached line, latest-scored pronunciation) and
  `practice_activity`; bucket MIME if needed; the privilege change of §7.1 for `shadowing_sessions`.
- **B2:** `dictation_attempts` columns, backfill, checks, trigger, index (§5.3); `practice_stats` word_bank/typing
  (R1/R2); `lesson_summary_evidence` (per-format R1/R2); `weekly_skill_windows`, `weakness_scores`,
  `practice_activity`; the privilege change of §7.1 for `dictation_attempts`.
- Read functions: `security invoker`, `set search_path = public`, `revoke … from public, anon`, granted to
  `authenticated`. Score-write functions (`claim_`/`finish_`/`release_pronunciation_scoring`): `security definer`,
  `set search_path = public`, `revoke … from public, anon, authenticated`, granted to `service_role` only.
- Additive only: no existing row deleted or rewritten except the B2 backfill of the two new columns.

### 7.1 Score write privileges (D25)

Today RLS `shadowing_own` / `dictation_own` are `for all to authenticated`, so a learner can insert or update their
own score rows through PostgREST, bypassing every server check. The only writers in the app are three server paths
(`createSession`, `scorePronunciation`, `submitAttempt`), and the service-role client is already used by 10+ server
modules, so the fix is contained:

- `revoke insert, update on shadowing_sessions from authenticated, anon` (B1);
  `revoke insert, update on dictation_attempts from authenticated, anon` (B2).
- SELECT stays (RLS still scopes reads to the owner). DELETE is unchanged (no app path deletes; account erasure runs
  as service role through the `users` cascade).
- The server verifies the user and every relation with the user-scoped client first, then writes with the
  service-role client, always setting `user_id` to the verified user. Service role bypasses RLS, so these write
  helpers are the only place that may hold it for these tables, and each has a test that a foreign `lineId` /
  `sessionId` is rejected before the write.
- DB fixtures that insert these rows as `authenticated` move to the owner/service role; a DB test proves an
  `authenticated` insert and update are refused.

## 8. Edge cases (tested)

| Case | Behaviour |
|---|---|
| Score for line 51 returns while line 52 is shown | stored on 51's record; 52 unaffected |
| Two "Score again" presses / two tabs | one claim wins; the other gets 409 and refetches |
| First request outlives its 90 s lease, a second claims, then the first returns | first's finish/release match no row (stale token); only the second can write or release |
| Azure fails after claim | claim released with its own token, scores stay null, recording kept |
| Navigation while `converting`/`saving` | blocked (navigator) or confirmed (mode bar, reload) like `recording` |
| Learner inserts/updates a score row through PostgREST | refused (no INSERT/UPDATE privilege) |
| Anything inserts `status = 'unscored'` or turns a row into it | trigger raises |
| Word Bank body with `hintUnit`, or Typing `hintUnit` ≠ the line's unit | 400 |
| Legacy webm session | playable, scores shown, rescore disabled with reason |
| `assessment` null / unknown `v` / partial Azure result | detail parts hidden individually |
| Azure word split ≠ ours, <90% alignment | no colouring, overall remark |
| Mic denied / missing / no MediaRecorder | explained; no recording state entered |
| Reload during recording or save-failed | `beforeunload` warning; mode switch → in-app confirm |
| Line text edited by admin mid-attempt | 409 `line_changed`, restart |
| Malformed `chunkOrder` / `hintedUnits` | 400, nothing stored |
| Hint every unit | score 0 |
| Typed text offset from a mid-sentence hint | hinted reference range excluded at its own position |
| Emoji or combining marks in a `grapheme4` line | units never split a cluster |
| Typing 95 then Show answer | average keeps 95 (R1); line is in Review (R2) |
| Same line done in Word Bank and Typing on one day | mission counts 1 |
| Only Word Bank practised | Dashboard Listening empty state names Typing; Summary shows Word Bank |
| Enter during IME composition | no submit |
| Burned-in subtitles in the video | covered by default |

## 9. Verification and gates

Automated tests use an **Azure stub**; nothing in the suite calls Azure. Each fix carries one mutation proving its
test fails without it.

| Gate | B1 Pronunciation | B2 Listening |
|---|---|---|
| One player instance (marker + single `onReady`) | Shadowing ↔ Pronunciation | Shadowing ↔ Pronunciation ↔ Listening |
| Recording, WAV validation, save, score, rescore, history, legacy webm | required | regression |
| Azure stub states: success, 429 (with/without `Retry-After`), 503, timeout, concurrent rescore | required | regression |
| Race: late score lands on its own line; mic released on unmount | required | regression |
| Lease token: stale finish and stale release change nothing (DB race test, two sessions) | required | regression |
| Unsaved-state guard over all five pre-201 states | required | regression |
| Direct `authenticated` INSERT/UPDATE refused | `shadowing_sessions` | + `dictation_attempts` |
| `unscored` trigger, hint-unit validation for both formats and both units | — | required |
| Chunker on real sentences, shuffle determinism, coverage report | — | required |
| Word Bank, Typing, Hint, Show answer, scoring, metrics, input validation | — | required |
| Concealment: no subtitle frame on entering Listening or changing line; cover keeps controls usable | — | required |
| Summary + Mission | Shadowing reached-line, Pronunciation latest-scored, distinct `shadow_lines` | + Listening per format, R1/R2, `revealed`, distinct `dictation_lines` |
| Dashboard | unchanged (regression) | Typing-only Listening + copy |
| **Migration compatibility** on a DB holding legacy rows (seeded fixtures: webm sessions, null `assessment`, unscored and scored dictation) and the owner's local data: migration applies, no row lost, existing SQL consumers return the same results for legacy data | required | required |
| Live Azure smoke on Ep.729 in development with a dedicated smoke learner (not a real learner), cleaned up after: save, score, reload, history intact | required | regression |
| Full vitest after the last edit, typecheck, lint, `verify:protocol`, `verify:db`, typography scan (G4), Playwright (pre-existing master reds listed, not new) | required | required |
| Chrome at 1280×529, 1440×900, 1920×1080, plus nav collapsed | required | required |
| code-reviewer per task, whole-branch review, separate fix-wave review | required | required |
| Owner's Chrome look on the real mode bar (mode enabled in-branch, D24), then merge | required | required |

Environment: Docker Desktop + `npx supabase start` before migrations, DB tests and E2E; build and serve only inside
the worktree.

## 10. Branch plan

- **B1 `practice-pronunciation`** (this worktree, from master `03a3b400`): §3, §4, §6.1, B1 parts of §7–§9; flips
  `pronunciation.complete` when ready for the owner's look.
- **B2 `practice-listening`**: branched from master after B1 merges; §5, §6.2, B2 parts of §7–§9; flips
  `listening.complete` when ready for the owner's look.

## 11. Out of scope (recorded, not built)

- Per-line "listened to the end" tracking for Shadowing (D7 option 3).
- Optional Reports cards (D3) until a report surface with real data exists.
- Word Bank distractors.
- IndexedDB persistence of unsaved takes.
- Rescoring legacy webm recordings.
- A separate Word Bank skill on the Dashboard (D20 option 2).
- **Accepted residual risk — `pitch_score`.** After D25 no learner can write a score row directly, and the Azure
  scores and dictation scores are computed only on the server. `pitch_score` is still measured in the browser from
  the learner's own recording and sent with the save; the server checks it is a number in 0–100 but cannot verify
  it (existing zod range check). It is labelled a reference measure (D14), feeds no mission, and is read in two
  places: Summary's `pitch` review reason and the Dashboard's pronunciation weakness family (`pitch` metric). A
  learner can only skew their own reference reading. Accepted until pitch scoring moves to the server; it is not
  described anywhere as server-verified.
- Rows written before D25 were writable by their owner; they are kept as they are (no way to tell edited rows).
