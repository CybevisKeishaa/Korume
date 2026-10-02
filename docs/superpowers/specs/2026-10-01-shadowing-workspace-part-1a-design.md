# Shadowing Workspace — Part 1a: the core Shadowing loop on real data — Design

- Date: 2026-10-01
- Branch: `shadowing-workspace-1a` (worktree `.worktrees/shadowing-workspace-1a`)
- Status: brainstormed with the owner, sections 1–5 approved in conversation; this file awaits the
  owner's review of the written text before `writing-plans`.
- Route: `/[locale]/shadowing/[id]` (Shadowing Learning Mode). Web/desktop only — no mobile work.

## 0. Goal and success

Port the Shadowing Practice workspace from Figma into production, **on real data**, so the owner can
verify that shadowing actually works: open the video → the right sentence is current at every
moment → read it with furigana and the Vietnamese translation → replay / previous / next / loop →
the transcript follows → search it → bookmark / mine / pin / mark difficult → Focus Mode, Full
Transcript Mode, fullscreen → Reading Settings and Study Environment → leave and come back to the
same place.

The acceptance subject is a real lesson the owner supplied: YouTube `Fwj3tH4Uls8`, "私が苦手な人のタイプ
— Japanese Listening Practice N3・N2 Ep.729" (Bite Size Japanese), 282 sentences, ≈23 min, Japanese
SRT + a Vietnamese SRT whose 282 timestamps match the Japanese one exactly.

Part 1a is the first of five sub-projects; each gets its own spec, plan and branch:

| Part | Scope |
|---|---|
| **1a** (this spec) | Core Shadowing workspace — layout, player, Live Sentence, transcript, sync, resume, marks, modes, Reading Settings, Study Environment |
| 1b | Intelligence layer — Utility Drawer, Analysis popover, Vocabulary / Grammar / AI explanation, the ✨ action |
| 2 | Pronunciation mode (Figma `120:2027`) — record → score → compare → retry |
| 3 | Listening Practice (Figma `123:2835`) — dictation / fill-blank / translation |
| 4 | Summary mode (Figma `125:1030`) |

## 1. Sources and how they rank

- **Figma `105:3088` "Shadowing Practice"** (file `IwFHZDZdHW7qsSFiNbWrkd`, 1278×585) decides
  composition, hierarchy and visual intent. It is a **legacy 8-tab
  workspace** drawn before the 2026-08 reconciliations, and it is truncated at 585px.
- **`docs/design/screens/screen-shadowing-practice.md`** and the locked specs
  `2026-08-01-shadowing-practice-figma-reconciliation-design.md` and
  `2026-08-05-korume-rebrand-shadowing-figma-reconciliation-design.md` decide the product model
  (four Learning Modes, header contents, sentence actions, Reading Settings, Study Atmosphere).
- **The repo** decides source of truth and architecture.
- The Figma Make export (`Desktop\Japan\Korume\src korume`) is read for intent only; its component
  files are unchanged since 2026-08-05 and nothing from it is copied.
- Figma proves that a control exists; where it does not show the control's internal options or
  persistence, this spec takes them from the documentation and says so.

## 2. Decisions (owner rulings, 2026-10-01)

