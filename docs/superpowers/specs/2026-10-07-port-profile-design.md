# Port Profile + Edit Profile — design

- **Status:** design frozen by the owner on 2026-10-07 across five sections (each approved with amendments);
  this document folds every ruling and amendment into one text. §0.3 lists three corrections found while
  writing it, which the owner must approve before the plan is written.
- **Branch:** `port-profile`, worktree `.worktrees/port-profile`, base `master` at **`2cee918`** (the SHA at
  branch creation).
- **Frames:** Profile `66:166`, Edit Profile `67:595` — file `IwFHZDZdHW7qsSFiNbWrkd`
  (`figma.com/design/IwFHZDZdHW7qsSFiNbWrkd/Korume?node-id=66-166`, `…node-id=67-595`).
- **Successor:** `port-dashboard` (frame `111:515`) consumes the two foundations built here — study timezone
  (§3) and study time (§5). It must not build a second version of either.

---

## 0. Authority, rulings, and corrections

### 0.1 Authority

Figma decides composition, hierarchy and visual intent; the repo decides source of truth and architecture
(`docs/product/screen-inventory.md` Part II, Amendment C; Claude memory `figma-is-the-frame`). A port is a
**complete** port: every control on screen has a real effect, every number is measured, nothing is mocked.
A capability whose product semantics are not decided is decided first or removed from the screen —
never rendered as an inert control. Layer D (`AGENTS.md` §2) binds absolutely.

### 0.2 Owner rulings (2026-10-07), in the order they were made

| # | Ruling |
|---|---|
| R1 | Two branches: `port-profile` first, then `port-dashboard`. Both are full implementations. |
| R2 | **Viewport normalization** applies to every port from now on (§1). |
| R3 | **Profile is a private personal archive** — only the owner sees it. Profile Visibility, Journal Visibility and Show achievements are not built; they wait for a real social/public-profile capability (decision-register, beside business-model G2). The Edit section that held them is renamed after what remains (§8.3). |
| R4 | **Native language (L1)** is a real profile field consumed only by the per-user Korume chat context. It never sets the response language, never touches shared Knowledge, analysis artifacts or cache keys. |
| R5 | **Reminder-dependent controls are deferred** to the `study-reminders` branch: Receive learning reminders, Receive weekly report email, Preferred Study Time. That branch implements scheduler + email first, then exposes the same preferences in both `/settings` and Edit Profile from one source of truth. Edit Profile is the friendlier surface, `/settings` the complete one; a preference exposed in both has one schema, one validator, one storage. |
| R6 | **Study timezone** is a real setting and the canonical day boundary (§3). It is a foundation inside this branch, not a separate one. |
| R7 | **Hours studied** is measured by heartbeat-based active study tracking stored as UTC intervals (§5). Foundation inside this branch; Dashboard consumes it. |
| R8 | Section 1 amendments: dedicated `avatars` bucket; `native_language` is an app-validated code, not a DB enum; `username` canonicalised lowercase on write with reserved names in the same validator; reuse existing fields; XP level derived from XP; `Movies completed` → **Video lessons completed**; "since" copy does not claim pre-Korume history; Favorite Content is content taxonomy only; Learning Journey separates system milestones from Korume memories; Today's Memory is deterministic per study date. |
| R9 | Section 2 amendments: UTC evidence is the source of truth and streak is derived; XP identity is timezone-independent and daily eligibility is a separate, locked concern; timezone canonicalised with `Intl.DateTimeFormat`; the SQL change must reach every database (§13.3); DST test. |
| R10 | Section 3 amendments: `seq` gates every mutation after `start`; `start` is idempotent via `clientPresenceId`; open sessions end at their last heartbeat, never `now()`; surface taxonomy measured from real routes (§5.6); `SECURITY DEFINER` hardening is explicit. |
| R11 | Section 4 amendments: layouts computed from real container widths; Favorite Content needs activity evidence; Hours Studied states when tracking began; avatar save is transactional multipart; username uniqueness is enforced by the DB; Korume copy does not say "remember". |
| R12 | Section 5 amendments: daily XP eligibility under a per-user transaction lock with a concurrency test; `passed_at` / `mastered_at` are first-transition timestamps; avatar decode limits and corrupt-file tests, own rate limit; dirty-form guard covers every navigation; T15 split into T15/T16/T17; gates use the repo's real commands. |

### 0.3 Corrections found while writing this spec — need owner approval

Section 2 was approved on a claim I made: "streak derives directly from `xp_events`". Reading
`recordActivity` (`lib/data/gamification.ts`) and `advanceStreak` (`lib/gamification/streak.ts`) while
writing shows the claim is wrong in three ways. The design below is corrected; the corrections are:

- **C1 — `xp_events` is not complete activity evidence.** `recordActivity` advances the streak on *every*
  learning outcome, including a repeat of an item already awarded today — that repeat inserts **no**
  `xp_events` row (`ignoreDuplicates`). A day spent only on repeats would vanish from a streak derived from
  `xp_events`. **Correction:** a new append-only table `learning_outcomes` records every outcome
  `recordActivity` sees (UTC); streak derives from it. `xp_events` stays the record of *awards*.