| # | Decision |
|---|---|
| Q1 | **Learning Mode navigation is progressive.** A mode registry and navigation component exist from Part 1a, but render only modes whose workspace route is complete. One completed mode → no bar. Two or more → a bar with exactly those modes. Never a disabled tab, "Coming soon", an empty route, or a link to a legacy screen to fill the bar. |
| Q2 | **Focus Mode = sentence-focused practice.** Hides the transcript pane; Player + Live Sentence expand to the centre; current sentence and playback are preserved. Distinct from Full Transcript Mode and from fullscreen. Session state, never persisted. `Esc` exits it when nothing else holds Escape. |
| Q3 | **Split 1a / 1b.** 1a = core loop; 1b = intelligence layer. No empty Utility Drawer shell in 1a; 1a keeps boundaries clean so 1b attaches without a rewrite. |
| Q4 | **Recorder and AI Summary leave the Shadowing surface.** Recorder/Azure scoring belongs to Pronunciation (Part 2), Summary to Summary mode (Part 4). This is a temporary loss of *surface access*, not of capability: no table, API, scoring type, persisted session, component, helper or test behind them is deleted. A–B looping is superseded by sentence Loop/Repeat. Save to playlist moves to the header overflow. |
| Q5 | **`sentence_marks`** holds explicit, learner-set lightweight marks only (`bookmark`, `difficult`). Pin (Journal) and Mining (SRS card) stay separate systems. Manual difficult is a `difficult` mark; derived difficult is computed from learning evidence (Part 2+) and never written here. `isDifficult = manual OR derived`. No action implicitly creates another. |
| Arch | **Persistent workspace layout.** The YouTube player lives in a client shell mounted by a route-group layout; child mode routes render only their body. Option 1 of three. |
| Bookmark | **Lesson bookmark is its own concept** (`user_lesson_bookmarks`), separate from sentence bookmarks, playlists and My Lessons (`user_lesson_library`, which is membership, append-only and feeds popularity). |

## 3. Deviation register

A reviewer comparing the code with Figma `105:3088` will find these differences. Each is deliberate.

| Figma `105:3088` shows | Part 1a ships | Why | Revisit when |
|---|---|---|---|
| 8 tabs (Reading active) | no mode bar | 8 → 4 modes was ruled in 2026-08-05 §3; hiding the bar with one completed mode is Q1 | the second mode ships (Part 2) |
| `72% complete` | absent | ruled in 2026-08-05 §6 (no progress indicators) | — |
| full 224px App sidebar | sidebar hidden by default (`(focus)` chrome) | override from the newer workspace contract (`screen-shadowing-practice.md` § Sidebar, 2026-07-31 spec §6.7); the frame does not draw this | — |
| video area 490×180 (≈2.7:1) | real 16:9 YouTube player | cropping an embed hides content and YouTube's own UI | — |
| Live Sentence ruby overflowing its card, one glyph per line | inline ruby flow, auto-height card, translation below | a bug in the frame, not intent | — |
| ✨ action on Live Sentence | absent | its function (AI explanation) is Part 1b; a dead control is forbidden | Part 1b |
| no Back, no overflow `⋯`, no lesson Bookmark | present | required by `screen-shadowing-practice.md` § Header; later frames (`120:2027`…) draw Back | — |
| no furigana in transcript rows | none in the normal transcript; furigana in Live Sentence and in Full Transcript Mode | follows the frame; Full Transcript is the "read like a novel" mode | — |
| column split ≈50/50 | 50/50 default, resizable | Figma beats the document's 35/65; Figma draws an 8px divider, matching "resizable" | — |

Also omitted, with reason: **Translation language** selector (data has one untagged
`text_translation` column — revisit when transcripts carry several translation locales) and
**silence-based Auto Pause / sensitivity** (a YouTube iframe exposes no audio — platform limit).

## 4. Architecture

### 4.1 Routes

```
app/[locale]/(protected)/(focus)/shadowing/[id]/
  (workspace)/
    layout.tsx        server: bootstrap → <ShadowingWorkspaceShell>
    page.tsx          Shadowing mode body (replaces today's [id]/page.tsx, same URL)
    pronunciation/    Part 2 · listening/ Part 3 · summary/ Part 4
  dictation/          legacy route, outside the group, untouched
```

- No `template.tsx` anywhere between the layout and the mode pages; no `key` derived from the mode
  on the shell, a provider or the player. Either would remount the player.
- `(focus)/layout.tsx` is unchanged (nav mounted, hidden by default).

### 4.2 Server bootstrap