- **C2 — the streak honours the learner's schedule.** `advanceStreak` does not break the streak across
  days that are not in `user_preferences.schedule_days` (Weekdays / Custom schedule). The derived streak
  keeps that rule and evaluates it with the **current** schedule and the **current** timezone — the same
  "projection with today's preferences, never a rewrite" semantics the owner ruled for timezone. A schedule
  change can therefore change the derived current/longest streak; no history is rewritten.
- **C3 — the XP/stats write is a read-modify-write.** `user_stats.xp` is read, incremented in the app and
  upserted, so two concurrent outcomes can lose an award. Since the daily-eligibility check must move under
  a per-user lock anyway (R12), the whole write — outcome evidence, eligibility, XP insert, `user_stats.xp`
  increment — moves into one locked SQL function (§4).

---

## 1. Viewport normalization (R2) — binds every port

Figma = visual hierarchy + proportions + component intent. It is **not** the production pixel size.

- The owner's primary review viewport is **1280×529**. Also checked: **1440×900** and **375×812**.
- Content width is computed, not copied: the app sidebar is `--layout-sidebar-width` = 224 units, so at
  1280 the content area is ≈1056px before gutters, at 1440 ≈1216px.
- **Reflow, never shrink:** typography stays on the system scale; the sidebar keeps its system size;
  content uses a sane `max-width`; card heights and spacing are recomposed (3-across → 2+1, wide + rail…),
  never scaled; no horizontal scroll; Figma's relative proportions and hierarchy survive.
- Primary content is visible at 529px height without zoom; secondary content may scroll.
- Breakpoints are **container-width** based (container queries or measured container classes), not
  viewport-only.
- **Gate:** Chrome captures at 1280×529, 1440×900, 375×812; the reviewer judges hierarchy and composition
  against the frame, not absolute pixel sizes. Sticky layouts are checked for not covering the last field
  and for `env(safe-area-inset-bottom)` on mobile.

---

## 2. Data model

Migrations follow `AGENTS.md` §6: the migration that defines an object is edited **in place**; a new object
gets a new migration file. §13.3 holds the resetability gate this rule depends on.

### 2.1 `users` — new columns

| Column | Type / rule | Notes |
|---|---|---|
| `username` | `text`, nullable, `unique`, `check (username ~ '^[a-z0-9_]{3,20}$')` | Canonicalised to lowercase **on write**; the DB stores `keishaa`, the UI renders `@keishaa`. Reserved names (`admin`, `api`, `settings`, `korume`, `profile`, `login`, `register`, …) live in the one shared validator `lib/profile/username.ts`, used by the availability check and by Save. The unique constraint is the authority (§8.4). Owner metadata only — no public URL derives from it (R3). |
| `bio` | `text`, ≤160 chars | Plain text, sanitised on render. |
| `country` | `text`, ISO 3166-1 alpha-2, app-validated | Display metadata on the owner's archive. Names localised with `Intl.DisplayNames`. |
| `study_timezone` | `text`, nullable, canonical IANA | §3. |
| `native_language` | `text`, nullable, app-validated against an allowlist in `lib/profile/languages.ts` | Not a PostgreSQL enum (R8): adding a language is a code change, never a type migration. List: `vi en ja zh ko th id fil fr de es`; display names via `Intl.DisplayNames`. |
| `target_jlpt_level` | `jlpt_level`, nullable | New: no existing field means *target level*. `users.level` is a never-maintained "current level" and `users.target_goal` is a purpose (`communication/jlpt/work`). Neither is reused for this. |
| `learning_goal` | `text`, ≤200 chars | Edit "Learning Goal" = Profile "Personal Goal". |
| `preferred_practices` | `text[]`, each app-validated, no duplicates | Closed taxonomy (R8): `shadowing listening pronunciation vocabulary kanji grammar reading conversation`. Stored as codes, never localised labels. |
| `avatar_path` | `text`, nullable | Object path inside the `avatars` bucket (§9). |

**Reused, not duplicated:** Daily Goal = `users.daily_minutes`; Subtitle Style = `user_preferences.reading_translation`;
Default Furigana = `user_preferences.reading_furigana`; Show Korume = `user_preferences.companion_enabled`;
Interface Language = the URL locale. Edit Profile writes these through the same validators and storage
paths `/settings` and the workspace reading popover already use.

### 2.2 First-transition timestamps

- `user_vocab_progress.mastered_at timestamptz null` — set by the SRS write path (`submitReview`,
  `lib/data/srs.ts`) **the first time** `srs_stage` reaches `MASTERY_THRESHOLD` (`lib/data/difficulty.ts`);
  never reset when the stage later drops; **never backfilled** (history is unknown, no date is invented).
- `user_test_attempts.passed_at timestamptz null` — set by `submitJlptTest` (`lib/data/jlpt.ts`) at submit
  time when that attempt passes under the rule in force then; never overwritten; existing attempts stay null.

### 2.3 New tables

- `learning_outcomes` (C1) — §4.1.
- `study_sessions` — §5.1.
- Both: `user_id … references users (id) on delete cascade`, RLS **owner-select only**, writes only through
  hardened RPCs (§5.3), included in `exportMyData` / `myLearningHistoryCsv` (`lib/data/user-export.ts`)
  and in the `verify:db:erasure` gate. Neither is touched by Delete Korume Memory (learning progress remains).

### 2.4 Dropped

`user_stats.streak_current`, `streak_longest`, `last_active_date` — the streak is derived (§4.3). One fact,
one home: no cache that a timezone or schedule change could leave stale. `user_stats.xp` stays (it does not
depend on day boundaries) and is incremented only inside the locked function (§4.2).

---

## 3. Foundation A — study timezone (R6, R9)

### 3.1 Storage and resolution

- `users.study_timezone` holds a **canonical** IANA name: the server computes
  `new Intl.DateTimeFormat("en", { timeZone: input }).resolvedOptions().timeZone`; a throw means invalid
  (400). `Intl.supportedValuesOf("timeZone")` only populates the picker.
- `FALLBACK_STUDY_TIMEZONE = "Asia/Ho_Chi_Minh"` applies while the column is null.
- **One-shot detection:** the `(protected)` layout passes a `needsStudyTimezone` boolean (column is null) to a
  small client effect, which then sends `Intl.DateTimeFormat().resolvedOptions().timeZone` once. The server writes it with `update users set study_timezone = $1 where id = auth.uid()
  and study_timezone is null` — the first write wins, later detections and other tabs are no-ops. Travel
  never changes it; only the learner does, in Edit Profile.

### 3.2 One module

`lib/time/study-day.ts` replaces `lib/time/vn-timezone.ts`:
`studyDate(instant, tz)`, `studyDayStart(date, tz)`, `studyDayEnd(date, tz)`, `studyDaysAgo(instant, now, tz)`,
and `getStudyTimezone()` (React `cache`, one read per request). Day boundaries come from the timezone
calendar — a local day may be 23 or 25 hours long; `start + 24h` is forbidden.

### 3.3 Sites moved to the study timezone (measured 2026-10-07)

| Kind | Sites |
|---|---|
| Day logic | `lib/gamification/{streak,source-id,index,types}.ts`, `lib/data/pronunciation-metrics.ts`, the dashboard page, the pronunciation page, `components/learning/streak-card.tsx` |
| Date display | `components/companion/journal-view.tsx`, `components/settings/deletion-pending-banner.tsx`, `lib/email/templates/account-deletion-requested.ts` |
| Formatter | `lib/i18n/request.ts` gets `timeZone` = the learner's study timezone, so every `useFormatter` date renders the same day on server and client |
| SQL | `pronunciation_daily_means` and `pronunciation_recent_practice` in `20260712000001_schema.sql` take `p_tz text` (edited in place) |

### 3.4 The one exception

`lib/leaderboard/week.ts` keeps one **shared** competition week for every user: its own constant
`LEADERBOARD_WEEK_TIMEZONE`, documented as such and never called "study timezone". A shared artifact is
never personalised (same principle as R4).

### 3.5 History

Event timestamps stay UTC and are never rewritten. Every day bucket — streak, daily XP eligibility, heatmap,
speaking metrics, study time — is a projection of UTC evidence into the **current** study timezone. After a
timezone change some events near midnight move to the neighbouring day; that is accepted (R6).

### 3.6 Invariant guard

A test scans production source (`app/ lib/ components/`, excluding tests) and active SQL
(`supabase/migrations/*.sql`) for `Asia/Ho_Chi_Minh` and allows exactly the declarations of
`FALLBACK_STUDY_TIMEZONE` and `LEADERBOARD_WEEK_TIMEZONE`. It asserts the scanned file set is non-empty and
of the expected order of size, ignores comments, and is mutation-checked (insert a hardcode → red → restore),
per `AGENTS.md` §7.

---

## 4. Foundation A2 — learning outcomes, XP identity, derived streak (R9, C1–C3)

### 4.1 `learning_outcomes`

`id uuid pk`, `user_id`, `source_type` (the `xp_events` source set), `item_key text not null` (≤128),
`created_at timestamptz default now()`. Index `(user_id, created_at)`. One row per call of `recordActivity`,
whether or not XP is awarded. Append-only; no update/delete grant to `authenticated`.

### 4.2 `record_learning_outcome` — one locked SQL function

`recordActivity` keeps its contract (never throws into the caller) but delegates the write to
`record_learning_outcome(p_user, p_source, p_item_key, p_xp, p_tz)` (`SECURITY DEFINER`, called with the
service client as today; hardened per §5.3 except that the user id is a parameter because the caller is the
server, never the browser). Inside **one transaction**, after `pg_advisory_xact_lock(hashtext('xp:'||p_user))`
(the authoritative check lives under the lock — `docs/lessons.md` L-040):