`layout.tsx` loads in parallel: `getVideo`, `getTranscript`, `getVocabMasteryMap`,
`getMyPreferences` (extended, §6), **new** `getMyLessonResume(videoId)` (position +
`last_watched_at`), **new** `getMyLessonBookmark(videoId)`, **new**
`listMySentenceMarks(transcriptId)`. It normalises everything into explicit, serializable DTOs
before the client boundary: no `Map`, no class instance, no function — a non-serializable prop
blanks the page while jsdom stays green.
The transcript gets **one canonical order at bootstrap** — `(start_time, id)` — and every consumer
uses that array; no component sorts on its own.

**No silent 1000-row truncation.** `supabase/config.toml` sets `max_rows = 1000` while ingest accepts
up to 2000 lines (`MAX_TRANSCRIPT_LINES`), and today's `getTranscript` reads the lines in one
unpaginated select ordered by `start_time` only — a 1500-line lesson loses its last 500 lines with
no error. T2 fixes `getTranscript` to a paged read under the total order `(start_time, id)`, and
`listMySentenceMarks` reads the same way; both get a test with more than 1000 rows.

### 4.3 Client state — separate stores, separate hooks

| Store | Holds | Changes |
|---|---|---|
| `LessonContext` | video, ordered transcript, metadata, mastery map | never during a session |
| `PlaybackController` (context) | stable commands: `play`, `pause`, `seekTo`, `setRate`, `getCurrentTime`, sentence prev/next, rewind 5s, loop config | never re-renders on a tick |
| `PlaybackPositionStore` | `currentTime` | every tick; read with `useSyncExternalStore`, subscribed only by the progress bar and the subtitle overlay |
| `CurrentSentenceContext` | current sentence `index` + `isSpoken` | only when `index` **or** `isSpoken` changes |
| `SessionContext` | `workspaceView`, fullscreen target, Live Sentence hidden, transcript translation override, per-line furigana and translation reveals, transcript query, split ratio, open popovers | user toggles |
| `PreferencesContext` | Reading Settings (§6) | user edits |
| `MarksContext` | sentence marks, lesson bookmark | user toggles |

- The current sentence is **derived** from playback time; there is no second source of truth for it.
  `index` = the last sentence in canonical order whose `start_time ≤ t` (binary search), none before
  the first. `isSpoken` = `t < effectiveEnd(index)`, where `effectiveEnd` is the sentence's
  `end_time`, else the next sentence's `start_time`, else the video's duration. The context publishes
  when either value changes, so a gap (same `index`, `isSpoken` turning false) is published without
  the index changing.
- **`workspaceView` is one state machine, `normal | focus | full-transcript`**, not two booleans.
  Entering a view replaces the current one; `Esc` returns to `normal`. Fullscreen is a separate state
  (`none | workspace | player`) and combines with any view.
- The real player instance lives in a `ref` inside the shell, behind a `PlayerAdapter` interface;
  production uses `YouTubeAdapter` (wrapping the existing `components/video-player/youtube-player.tsx`),
  unit tests a `FakePlayerAdapter`. No component outside the controller touches the YouTube API.
- **Optimistic writes are race-safe per key.** Marks are keyed `(lineId, kind)`, the lesson bookmark
  by video, preferences by field. The last mutation for a key wins; a failed request rolls back only
  if it is still the latest mutation for that key; a key may be disabled while pending.
- **Mutable bootstrap must never come back stale.** Preferences, marks, the lesson bookmark and the
  resume position all arrive through the layout. Acceptance: after a successful preference, mark or
  bookmark mutation, a client-side leave-and-return shows the latest persisted state, not a router-cache
  snapshot. The mechanism (`router.refresh`, revalidation, or reconciling the bootstrap with the
  client's newer state) is chosen in T4; the acceptance is fixed.

### 4.4 What happens to the old view

`components/video-player/shadowing-view.tsx` stays as the behavioural reference until the new
workspace has proven parity on Ep.729 (player controls, resume, transcript sync, mining/pin,
speed/loop, persistence). It is removed in the last task after a dead-code audit that deletes only
code with no remaining caller. `ShadowingRecorderPanel`, `VideoSummaryPanel`, speech scoring, pitch,
their APIs, tables and tests are kept intact (Q4).

## 5. Data and API

### 5.1 New tables (new migration files)

**`sentence_marks`**

| column | type |
|---|---|
| `user_id` | `uuid not null references users (id) on delete cascade` |
| `transcript_line_id` | `uuid not null references transcript_lines (id) on delete cascade` |
| `kind` | `text not null check (kind in ('bookmark', 'difficult'))` |
| `created_at` | `timestamptz not null default now()` |

Primary key `(user_id, transcript_line_id, kind)`. RLS: select / insert / delete own rows; no update
policy. Insert `with check (user_id = auth.uid() and exists (select 1 from transcript_lines where id
= transcript_line_id))` — the `exists` runs under the learner's own RLS on `transcript_lines`, so a
line the learner cannot read cannot be marked.

**`user_lesson_bookmarks`** — `user_id` (cascade), `video_id uuid not null references videos (id) on
delete cascade`, `created_at`; primary key `(user_id, video_id)`; the same RLS shape, insert
checked with `exists (select 1 from videos where id = video_id)`. The column is `video_id`, as in
`user_video_progress`, so one UUID has one name; the product still calls it a Lesson Bookmark.

`text + CHECK` follows the recent migrations (`user_preferences`, `collections.kind`).

### 5.2 Edited in place

- `20260922000033_user_preferences.sql` gains the Reading Settings columns of §6 (AGENTS.md §6:
  migrations are edited in place). Every column is `not null` with a default, except where §6 says
  otherwise.
- `user_video_progress` is unchanged; `last_watched_at` already exists and is trigger-maintained.

### 5.3 API

| Route | Method | Notes |
|---|---|---|
| `/api/sentence-marks` | `PUT` / `DELETE` | body `{ transcriptLineId, kind }`, zod-validated, rate-limited like sibling routes. PUT ensures the mark exists, DELETE ensures it does not — idempotent; no server-side "toggle". A refused line returns a generic 404 with no line or video metadata. |
| `/api/videos/[id]/bookmark` | `PUT` / `DELETE` | same semantics for the lesson bookmark |
| `/api/user/preferences` | `PATCH` | existing route, schema extended with §6 fields |
| `/api/videos/[id]/progress` | `PATCH` | existing; the response now also returns `last_watched_at` |

Mine and pin keep their existing routes and controls (`mine-line-control.tsx`, `pin-line-control.tsx`).

## 6. Reading Settings and Study Environment

### 6.1 Reading Settings (⚙ in the header)

A non-modal popover; every change applies immediately; there is no settings page. Option lists live
in one module (`lib/preferences/options.ts`) from which zod schemas, the UI and the SQL test derive.

| Setting | Column | Values (default **bold**) | Applies to |
|---|---|---|---|
| Furigana | `reading_furigana` | always / **adaptive** / hidden | Live Sentence, Full Transcript; per-line overrides are session-only (§7.8) |
| Translation | `reading_translation` | hidden / reveal (tap to show) / **always** | Live Sentence, transcript; the panel's 👁 is a session-only override (§7.8) |
| Japanese font | `reading_jp_font` | **gothic** (Noto Sans JP) / mincho (Noto Serif JP) | Japanese text in the workspace; mincho loaded only by the workspace layout |
| Font size | `reading_text_size` | s / **m** / l / xl | multiplies on top of the app-wide Display scale |
| Line height | `reading_line_height` | compact / **comfortable** / airy | |
| Reading width | `reading_width` | narrow / **normal** / wide | max line length (Focus, Full Transcript) |
| Sentence emphasis | `reading_emphasis` | minimal / **soft** / strong | how strongly the current sentence stands out |
| Text colour preset | `reading_color_preset` | **warm_cream** / night / sepia / high_contrast | background + text of Live Sentence, transcript, subtitle overlay |
| Playback speed | `playback_default_rate` | **1.0**, constrained at runtime to the player's available rates | speed when a lesson opens |
| Loop count | `playback_loop_count` | **1** / 3 / 5 / ∞ (stored as `0` = ∞) | default of the Sentence popover |
| Auto Pause | `playback_auto_pause` | **off** / on | pause at each sentence boundary |
| Shortcut hints | `show_shortcut_hints` | **off** / on | whether shortcut hints show by default; the hint popover's open/closed state is session-only |
| Resume | `resume_behavior` | **resume** / restart | §7.4 |
| Study Environment | `study_atmosphere` | **none** + the six of §6.2 | §6.2 |

Persisted (account, cross-device): the table above. Session-only: current sentence and position,
`workspaceView`, fullscreen, Live Sentence hidden, translation and furigana overrides (§7.8),
transcript query, split ratio, every popover's open state.

### 6.2 Study Environment (Study Atmosphere)

A popover with **None** (default) and the six documented places: Evening Study, Coffee Shop, Rainy
Day, Quiet Library, Spring Morning, Summer Night. Implementation: `data-atmosphere` on the workspace
root; each place is a token set in `app/globals.css` covering exactly what the document lists —
background glow (faint radial gradient), colour temperature (low-alpha warm/cool overlay), glass tint
(card background mix), shadow softness, ambient particles (CSS-only, ≤ 12 elements,
`pointer-events: none`, `aria-hidden`, not focusable).

- An atmosphere never changes text colours.
- No audio, no video background; the nav's Rain Sound is a separate, unrelated control.
- Reduce Motion (the existing preference): atmosphere colour, glow and tint stay; particles are not
  rendered at all.
- **Contrast is verified on the cross product** `reading_color_preset × atmosphere` (4 × 7), using
  the effective background after tint and overlay, ≥ 4.5:1 for body text, in a unit test over the
  tokens.

## 7. Layout, components, behaviour

### 7.1 Frame geometry (measured from `105:3088`)

Main area 1054 wide (padding 28): header 48, mode nav 44 (hidden in 1a), workspace = left 491 /
divider / right 471. Left column: Player (video + 64px control bar) then Live Sentence. Right column:
Transcript panel (header 114 incl. search, then rows of 64, 88 when wrapped).

The workspace fills `100dvh`; each column scrolls on its own. The owner's viewport is **1280×529**,
shorter than the frame: the video's size is derived from the height budget so that at least the
Japanese line of Live Sentence stays visible. Stacking the columns at a very narrow desktop width is
a defensive fallback, not an acceptance target and not mobile scope.

### 7.2 Header

Left: ← Back (to the Hub), title, source line (channel · JLPT), JLPT badge, `Sentence X / Y`.
Right, as Figma: **Study Environment** · **Focus Mode** · ⛶ (fullscreen of the whole workspace) ·
⚙ (Reading Settings) · **lesson Bookmark** · `⋯` overflow with **Save to playlist** and **Download
transcript** (client-side `.srt` / `.txt` from the loaded transcript). The mode registry renders
nothing while one mode is complete (Q1).

### 7.3 Player

- Video with a subtitle overlay (current sentence) and a centred play button while paused.
- Progress bar is the seek control (click / drag / keyboard as a slider). **Sentence beat markers are
  a single non-interactive visual layer** (one SVG or background) — never one DOM control per
  sentence; Ep.729 has 282.
- Left group: ⏮ · ⏯ · ⏭ · **↶5s** (Figma node `105:3621`, rewind 5 seconds).
- Right group: **Sentence** pill (loop the current sentence; its compact popover sets the count
  1/3/5/∞) · speed `1×` · volume/mute · **subtitle overlay toggle** (node `105:3640`, `aria-pressed`,
  name follows state) · ⛶ player fullscreen (keeps the overlay).

### 7.4 Synchronisation, loop, resume

- **Gaps** between sentences keep the sentence just spoken, with `isSpoken = false` (softened
  styling); before the first sentence there is none.
- **Clock cadence is chosen after measurement (T0).** Acceptance: a sentence switch lags its
  timestamp by **≤ 300 ms**, measured live on Ep.729 (§8).
- Clicking a transcript row seeks to `start_time` and plays; the stores update immediately.
- ⏮ restarts the current sentence if more than 1.5 s into it, otherwise goes to the previous one.
  ⏭ goes to the next. ↶5s seeks to `max(0, t − 5)`.
- **Loop:** `1× / 3× / 5×` = total plays of the sentence in one cycle, counting the current play;
  `∞` repeats until the learner changes sentence or turns loop off. A manual sentence change resets
  the count. A last sentence without `end_time` ends at the video's end.
- **Auto Pause** pauses after the loop cycle completes, before advancing; with `∞` it never fires.
  So `3× + Auto Pause` = hear it three times, then pause for the learner to speak.
- **Keyboard shortcuts** (Space play/pause, ←/→ sentence, Shift+← rewind 5s, L loop, F Focus Mode)
  are ignored whenever focus is on any interactive or editable element — input, textarea, select,
  button, link, slider, menu item, `[contenteditable]`. A focused progress slider keeps ←/→ for itself.
- **Escape priority:** dialog/popover → fullscreen → Focus / Full Transcript. One press does one thing.
- **Resume priority:** `?line=` deep link (an explicit intent; it beats `restart`) → if
  `resume_behavior = resume`, the newest valid saved position → 0. `?line=` is honoured **only if the
  id is present in this video's bootstrapped canonical transcript**; an id from another video, or one
  that no longer exists, is ignored and resolution continues with resume → 0. (A link to a line of
  another video must carry that video's `[id]`.) A saved position `< 5 s`, beyond
  the video's duration, or inside its last 10 s means 0. A valid position snaps back to the start of
  the sentence that contains it. The player is **initialised once, paused, at that position, without
  remounting or replacing the instance**; which player call achieves that is chosen in T0. The stores
  start at that position, so the right sentence shows before Play.
- **Progress writes:** `sessionStorage` is written frequently (local only) under the key
  `shadowing-resume:${userId}:${videoId}` as `{ userId, videoId, position, savedAt, syncedServerAt }`;
  a record whose `userId` or `videoId` does not match the current session and lesson is ignored, so a
  sign-out / sign-in as another account in the same tab cannot inherit a position. Server writes are coalesced — at most every 10–15 s and
  only when the position moved meaningfully — plus on pause, `visibilitychange → hidden`, `pagehide`
  and leaving the workspace, using `fetch(…, { keepalive: true })` (PATCH, so not `sendBeacon`).
  Unmount is an extra write, never the only safety net.
- **Which position is newer:** the progress response returns the server's `last_watched_at`, stored
  as `syncedServerAt`. On open, if the bootstrap `last_watched_at` is later than the record's
  `syncedServerAt`, another tab or device wrote since and the server wins; otherwise the tab's record
  wins. Only server clocks are compared. (Needed because Next 14's client router cache can serve a
  layout payload up to 30 s old on client-side return.)
- Player errors keep the existing error overlay; the transcript stays readable. A lesson without a
  transcript shows an intentional empty state; the player still works.

### 7.5 Live Sentence

Label "LIVE SENTENCE"; large Japanese with ruby over each word group (furigana mode applies);
Vietnamese translation beneath (translation mode applies — see §7.8). 👁̸ is a **session-only "hide/reveal the
Japanese sentence"** toggle for listening recall: it does not pause, does not change the sentence,
and does not touch the persisted translation or furigana preferences. ✨ is absent until 1b.

### 7.6 Transcript panel

- Header: "TRANSCRIPT", `282 sentences · 23 min`, 👁 translation show/hide (a
  **session-only override**, §7.8), ⤢ Full Transcript Mode, search field.
- Rows: number, Japanese, small translation. States: current (warm background, orange left border,
  highest contrast), past (softer), future (neutral), bookmarked (tiny indicator), difficult (tiny
  indicator).
- Hover/focus actions, hidden otherwise: Replay · Bookmark · Difficult · Mine · Pin · furigana
  reveal for this line (a **session-only per-line override**, §7.8). "Practice this sentence" is absent until
  Pronunciation exists (Part 2).
- **Auto-follow:** the current row is scrolled to the centre (instant under Reduce Motion). A
  learner scroll suspends auto-follow and shows a "Back to current" pill. Scrolls the app performs
  itself are flagged so they are never mistaken for a learner scroll.
- **Search** filters rows to matches, keeps their original numbers, Enter jumps to the first match,
  and suspends auto-follow until the query is cleared.

### 7.7 Modes and the divider

`workspaceView` (§4.3) is `normal | focus | full-transcript`; entering one replaces the other.

- **`focus`:** transcript hidden; Player + Live Sentence centred, ≈ 960 px max width.
- **`full-transcript`** (⤢ on the panel): transcript near full width with furigana, video as a small
  window bottom-right, Live Sentence hidden.
- **Fullscreen** (`none | workspace | player`, independent of `workspaceView`): ⛶ in the header → the
  workspace root; ⛶ in the player → the player container. Neither changes the view.
- **Divider:** `role="separator"` with `aria-orientation="vertical"` and value attributes; drag with
  the mouse; Arrow Left/Right move it by a fixed step; visible focus ring; both panes keep a minimum
  width; ratio is session-only; default 50/50.
- None of these remount the player.

### 7.8 Translation and furigana: persisted mode vs session overrides

**Only the Reading Settings popover changes a persisted mode.** Every quick control elsewhere is a
session-only override that never writes `user_preferences` and never destroys the learner's chosen
mode.

| Control | Scope | Effect |
|---|---|---|
| ⚙ Translation / Furigana | persisted | sets `reading_translation` / `reading_furigana` |
| 👁 on the transcript panel | session, whole transcript | forces translation shown or hidden in the transcript; cleared when the session ends or the persisted mode changes |
| per-line furigana action | session, one line | reveals (or hides, when the mode is `always`) furigana on that line only; `adaptive` stays `adaptive` everywhere else |
| tapping a hidden translation (mode `reveal`) | session, one line | shows that line's translation |
| 👁̸ on Live Sentence | session | hides/reveals the Japanese of Live Sentence (§7.5) |

`reading_translation = reveal` means: translations render covered by default; a tap (or Enter on the
focused cover) reveals that line's translation; reveals are remembered per line for the session and
never persisted.

## 8. Testing and acceptance

| Layer | Covers | Runs |
|---|---|---|
| Unit (vitest) | canonical order + sentence lookup (duplicates, gaps, missing `end_time`); loop/Auto Pause machine; resume arbitration (`?line` valid / from another video / missing, `restart`, <5 s, end, overflow, `syncedServerAt`, session record of another user or video ignored); `isSpoken` across gaps; `workspaceView` transitions; translation/furigana overrides never write preferences; progress coalescer; shortcut guard + Escape priority; per-key optimistic race; contrast cross-product | CI |
| Component (vitest + RTL) | Live Sentence (ruby, 👁̸, translation modes), transcript row states, search, Settings and Environment popovers, header with no mode bar, divider keyboard | CI |
| SQL gate (`verify:db:shadowing`, new, same shape as the existing gates) | B cannot INSERT a mark on A's PRIVATE line; B cannot SELECT or DELETE A's marks; B cannot bookmark A's PRIVATE lesson; the owner can PUT/DELETE marks and bookmarks on permitted content; deleting a line cascades its marks; deleting a lesson cascades its bookmarks; every new preference CHECK | local DB |
| Playwright, deterministic | a fake `window.YT.Player` installed with `page.addInitScript`, defining exactly the API `YouTubeAdapter` uses, with a test-driven clock: sentence switching, loop ×3, Auto Pause, resume after leaving the route, corrupt saved position, Focus / Full Transcript / Esc, divider keyboard + drag, marks and bookmark survive reload, settings survive reload, **a preference, a mark and the lesson bookmark changed, then a client-side leave-and-return (not a reload) shows the new state**, Focus/Full Transcript/resize/settings do not remount the player. Fullscreen API is shimmed to test the state machine, Escape priority and focus restoration. | CI |
| Playwright live, Ep.729 (`@live`) | the real YouTube iframe. It first asserts the iframe loaded from `youtube.com` and `getDuration()` ≈ 1396 s, so it cannot pass while measuring nothing. Then the owner's gate: seek mid-video → right sentence; **5–10 consecutive boundaries, each delta reported with max and p95, each ≤ 300 ms**; auto-follow; replay; loop ×3; speed 0.75; furigana; Vietnamese translation; open → seek to X → leave → return → X restored, sentence in sync, not playing; corrupt position → safe 0. If YouTube cannot meet 300 ms the test reports the real numbers — the threshold is not loosened. | locally, before merge |
| Manual, Chrome | real workspace and player fullscreen; the owner's visual look | before merge |

Why the fake goes in through `addInitScript` and not an app-level injection hook: the repo keeps no
production code path whose only purpose is testing (see `tests/e2e/fixtures/youtube-stub.cjs`), and
the app's YouTube loader already reuses an existing `window.YT`.

**Ep.729 fixture.** `scripts/seed-real-lesson.ts` takes the directory holding the `[ja]` and `[ja-vi]`
SRT files and the YouTube id, validates that both files have the same count and identical
timestamps, seeds idempotently (video `FREE`, transcript `youtube_caption`, lines with furigana via
`toFurigana` and the Vietnamese translation) and prints the lesson and video ids. The SRT files are
not committed. A missing fixture fails the live spec with "fixture missing" — never a silent skip.

**Same player instance across mode routes** cannot be accepted in 1a (one mode, no second route, and
no fake route is built for it). It becomes a required gate in Part 2.

**Merge gates:** `tsc`, `lint`, `vitest`, `verify:protocol`, every `verify:db:*` on a fresh reset;
the deterministic e2e plus the existing shadowing-hub / shadowing-explore specs; the live Ep.729
spec; an independent review per task and a whole-branch review; the owner's Chrome look and merge
decision.

## 9. Tasks and order

| # | Task | Depends on |
|---|---|---|
| T0 | Chrome probe: effective `getCurrentTime()` update cadence; how to initialise paused at a position (`seekTo` / `cueVideoById` / player option). Throwaway; numbers recorded in the run state. | — |
| T1 | Migrations (`sentence_marks`, `user_lesson_bookmarks`, preference columns) + `verify:db:shadowing` | — |
| T2 | Data + API: marks, lesson bookmark, preferences schema, progress response, resume read; paged `getTranscript` / marks reads (>1000-row test) | T1 |
| T3 | Pure logic: ordering, lookup, loop/Auto Pause machine, resume arbitration, coalescer, shortcut guard | T0 |
| T4 | Shell: `(workspace)` route group, DTOs, stores, `PlayerAdapter` + `PlaybackController`, session/keepalive writes | T2, T3 |
| T5 | Player, subtitle overlay, beat markers, Live Sentence | T4 |
| T6 | Transcript panel: states, search, auto-follow + pill, hover actions, marks | T4 |
| T7 | Header: Back, meta, counter, lesson bookmark, overflow, mode registry | T4 |
| T8 | Focus Mode, Full Transcript, fullscreen, Escape, divider | T5 |
| T9 | Reading Settings, Study Environment, tokens, contrast test | T4 |
| T10 | Fake `YT.Player`, deterministic specs, seed script, live Ep.729 spec | T5–T9 |
| T11 | Parity check, dead-code audit, remove `ShadowingView`; docs (`screen-shadowing-practice.md` rulings + deviations, `domain-model.md` Sentence Mark and Lesson Bookmark); run state | parity + live gate |

T1/T2 may run alongside T0. T6, T7 and T9 may run in parallel after T4. Codex implements, Claude
reviews and commits; T0 and T10 are Claude's, because Codex's
sandbox cannot run Playwright.

## 10. Out of scope

Mobile layouts; everything listed for Parts 1b, 2, 3, 4; derived difficulty; a translation-language
selector; silence-based Auto Pause; ambient audio; Hub-side reads of bookmarks (the data is ready for
them; the Hub surface is a later decision).