1. insert the `learning_outcomes` row;
2. decide eligibility:
   - **once-only sources** (`conversation`): eligible iff no `xp_events` row with that
     `(user, source_type, source_id)` exists;
   - **daily sources** (`srs_review`, `dictation`, `shadowing`, `mining_review`, `jlpt_submit`,
     `reading_submit`): eligible iff no `xp_events` row for `(user, source_type, source_id)` has
     `created_at` inside today's `[studyDayStart, studyDayEnd)` in **`p_tz`, the current study timezone**.
     Prior awards are re-projected into the current zone, so changing timezone cannot open a second award
     inside the same real day; a new award needs a real local midnight to pass;
3. if eligible, insert the `xp_events` row and `update user_stats set xp = xp + p_xp`;
4. return `{ xpAwarded, prevXp, nextXp }` for level-up and badge evaluation.

`source_id` (`sourceIdFor`, `lib/gamification/source-id.ts`) **no longer contains a date**:
`itemType:itemId`, `lineId`, `cardId`, `testId:mode`, `passageId`, `sessionId`. The `xp_events` unique
constraint on `(user_id, source_type, source_id)` is replaced by a partial unique index covering only the
once-only sources; daily uniqueness is enforced by the lock. The function's grants: `revoke from public, anon,
authenticated`; `grant execute to service_role`.

### 4.3 Derived streak

`study_streak(p_user, p_tz, p_schedule smallint[], p_today date) returns (current int, longest int,
last_active date)` — distinct `studyDate(created_at, p_tz)` over `learning_outcomes`, then gaps-and-islands
where a gap made only of unscheduled ISO weekdays does not break a run (C2), and the current run is alive if
its last day is today or every day between it and today is unscheduled. Readers: `getUserStats`
(`lib/data/user-stats.ts`), badge evaluation inside `recordActivity`, the streak card, the Profile Quick
Stats. Streak badges are evaluated at activity time with this function.

---

## 5. Foundation B — study time (R7, R10)

### 5.1 `study_sessions`

`id uuid pk`, `user_id`, `client_presence_id uuid not null`, `segment_no int not null default 0`,
`surface text not null` (closed list §5.6, `check` constraint), `context_id text null` (≤128, shape-checked
per surface, ids only — never titles, transcripts, queries or chat text), `started_at`, `last_heartbeat_at`,
`ended_at null`, `last_seq int not null`. Unique `(user_id, client_presence_id, segment_no)`. All timestamps
UTC, all written by the server clock.

### 5.2 `study_heartbeat` RPC and `POST /api/study/heartbeat`

Body (zod): `{ clientPresenceId, sessionId?, surface, contextId?, seq, kind: "start" | "beat" | "stop" }`.
Rate-limited per user. Response: `{ sessionId, acceptedSeq, segmented }`.

- **start** — idempotent on `(user, clientPresenceId)`: returns the presence's current open segment if one
  exists; otherwise creates segment `max+1` with `started_at = last_heartbeat_at = now()`. A lost response
  plus a retry yields exactly one logical active session. Opportunistically closes the same user's stale
  open sessions at their `last_heartbeat_at` (hygiene only; correctness never depends on it).
- **beat / stop** — effective only when the session belongs to the caller, is open, and `seq > last_seq`;
  otherwise a no-op that returns the current state. A delayed stale `stop` after a newer `beat` changes
  nothing.
  - **beat:** if `now() − last_heartbeat_at > SESSION_GAP` the segment is closed at its
    `last_heartbeat_at` and a new segment is opened (`segmented: true`, new `sessionId`); the gap is never
    counted. Otherwise `last_heartbeat_at = least(now(), last_heartbeat_at + MAX_EXTENSION)`.
  - **stop:** `ended_at = last_heartbeat_at`.
- A beat aimed at a closed session is ignored and **never** opens a segment.
- **Duration is `coalesce(ended_at, last_heartbeat_at) − started_at`. Never `now()`.** A lost final
  heartbeat cannot create ghost time; the cost is a bounded under-count (≤ one interval), preferred to any
  over-count.
- Constants in one module shared by client and server (`lib/study-time/constants.ts`): `HEARTBEAT_MS` 30 s,
  `INACTIVITY_MS` 120 s, `MAX_EXTENSION` 45 s, `SESSION_GAP` 90 s. Tuning a constant never changes the model.
- No XP, no Journey Point, no reward of any kind is derived from minutes.

### 5.3 `SECURITY DEFINER` hardening (explicit)

The function reads the user from `auth.uid()` inside its body and refuses null; it accepts no `user_id`
from the client; `set search_path = public`; `revoke execute … from public, anon`; `grant execute … to
authenticated`; every ownership check is server-side. Verified live against the real `authenticated` and
`anon` roles (L-005), never by the mock.

### 5.4 Client — `useStudyPresence({ surface, contextId, mediaPlaying? })`

- One `clientPresenceId` per hook mount.
- **Active** = `document.visibilityState === "visible"` AND (`mediaPlaying` OR a study interaction within
  `INACTIVITY_MS`). Interactions: `pointerdown`, `keydown`, `wheel`, `scroll`, `selectionchange`,
  `touchstart`, `focusin`, and explicit surface signals (card open, mini-player).
- While active: beat every `HEARTBEAT_MS`. When inactive: send nothing (the server's gap rule closes it).
  On `pagehide`: `stop` via `navigator.sendBeacon` — an optimisation, not a correctness requirement.
- On `segmented: true` the hook swaps to the new `sessionId` immediately.
- `mediaPlaying` comes from the workspace `player-adapter`; a playing video counts with no input events.

### 5.5 Reading — `study_time(p_tz, p_from, p_to)`

`security invoker`, scoped to `auth.uid()`, aggregation entirely in SQL (L-041):

1. take the caller's intervals `[started_at, coalesce(ended_at, last_heartbeat_at))`;
2. **merge overlaps** (sort by start, running max end) so two tabs never count one real minute twice;
3. split at local midnights from `generate_series` over `studyDayStart` boundaries computed with
   `at time zone p_tz` (DST-correct) — a 23:50–00:20 session gives 10 min to day N and 20 to day N+1;
4. return per-day seconds and the total for the range.

`trackedSince` = the caller's earliest `study_sessions.started_at` (null if none).

### 5.6 Surfaces (measured from routes, 2026-10-07)

| `surface` | Producer | `context_id` |
|---|---|---|
| `shadowing` | `(focus)/shadowing/[id]` workspace (incl. the in-lesson Korume popup) | video uuid |
| `dictation` | `(focus)/shadowing/[id]/dictation` | video uuid |
| `summary` | `(focus)/shadowing/[id]/summary` | video uuid |
| `srs_review` | `/kanji/review`, `/mining/review`, `/vocab/review` | `kanji` \| `mining` \| `vocab` |
| `kanji` | `/kanji/[id]` | kanji uuid |
| `certification` | `/certification/[id]` | test uuid |
| `conversation` | `/conversation` (`ConversationApp`) | conversation uuid |
| `korume_chat` | `/korume/chat` | thread uuid |

Not tracked, with reason: `pronunciation` and `listening` workspace modes are `complete: false` in
`LEARNING_MODES` — their branch adds the surface; `/grammar` is a reference list with no practice;
`/reading/[id]` is hidden by IA ruling A10. Adding a surface = edit the `check` in place + one producer.

---

## 6. Profile semantics (R3, R4, R8, R11)

| Frame label | Source | Notes |
|---|---|---|
| Avatar, display name, `@handle`, bio | `avatar_path`→OAuth `avatar_url`→initials; `users.name`; `username`; `bio` | Bio shown under the handle on `/profile` too: the Edit preview "renders the profile as it will look". |
| Header "Korume · since …" | month of `users.created_at` | The account relationship. |
| "Learning Japanese since" → **"Learning with Korume since …" / "Học cùng Korume từ …"** | month of the earliest of `learning_outcomes.created_at` and `study_sessions.started_at` | Korume does not know pre-Korume history and the copy does not claim it. Row hidden until there is a first activity. |
| Country, Native Language, JLPT Goal | `country`, `native_language`, `target_jlpt_level` | JLPT Goal is a goal, never a competency. |
| Current Interface | the URL locale | |
| Current Subtitle | composed label from `reading_translation` + `reading_furigana` | |
| Study Streak | `study_streak` (§4.3) | |
| **Current Level → `Lv. {n}`** | `levelForXp(user_stats.xp)` (`lib/gamification/level.ts`) | `users.level` is never maintained and is not a source. No title system ("Explorer") is invented. A JLPT journey level belongs to `port-dashboard` and will be labelled distinctly. |
| Total XP | `user_stats.xp` | |
| **Movies Completed → "Video lessons completed"** | `count(*)` of `user_video_progress` with `completed_at is not null` | Label states exactly what `completed_at` proves. |
| Words Learned | SQL `count(*)` of `user_vocab_progress` with `srs_stage >= MASTERY_THRESHOLD` | Same "known" definition as adaptive furigana and i+1. |
| Hours Studied | `study_time` total | Keyboard-focusable hint: **"Tracked by Korume since {trackedSince}"**. No lifetime claim before instrumentation; with no sessions the value is `0m` and the hint says tracking starts with the next study session. |
| Learning Journey | §6.1 | |
| Favorite Learning Content | §6.2 | |
| Personal Goal | `learning_goal` | Empty → invitation linking to `/profile/edit`. |
| Korumeship | `first_meeting` memory → "walking together for N months"; **Open Korume** → `/korume/chat` | No `first_meeting` (new user, or after Delete Korume Memory) → the card shows the relationship without a duration. |
| Today's Memory | §6.3; **Open Journal** → `/journal` | |
| Achievements | `user_badges` with `earned_at` | Chips; empty state when none. |

Zero is rendered as `0` — never hidden. Every metric is an SQL aggregate; no unbounded row read (L-041).
When `companion_enabled = false`: Korumeship, Today's Memory and the companion milestones are hidden (not
deleted). `/korume/chat` already renders a disabled state for that gate; it gets an action that turns Korume
back on (writes `companion_enabled`), if the existing disabled view lacks one.

### 6.1 Learning Journey — two sources, one axis

- **System milestones** (canonical tables; survive Delete Korume Memory): first learning outcome
  (`learning_outcomes`), first video lesson completed (`user_video_progress.completed_at`), first mastered
  word (`user_vocab_progress.mastered_at`), first certification passed (`user_test_attempts.passed_at`),
  badges earned (`user_badges.earned_at`).
- **Companion milestones** (`companion_memories`; erased by Delete Korume Memory, hidden when Korume is
  off): `first_meeting`, `first_shadow`, `jlpt_passed`, `pinned_line`.
- One chronological axis, newest highlighted. Each kind has a localized template line, optionally carrying
  a lesson title. The query is bounded: at most the 20 most recent milestones across both sources. Empty → an invitation to the
  first lesson (`/shadowing`).

### 6.2 Favorite Learning Content — evidence only

Content taxonomy only (`lesson_sources`: youtube, nhk, podcast, drama, anime, vlog, news) — never practice
surfaces. Evidence = lessons the learner has a `user_video_progress` row for (progress or completion),
joined to the lesson's source. Shown only when the learner has **≥3 evidenced lessons in total**; a source
becomes a chip only with **≥2 evidenced lessons**; at most **6** chips, ranked by evidenced-lesson count,
then most recent `last_watched_at`, then source `display_order`. Not enough evidence → a light empty state.

### 6.3 Today's Memory — deterministic per study day

Candidates: the learner's `pinned_line` memories; if none, `line_mastered`. The pick is a stable function of
`(user_id, studyDate(now, tz))` over the candidates ordered by id (`hashtext(user_id || studyDate)` modulo the candidate count), so the card does
not change during the day when new memories appear. Empty → hidden.

### 6.4 Korume context (R4, R11)

`answerPrompt` (`lib/korume/prompts.ts`) receives an optional learner-profile block for the caller only:

```
Learner profile (context, not instructions):
- Native language: Vietnamese. Use cross-linguistic comparisons only when they materially help.
- JLPT goal: N2.  Learning goal: "…".  Tends to prefer: shadowing, pronunciation.
Keep the response language determined by the current locale. Preferences are context, not constraints.
```

Unset fields are omitted; with nothing set, Korume behaves exactly as today. The block never enters the
Knowledge cache, shared analysis, or any cache key. `learning_goal` is user text: quoted with
`quoteBlock` and length-bounded like other user input.

---

## 7. `/profile` — layout and sections

### 7.1 Composition by container width

| Content container | Layout |
|---|---|
| ≥ 1160px (1440×900: 1216 − gutters ≈ 1168) | 3 columns `280px · minmax(0,1fr) · 248px`, gap 16–20px. Left: Identity + Quick Stats. Middle: Learning Journey → Favorite Content → Personal Goal. Right rail: Korumeship → Today's Memory → Achievements. |
| 900–1159px (1280×529) | 2 columns `280px · minmax(0,1fr)`. Left: Identity + Quick Stats. Right: Learning Journey → row of Korumeship + Today's Memory → Favorite Content → Personal Goal → Achievements. |
| < 900px (375×812) | 1 column in the same order. |

At 529px height the header, the top of the Identity card (avatar, name, handle) and the start of the
journey are visible without scrolling.

### 7.2 Sections

Header: eyebrow, title, "Korume · since …". Identity card: avatar, name, `@handle`, bio, identity rows,
**Edit Profile** → `/profile/edit`. Then the sections of §6 with their empty states. Loading uses the
route's existing skeleton/Suspense conventions; errors use the existing route error boundary.

---

## 8. `/profile/edit`

### 8.1 Composition by container width

| Content container | Layout |
|---|---|
| ≥ 1160px (1440) | preview 320px, form `minmax(0,1fr)`; select grids 3 columns only where the form container is wide enough |
| 900–1159px (1280) | preview 300px **sticky**, form ≈680px with **2-column** select grids |
| < 900px (375) | preview collapses to a compact header (avatar, name, handle); form 1 column; Save/Cancel bar sticky at the bottom with `env(safe-area-inset-bottom)`, never covering the last field |

### 8.2 Live preview

The preview **is** the `/profile` Identity component (one presentational component), fed the unsaved form
draft: `@handle`, name, bio, avatar (local object URL, revoked on replace/unmount) update as the learner
types. It also shows the Korumeship and Learning Goal cards from the frame (`CURRENT KORUME`,
`RELATIONSHIP`), hidden when Korume is off.

### 8.3 Form

- **Basic Information:** Display Name · Username · Bio · Country · Timezone (picker over
  `supportedValuesOf` with search) · Native Language · Target JLPT · Daily Goal · Learning Goal.
- **Learning Preferences:** Interface Language · Subtitle Style · Default Furigana · Preferred Practice
  (multi-select chips, closed taxonomy).
- **Korume:** Show Korume (`role="switch"`, writes `companion_enabled`). The frame's "Privacy" section is
  renamed because only this control survives R3.
- Not rendered: Profile Visibility, Journal Visibility, Show achievements (R3); Receive learning reminders,
  Receive weekly report email, Preferred Study Time (R5).
- Footer: Cancel / Save, with Korume and the line **"Korume will use these choices to support you better."**
  (vi: "Korume sẽ dùng những lựa chọn này để hỗ trợ bạn phù hợp hơn.") — shown only when Korume is on. Not
  "remember": these are structured profile context, not Korume Memory records.

### 8.4 Save, validation, navigation

- `PATCH /api/profile`, **`multipart/form-data`**: a JSON profile part validated by the one zod schema shared
  with the client, plus an optional avatar file. Own rate limit (upload + CPU work).
- Username: canonicalised lowercase; a debounced availability endpoint gives early feedback using the same
  validator; **the DB unique constraint is the authority** — a unique violation at Save returns 409 and is
  mapped onto the Username field. The same holds for every field error: `aria-describedby`, focus moves to
  the first invalid field.
- On success: clear the dirty state, then — if Interface Language changed — navigate to the same path in the
  new locale; else go to `/profile`.
- **Dirty guard:** in-app navigation away (Cancel, sidebar, browser Back, any route change) opens the app's
  dialog; tab close/reload uses native `beforeunload` (browsers allow no custom dialog there).

---

## 9. Avatar pipeline (R8, R11, R12)

- **Bucket `avatars`**, private, separate from `recordings` (different lifecycle, MIME, cache, retention).
  Object path `{uid}/profile/{random}.webp`; RLS on `storage.objects` scoped to the first folder =
  `auth.uid()`; the server writes with the service client.
- Client: JPEG/PNG/WebP, ≤2 MB, local preview only; uploaded only at Save.
- Server: check MIME and magic bytes; **decode with `sharp`** (already a dependency) with a pixel limit
  (`limitInputPixels` = 40 000 000) so a small file cannot decode to a huge image; a corrupt or truncated
  file fails decode → 422; auto-orient → resize to 512×512 cover → **re-encode to WebP, which drops all
  metadata (EXIF/GPS)**. The re-encoded output is the only thing stored.
- Transaction: upload the new object → update `avatar_path` → if the DB update fails, delete the new object;
  if it succeeds, delete the previous object best-effort.
- Display resolver (one function): `avatar_path` → short-lived signed URL; else OAuth `avatar_url`; else
  initials. Forum, playlists and peer review (`lib/data/{forum,playlists,peer-review}.ts`) switch to it.
- The removal control is labelled **"Remove uploaded photo"** / "Xóa ảnh đã tải lên" — removing the custom
  photo brings the account (OAuth) picture back, so "delete avatar" would be false.
- Account deletion removes the `avatars/{uid}/` folder (erasure gate covers it).

---

## 10. Privacy and data lifecycle

| Data | Account deletion | Delete Korume Memory | Export |
|---|---|---|---|
| new `users` columns | yes (row cascade) | no | yes |
| `learning_outcomes`, `study_sessions` | yes (cascade) | no | yes |
| `mastered_at`, `passed_at` | yes (cascade) | no | yes |
| `avatars/{uid}/` objects | yes | no | listed |
| companion milestones, Today's Memory, Korumeship duration | yes | **yes** | as today |

---

## 11. Test matrix (floor, not ceiling — L-013)

**Timezone:** same instant is day N in `Asia/Ho_Chi_Minh` and N−1 in `America/Los_Angeles` → streak, daily
XP eligibility, speaking metrics, `pronunciation_daily_means`, `study_time` bucket correctly · DST days of
23 h and 25 h in Los Angeles · one-shot detection does not overwrite · invalid zone → 400, alias canonicalised
· timezone change → streak recomputed · timezone change → the same source cannot earn XP twice in one real
day · guard red when a hardcode is inserted (mutation), file set non-empty.

**Outcomes / XP:** a repeat outcome with no XP still counts for the streak (C1) · unscheduled-day gaps do
not break the streak; changing `schedule_days` re-derives it (C2) · **N concurrent `record_learning_outcome`
calls for the same daily source → exactly one `xp_events` row and `user_stats.xp` incremented once** (C3,
live DB) · once-only source unique.

**Study time:** hidden tab adds nothing · paused media adds nothing · playing video counts with no input ·
inactivity > `INACTIVITY_MS` stops · duplicate/stale `seq` adds nothing · rapid beats cannot outrun real time
· lost last heartbeat → no ghost time · session across local midnight splits 10/20 · timezone change keeps
the total, moves buckets · two tabs on one context, and two different surfaces at once, never double-count ·
user A cannot extend user B's session · **delayed stale `stop` after a newer `beat` does not close** ·
**lost response + `start` retry with the same `clientPresenceId` → exactly one logical session** · beat to a
closed session never opens a segment.

**Profile data:** username case and reserved names; 409 mapped to the field · `mastered_at` set once, not
reset on stage drop · `passed_at` set once, not overwritten · Favorite Content thresholds and tie-breaks ·
Today's Memory stable within a study day · Korume off hides exactly the companion parts · L1/goal/practices
reach `answerPrompt` and never a shared cache key.

**Avatar:** wrong MIME/magic → 415/422 · oversize bytes · oversize decoded pixels · truncated file → 422 ·
output has no EXIF · DB failure deletes the new object · object URL revoked.

**RLS / grants (live, L-005):** another user reads nothing from `study_sessions`/`learning_outcomes`;
`anon` cannot execute the RPCs; `authenticated` cannot execute `record_learning_outcome`; tables in export
and in the erasure gate.

**Mutation:** every guard written over existing code is broken once and seen red (`AGENTS.md` §7).

---

## 12. Tasks

Each task is one dispatch with its own independent `code-reviewer` before commit. Gates are scheduled
inside the first task that can break them (L-029).

| # | Task | Depends |
|---|---|---|
| T1 | `study-day.ts`, `users.study_timezone`, canonicalisation, one-shot detection, next-intl `timeZone`, display sites, invariant guard | — |
| T2 | `learning_outcomes`; `record_learning_outcome` (locked, eligibility in the current zone); date-free `source_id`; partial unique; `recordActivity` delegates; concurrency test (live) | T1 |
| T3 | `study_streak` (schedule-aware); drop the three `user_stats` columns; `getUserStats`, badges, streak card read it | T2 |
| T4 | `pronunciation_daily_means` / `pronunciation_recent_practice` take `p_tz`; `pronunciation-metrics.ts` | T1 |
| T5 | `study_sessions`; `study_heartbeat` (seq, presence, segments, hardening); `POST /api/study/heartbeat` + rate limit | T1 |
| T6 | `study_time` (merge, midnight split, DST), `trackedSince`; export + erasure gate | T5 |
| T7 | `useStudyPresence`; wire the 8 surfaces of §5.6 (media from `player-adapter`) | T5 |
| T8 | Profile schema (§2.1), `mastered_at` in `submitReview`, `passed_at` in `submitJlptTest`; validators `lib/profile/{username,languages,practices}.ts`; `avatars` bucket + RLS; export + erasure | T1 |
| T9 | Profile data layer: identity, Quick Stats, Learning Journey, Favorite Content, Korumeship, Today's Memory, Achievements — SQL aggregates | T3, T6, T8 |
| T10 | Korume learner-profile context in `answerPrompt` | T8 |
| T11 | `/profile` UI, three container layouts, empty states | T9 |
| T12 | `PATCH /api/profile` multipart, avatar pipeline, avatar resolver migrated to forum/playlists/peer review | T8 |
| T13 | `/profile/edit` UI: form, live preview, availability check, dirty guard, locale navigation, sticky bar; Korume re-enable action on `/korume/chat` if missing | T11, T12 |
| T14 | Integration/E2E + mutation tests, incl. live-DB tests for timezone, XP race, heartbeat/RLS, avatar | T13 |
| T15 | Docs: screen registry (`profile` stamped `figmaCheckedAt: "2026-10-07"`; `edit-profile` → route `/profile/edit`, `impl: "built"`, chrome `app`); decision-register (R3 beside G2, R4, R5, R6, R7, C1–C3); the `settings-page.tsx` header comment; deploy notes | T14 |
| T16 | Full gates (§13), 3-viewport Chrome capture, independent whole-branch review, fix wave + its own review, then the owner's Chrome review | T15 |

---

## 13. Gates

### 13.1 Commands (the repo's real scripts)

`npm run typecheck` · `npm run lint` (never `npx eslint`, L-018) ·
`npm test -- --minWorkers=1 --maxWorkers=2 --reporter=dot` (L-035; never alongside Playwright) ·
`npm run test:e2e` with `AI_PROVIDER=none`, `:3000` stopped first (L-017), `.env.local` present (L-020) ·
`npm run verify:protocol` · `npm run verify:db:erasure` · `npm run verify:db:pronunciation` ·
`npm run verify:db:korume` · `npm run verify:db:settings` · a new `npm run verify:db:profile` live gate
(timezone buckets, XP race, heartbeat semantics, RLS/grants, avatar bucket policy) on a **fresh**
`npx supabase db reset`.

### 13.2 Order

The unit gate runs **after the last edit**, including edits a live or e2e check provoked. The whole-branch
review runs even though every task was reviewed (L-011); its fix wave gets its own review (L-012).

### 13.3 Resetability gate

`AGENTS.md` §6 edits migrations in place because every environment applies the chain with
`npx supabase db reset` and nothing has been published. Before merge, confirm no non-resettable database
exists (no deployed persistent Supabase for almostgone.vn). If one does, **stop**: that rule must change
first, deliberately, and this branch then ships forward migrations — never silently.

### 13.4 Visual

Chrome at 1280×529, 1440×900, 375×812 for `/profile` and `/profile/edit` (populated and empty learner),
judged on hierarchy/reflow against frames `66:166` / `67:595`. Then the owner's Chrome review; merge
`--no-ff` only after approval.

---

## 14. Deferred, with destinations

| Item | Destination |
|---|---|
| Profile / Journal Visibility, Show achievements, public profile | future social / public-profile capability (decision-register, beside G2) |
| Receive learning reminders, weekly report email, Preferred Study Time | `study-reminders` branch (R5) |
| `pronunciation`, `listening` study surfaces | the branches that complete those workspace modes |
| JLPT journey level, Today's Mission, Journey Point, Weakness Snapshot, Weekly Evolution, heatmap | `port-dashboard` (consumes §3 and §5) |

No open questions remain other than §0.3.
