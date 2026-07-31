# Shadowing Hub, Lesson Workspace & Content Monetization — Design

> **Status:** Approved by user (Trần Nguyễn Phi Long / Keishaa) on 2026-07-31, brainstormed in
> conversation. Ready for `superpowers:writing-plans`.
> **Relationship to existing specs:**
> - **Executes and extends** `2026-07-29-shadowing-hub-consolidation-design.md` (Draft, approved,
>   never executed). That spec's §0–§5 (Hub → Lesson IA, naming invariant, Companion boundary,
>   Hub/Dashboard split, route/terminology table) are the foundation this spec builds on and does
>   **not** re-litigate. Its §6 file-change list (17 files) still applies; this spec's own §9 below
>   folds new content into the same Phase 2 rewrites rather than doing them twice.
> - **Narrows** `L9b Plan 1` (launch-blocker debt brainstorm, in progress). Its "transcript-submit
>   UI" item (backlog #14, `feature_backlog_deferred.md`) is fully superseded by this spec's §2
>   (Create Lesson pipeline). Plan 1 keeps only: GDPR delete-all-my-data, persist voice-mode
>   pronunciation score, badge icons.
> - **Amends** `business-model.md` — Principle 3 rewrite (§3.4 below), a new import/library-access
>   row in the Free/Premium table, and a new philosophy statement on what Nihongo Cinema sells.
> **Trigger:** User provided two Figma reference exports (`public/demo/image.png`,
> `public/demo/image1.png` — the same references that triggered the Consolidation spec) and asked
> to correct the assistant's understanding of the video-import/transcript mechanism, which grew
> into a full domain-model and Lesson-workspace redesign.

---

## 0. Guiding principles (read these before any section below)

These were arrived at over the course of the brainstorm and govern every decision in this doc.
Where a section seems to make an unusual call, it is following one of these.

1. **A Lesson is canonical and singular.** Deduplicated by `youtube_video_id`. Everything else —
   Collections, My Library, Bookmarks, Favorites, Continue Learning, Featured — is a **view** onto
   that one Lesson, never a copy. No feature may fork or duplicate lesson data (transcript, AI
   knowledge, timestamps) to serve its own presentation. Stated as the single sentence to test any
   future addition against: **Lesson is the canonical learning object. Everything else is a
   projection of a lesson.** Shadowing Hub is a projection (a way of listing lessons). Collections
   are a projection (a way of grouping them). My Lessons, Continue Learning, and Featured are each a
   projection (a filter/view over them). Pronunciation, Dictation, and Summary are projections too (a
   way of practicing/understanding one). A future feature (Conversation, Roleplay, Listening Test)
   should always be checked against this sentence before it's built: if it's really just another
   projection of a Lesson, it's a new Learning Mode, not a new entity (§1's Domain Model at a glance
   restates this as a diagram).
2. **`library_access` is a publishing state, not a permission system, and not a tag.** It answers
   exactly one question — *"where is this Lesson published?"* (`PRIVATE | FREE | PLUS`) — and nothing
   else. Discovery/curation concerns (Featured, genre, seasonal) are a **separate** concept
   (Collections, §1.4) so the enum never has to grow to express them.
3. **Nihongo Cinema does not sell lesson quality. It sells library breadth and lesson-creation
   ability.** Once a learner can open a Lesson, Free and Plus get the *identical* learning
   experience inside it — full transcript, every Learning Mode, every Reading Setting. The
   difference is *how many* Lessons you can open and *whether you can mint new ones from your own
   YouTube links*. This directly rewrites `business-model.md` Principle 3 — see §3.4.
4. **A Lesson is a learning workspace, not a single activity.** Shadowing, Pronunciation,
   Dictation, and Summary are different ways of practicing/understanding the *same* Lesson, sharing
   one transcript, one timeline, one progress record. The learner never feels like they left the
   Lesson to use a different tool.
5. **Summary understands the lesson. Companion understands the learner.** Summary is a read-only
   aggregation of *this Lesson's* own data (transcript, vocab, grammar, the learner's own
   session/attempt records for this lesson). It is not a chatbot, has no "Ask AI" box, and never
   reasons across lessons. Companion reasons across the learner's *entire* history and lives outside
   the Lesson entirely (Hub, Dashboard, `/journal`) — unchanged from the Consolidation spec's
   Learning Loop Boundary (`design-reconciliation.md` §4). **Lesson is the unit of learning.
   Companion is the unit of coaching.** This boundary is what lets future Learning Modes (Speaking
   Drill, Recall, Roleplay, Quiz, ...) be added indefinitely without ever touching Companion's
   architecture.

---

## 1. Domain model

**At a glance** — the full shape this brainstorm converged on, gathered in one place so it survives
independently of the discussion that produced it. Everything here is detailed, with rationale, in
§1.1–§1.5 and §6 below; treat this block as a locator/index, not a substitute for reading those.

```
Lesson (aggregate root — the DB table stays `videos`, §1.1; product vocabulary is "Lesson")
│
├── Transcript / Transcript Lines        (existing)
├── Vocabulary / Grammar                 (existing)
├── Shadowing Sessions                   (existing — also backs Pronunciation Mode)
├── Dictation Attempts                   (existing)
├── Progress (per-mode, per-sentence)    (§6.3 — computed, no new schema)
│
├── library_access: PRIVATE | FREE | PLUS      — publishing state ONLY (§1.2). Never means
│                                                 Featured/curated/pending — those are Collections.
├── user_lesson_library(user_id, lesson_id)    — "My Lessons" + dedup ledger, never copies lesson
│                                                 data (§1.3)
└── lesson_collections × collections           — many-to-many curation/discovery, entirely separate
                                                  from library_access; Featured is just a collection,
                                                  not a fourth access state (§1.4)

Lesson Workspace (§6) — three independent axes + one utility, not a flat tab set:
├── Learning Mode   "what skill?"     — Shadowing / Pronunciation / Dictation / Summary
├── View Mode       "see it how?"     — Reading / Normal / Immersion (exists only inside Shadowing)
├── Reading Settings "UI behavior?"   — Font, Subtitle Size/Color, Speed, Auto Pause, Repeat, ...
└── Analysis        a per-sentence utility (highlight → Analyze) — not a mode, not a screen, not a tab

Companion — Dormant throughout every Learning Mode, always. It reasons across the learner's whole
history and lives outside the Lesson entirely (Hub, Dashboard, /journal). Summary reasons only about
THIS lesson and is not a chatbot. See §0 principle 5.
```

### 1.1 Lesson (`videos` table — kept as-is at the DB layer)

Renaming the physical table `videos` → `lessons` (and the ~6 FK columns named `video_id` across
`transcripts`, `shadowing_sessions`, `dictation_attempts`, `user_video_progress`,
`vocab_examples.source_video_id`, `user_playlist_items`) is a large, low-risk-but-wide refactor with
no functional payoff today. **Deferred**, same pattern the Consolidation spec used for route/folder
renames: product vocabulary says "Lesson" everywhere from this spec forward; the DB keeps `videos`
until a dedicated follow-up. New tables introduced by this spec use "lesson" in their own names
(`user_lesson_library`, `lesson_collections`) since they have no legacy to carry.

### 1.2 `library_access` — replaces `status`

```sql
create type lesson_access_level as enum ('PRIVATE', 'FREE', 'PLUS');

alter table videos add column library_access lesson_access_level not null default 'PRIVATE';
-- backfill: approved -> 'FREE' (safe default; admin re-tiers individually post-migration),
--           pending  -> 'PRIVATE'
alter table videos drop column status;
drop type video_status;
```

- `PRIVATE` — only visible/usable by users who hold a row in `user_lesson_library` for it (§1.3).
  Set on every self-created Lesson. No moderation queue gates *usability* anymore — a learner's own
  Lesson works the moment its transcript is ready, full stop.
- `FREE` — published to the public library, any authenticated user can open it.
- `PLUS` — published to the public library, visible to everyone (card + metadata, per
  business-model.md §5 "show don't tell"), but opening it requires an active Plus subscription.
- Only admin (service-role) writes this column. `videos_insert` RLS is narrowed to always insert
  `library_access = 'PRIVATE'` — self-promotion at insert time stays impossible, same guarantee the
  old `status = 'pending'` check gave.

**Access check lives in exactly one place:** the `videos_read` RLS policy. `transcripts_read` /
`transcript_lines_read` keep their existing shape (join to `videos`, mirror its predicate) — **no
new logic there**. Once a learner clears the Lesson-level gate, every table one join away is already
open. This is the direct implementation of Principle 3 (§0.3): there is no code path that can serve
a degraded transcript to Free users, because content tables never re-check tier at all.

```sql
create policy videos_read on videos for select to authenticated using (
  library_access = 'FREE'
  or (library_access = 'PLUS' and exists (
       select 1 from subscriptions s
       where s.user_id = auth.uid() and s.plan <> 'free' and s.status = 'active'
     ))
  or (library_access = 'PRIVATE' and exists (
       select 1 from user_lesson_library l
       where l.user_id = auth.uid() and l.lesson_id = videos.id
     ))
);
```

`transcripts_read` / `transcript_lines_read`: replace their current `v.status = 'approved' or
v.added_by_user_id = auth.uid()` predicate with the same three-branch condition above (copy, not a
new concept).

### 1.3 `user_lesson_library` — personal library / dedup ledger

```sql
create table user_lesson_library (
  user_id uuid not null references users (id) on delete cascade,
  lesson_id uuid not null references videos (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create policy user_lesson_library_read on user_lesson_library for select to authenticated
  using (user_id = auth.uid());
create policy user_lesson_library_insert on user_lesson_library for insert to authenticated
  with check (user_id = auth.uid());
```

Only meaningful for `PRIVATE` lessons — `FREE`/`PLUS` lessons never need a row here, they're already
open to everyone in-tier via §1.2's RLS directly. This table is **the** monthly-quota ledger (§3.2)
and **the** dedup mechanism (§2): a second user pasting an already-`PRIVATE` video's URL — one that
already has a transcript — gets a row inserted here, no new `videos` row, no re-fetch, no AI call. A
row is inserted only once a lesson actually has a transcript (§2.1), never for an orphaned
no-caption attempt.

**Important implementation note:** the "does this `youtube_video_id` already exist" lookup inside
Create Lesson (§2) must run through the **service-role client**, not the request-scoped RLS client —
an ordinary authenticated client cannot see a `PRIVATE` video it doesn't yet hold a
`user_lesson_library` row for, so a plain `select` would silently miss existing private lessons and
cause duplicate creation. This mirrors how `admin-videos.ts` already always uses
`createServiceClient()` for cross-user reads.

### 1.4 Collections — curation, entirely separate from `library_access`

```sql
create table collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  cover_image_url text,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table lesson_collections (
  lesson_id uuid not null references videos (id) on delete cascade,
  collection_id uuid not null references collections (id) on delete cascade,
  primary key (lesson_id, collection_id)
);

create policy collections_read on collections for select to authenticated using (true);
create policy lesson_collections_read on lesson_collections for select to authenticated using (true);
-- writes are service-role only (admin curator flow, §4) — no insert/update policy needed
```

A Lesson can belong to any number of collections simultaneously (Featured + Podcast + JLPT N3, all
at once — the Netflix model). **Featured is not a boolean column** — it is `collections` row with
`slug = 'featured'`. There is no other special-cased collection; `display_order` alone controls Hub
section ordering, so adding a new editorial section (a Christmas 2027 collection, say) never touches
code. Read access is public (same pattern as `grammar_points`/`badges`/`jlpt_tests` — `using (true)`)
because collection membership carries no access information; the underlying Lesson's own
`library_access` still gates whether a `PLUS` lesson inside "Featured" is actually openable.

**Computed collections are not stored.** "Continue Learning," "Recently Added," "Favorites," "Saved
for Later," and "My Lessons" (§5) are queries against `user_video_progress` / bookmarks /
`user_lesson_library` / `created_at`, not rows in `collections`. Only genuinely editorial groupings
(Anime, Cafe, Kyoto, Podcast, JLPT N3, Featured, future seasonal drops) live in the table.

### 1.5 Tables reused unchanged

`shadowing_sessions` (already has `recording_url`, `pronunciation_score`, `rhythm_score`,
`pitch_score`, per `transcript_line_id`), `dictation_attempts`, `transcript_lines` (already carries
`start_time`/`end_time` per line — Pronunciation Mode's per-sentence clip playback needs no new
column, no new media storage, per CLAUDE.md §2), `user_video_progress`. **No new table for
Pronunciation or Dictation Mode** — they are new *UI* over data structures that already exist from
Layer 3/4.

---

## 2. Create Lesson — the pipeline

Renames "Import Video" → **"Create Lesson"** (button copy: *"Create Lesson"*, subtext *"from a
YouTube video"*). This is the same IA naming invariant the Consolidation spec already adopted
(§1 of that spec: "destinations named after learner intent, never implementation") applied one level
down, to the action itself, not just the screen.

### 2.1 Steps (server-side)

1. Parse the YouTube URL/ID (existing `parseVideoId`, unchanged).
2. **Service-role lookup** by `youtube_video_id` (§1.3's implementation note).
3. **If a `FREE`/`PLUS` lesson already exists:** no quota consumed, no `user_lesson_library` row
   needed — the learner is simply taken to the lesson (respecting the Plus gate if the lesson is
   `PLUS`-tier and they're Free, in which case they see the normal upsell instead).
4. **If a `PRIVATE` lesson already exists *and already has a transcript*** (someone else's
   successful creation, or this same user re-pasting): quota check (§3.2) → insert a
   `user_lesson_library` row → done in tens of milliseconds, no fetch, no AI, no token spend.
   Surfaced to the user as a delight moment, not a technical dedup notice (§2.2).
5. **If no lesson exists at all, OR a `PRIVATE` lesson exists but has no transcript yet** (an
   orphaned attempt from a previous no-caption failure, §2.1 step 6 below — reuse that row, do not
   create a duplicate; `youtube_video_id` is unique): quota check (§3.2) → (create the `videos` row
   if it didn't already exist, `library_access = 'PRIVATE'`, `added_by_user_id` = creator) → attempt
   caption fetch (YouTube's unofficial keyless `timedtext` endpoint, best-effort, per the decision
   already locked in the L9b Plan 1 brainstorm) → **on success**, insert `transcripts`
   (`source = 'youtube_caption'`) + `transcript_lines`, **then** insert the `user_lesson_library` row
   — lesson ready. The library row (and quota consumption) only happens once the lesson is actually
   studyable.
6. **No caption found:** the `videos` row exists but no `user_lesson_library` row was created, so
   **no quota was consumed** and the lesson does not yet appear in anyone's "My Lessons." Free sees a
   locked **"Generate with AI 🔒 Plus"** action (upsell, no free quota for this — §3.3) plus **"Try
   another video"** (abandons this attempt at no cost; the orphaned row is harmless and can be
   revisited later — step 5's dedup path reuses it rather than duplicating). Plus sees **"Generate
   transcript"**, which kicks off AI transcription (`transcripts.source = 'ai_generated'`) as a
   separate action outside the monthly Create-Lesson quota; on success it inserts the
   `user_lesson_library` row the same way step 5 does.

The quota check happens **contextually** (step 4/5), never upfront at step 1 — a URL that resolves
to an already-public lesson always succeeds even at 0/3 remaining, since it costs the user nothing.
The Create Lesson modal still shows remaining quota *before* the user pastes anything (e.g. "2/3
lessons left this month" / "Unlimited" for Plus), so a real block is never a surprise, even though
the enforcement point is later. **A slot is only spent once a lesson is confirmed studyable** — a
no-caption dead end never costs Free users any quota (§3.2).

### 2.2 User-facing progress (3 lines, not the 6-step backend above)

```
Preparing lesson...
✓ Finding transcript
✓ Building lesson
✓ Ready to study
```

Dedup hit skips straight past the fetch step with a delight line instead of a technical one:

```
Great news! Someone has already prepared this lesson.
✓ Added instantly
✓ Ready to study
```

Failure branch:

```
Preparing lesson...
✓ Finding transcript
✕ No transcript found
  [ Generate with AI 🔒 Plus ]   [ Try another video ]
```

---

## 3. Monetization model

### 3.1 What's gated, restated plainly

| Axis | Free | Plus |
|---|---|---|
| Public library | subset (`library_access = FREE` lessons only) | entire library (`FREE` + `PLUS`) |
| Personal lesson creation | 3/month | unlimited |
| AI Transcript Generation (no-caption fallback) | not available | ✅ |
| AI Analysis (sentence cascade, Lite vs Deep) | existing Lite/preview split, unchanged | existing Deep split, unchanged |
| **Inside any lesson you can open** | **100% identical to Plus** | **100% identical to Free** |

The last row is the whole point (§0.3). AI Analysis's Free/Plus split is not new — it is the
existing cascade mechanic from `business-model.md` §2/§3.1, and it applies the same way regardless
of whether the lesson itself is `FREE` or `PLUS` tier. This spec does not touch that split; it only
gives it one more entry point (§6.6's highlight-to-translate).

### 3.2 Quota accounting

Monthly quota = count of `user_lesson_library` rows with `added_at >= date_trunc('month', now())`
for the current user — **not** a count of `videos` rows by `added_by_user_id`. This distinction
matters precisely because of dedup (§1.3/§2.1 step 4): a joiner who dedup-hits someone else's
`PRIVATE` lesson never creates a `videos` row, so counting by `added_by_user_id` would silently
undercount their usage. Resets on the 1st of the calendar month. Only successful creations/joins
consume a slot — a failed URL (invalid link, no caption and the user abandons rather than requesting
AI-gen) never does.

### 3.3 AI Transcript Generation is Plus-exclusive, not a metered free taste

Deliberately different from the sentence-level cascade (which gives Free a small daily taste per
`business-model.md` §5). Whole-video transcription is a materially larger cost than a per-sentence
cascade section, and — per Principle 3 (§0.3) — it is lesson-*creation* capability, which this spec
treats as a pure Plus differentiator, not something to meter for Free at any level.

### 3.4 Business-model.md edits required

- **Principle 3, full replacement text:**
  > *Never lock the core learning experience. Once a learner has access to a lesson, the complete
  > learning loop (Reading → Shadowing → Dictation → Review → Mining) is always available without
  > feature restrictions. Premium expands the library and the ability to create new lessons, rather
  > than fragmenting the learning experience.*
- **Add an explicit "what is/isn't the core loop" clarification directly under Principle 3** — the
  wording above is easy to misread as "the entire library is free," which is the opposite of what it
  means. Make the boundary literal, not just implicit in the surrounding prose:
  ```
  Core loop (free & unlimited, once a lesson is open):
    Create Lesson → Open Lesson → Shadowing → Pronunciation → Dictation → Mining → Review

  NOT the core loop (this is what Plus expands):
    Entire Library (breadth of which lessons can be opened)
    Unlimited Create Lesson (Free is capped at 3/month)
    AI Transcript Generation
  ```
  This is the same distinction §3.1's table already makes; Principle 3 is the place a future reader
  is most likely to encounter the claim in isolation, so it needs the same precision inline, not just
  a cross-reference to a table elsewhere in the document.
- **§2 Free vs Premium table:** add a row for library breadth (subset vs full) and one for personal
  lesson creation (3/month vs unlimited) and one for AI Transcript Generation (— vs ✅), following
  the existing table's format.
- **New philosophy line**, placed near the six principles (§0.3 of this doc, verbatim or close to
  it): *"Nihongo Cinema does not sell lesson quality. It sells library breadth and the ability to
  create new lessons."*
- Cross-reference this spec from `business-model.md`'s header note (same pattern as the existing
  `docs/features/` cross-reference).

---

## 4. Curator workflow

### 4.1 Two lifecycle phases

- **Phase 1 — Seed (now, pre-launch/early).** Admin acts as content creator: uses the same Create
  Lesson pipeline (§2) but can set `library_access` directly to `FREE`/`PLUS` at creation time
  (skipping `PRIVATE`), populating the initial library (NHK, Podcast, Cafe Vlog, Kyoto Walk, Anime,
  JLPT Listening, ...).
- **Phase 2 — Community growth (once there's real usage).** Admin shifts from creator to curator.
  `lib/data/admin-videos.ts`'s existing pending-review queue is repurposed (not rebuilt) into the
  Promotion Queue below. This also **retires backlog #11** ("rejected status + hard-delete
  reason") — `PRIVATE` lessons block no one, so there is no more "reject" action to design; a lesson
  simply is or isn't promoted.

### 4.2 Promotion Queue (replaces "pending review queue")

Four views, not one time-ordered list — admin should never have to review thousands of lessons
chronologically:

- **Needs Review** — newly created `PRIVATE` lessons, unfiltered.
- **Trending Lessons** — `PRIVATE` lessons ranked by a **Promotion Score**: a function of
  `user_lesson_library` row count (how many learners added it), aggregate study time
  (`shadowing_sessions`/`dictation_attempts` against it), completion rate, and bookmark count.
  *Exact weights are an implementation-time decision, not fixed here* — this is an intentional open
  item (§10), not an oversight.
- **Ready to Promote** — admin's own shortlist/starred subset of the above.
- **Published** — lessons already `FREE`/`PLUS`, for management (re-tier, demote back toward
  private if needed).

Promote action: `library_access: PRIVATE → FREE` or `PRIVATE → PLUS`. No data is copied, no lesson
is recreated — same row, one column changes, all cached transcript/AI knowledge is inherited as-is.

---

## 5. Shadowing Hub (`screen-shadowing-hub.md`, replaces `screen-video-library.md`)

Builds directly on the Consolidation spec's Phase 2 rewrite instructions for this file (session
continuity rail, gamification-on-Hub explicitly permitted — unchanged, restated here for
completeness) and adds:

- **Grid is entirely collection-driven**, ordered by `collections.display_order` — no hardcoded
  sections in code. Computed (virtual) collections are prepended, in this order: **Continue
  Learning → My Lessons → Recently Added**, then editorial collections in their stored order
  (Featured typically first among those via its own `display_order`).
- **"My Lessons"** (the learner's own `PRIVATE` creations, via `user_lesson_library`) is promoted to
  a top-level, always-visible section — not buried as a filter chip — because learners return to
  their own imports far more than to random discovery.
- Card treatment: unchanged Story Card, plus a small 🔒 badge when `library_access = 'PLUS'` and the
  viewer is Free — visible, never hidden, per business-model.md §5 "show don't tell."
- Header entry point: **"Create Lesson"** (§2), opens the modal showing quota remaining before any
  input.

---

## 6. Shadowing Lesson Workspace (`screen-shadowing-practice.md`, replaces `screen-shadowing-detail.md`)

### 6.1 Three-layer model

Not one flat set of tabs — three independent axes, each with a single responsibility:

```
Lesson
├── Learning Mode     "What skill am I practicing?"   — Shadowing / Pronunciation / Dictation / Summary
├── View Mode         "How do I want to see it?"       — exists only inside Shadowing: Reading / Normal / Immersion
├── Reading Settings  "How should the UI behave?"       — Font, Subtitle Size, Subtitle Color, Speed, Auto Pause, Repeat, ...
└── Analysis          a per-sentence utility (highlight → Analyze), not a mode at any layer
```

This resolves what would otherwise be a collision between the Consolidation-era "Reading Modes"
(Reading/Shadowing/Immersion/Analysis — display-style axis) and the newly-designed
Shadowing/Pronunciation/Dictation/Summary (practice-type axis): they were never the same axis, so
they don't merge, they nest.

### 6.2 Learning Modes

Route shape: shared layout + nested segments, extending the Consolidation spec's route table exactly
as it already anticipated ("Dictation... a sibling workspace within the same lesson"):

| Route | Learning Mode |
|---|---|
| `/shadowing/[id]` | Shadowing (default) |
| `/shadowing/[id]/pronunciation` | Pronunciation |
| `/shadowing/[id]/dictation` | Dictation |
| `/shadowing/[id]/summary` | Summary |

**Shadowing** — the existing continuous-playback, transcript-first workspace (§6.1's View Modes live
here). Unchanged in spirit from `screen-shadowing-detail.md`'s current content: video, synced
transcript, speed control, auto-pause, repeat, highlight-to-analyze, bookmark, mining, Reading
Settings.

**Pronunciation** — same lesson, same transcript, re-framed per-sentence: video stops behaving as
continuous playback and becomes one exercise per line. Replay a clip cut purely from
`transcript_lines.start_time`/`end_time` (no new media, no AI cutting) → Record → score using the
three columns `shadowing_sessions` already has (`pronunciation_score`, `rhythm_score`,
`pitch_score` — not Azure's four-metric accuracy/fluency/completeness/pron shape, which is a
separate, pre-existing terminology mismatch between `business-model.md`'s Azure description and
this table; out of scope to reconcile here) → Retry → next sentence. History of scores per sentence
is the same data §6.3 uses for per-sentence Learning Status, no new schema.

**Dictation** — same lesson, but the transcript text is **hidden** until the learner checks their
answer, and the video does not play continuously: it loops only the current line's clip
(`start_time → end_time`) and stops, so the learner's attention never drifts past the sentence
they're working on. Play → blank input → Check → accuracy + which words/kana/kanji were wrong +
correction hint (against `dictation_attempts.accuracy_score`/`user_input`, existing table) → next
sentence.

**Summary** — read-only aggregation of *this lesson's own* data: AI summary, main points, vocabulary
highlights, grammar highlights, expressions, culture notes, difficulty, related lessons, the
learner's own completion state per sentence across the other three modes. **No chat box, no "Ask
AI," no cross-lesson reasoning** — the moment a question needs history beyond this lesson, it is a
Companion question, not a Summary one (§0.5). Content split follows the *existing* cascade
free/deep line (§3.1) — this introduces no new gating mechanism.

### 6.3 Shared context and shared progress

Switching Learning Mode never resets position: on sentence 24 in Shadowing, switch to Pronunciation
→ opens on sentence 24; switch to Dictation → same; return to Shadowing → video resumes exactly
where it was. Same idea as switching tabs in an editor or a design tool — one document, several
views on it, never a navigation event. All modes write to the same per-sentence progress surface
(shadowing completion, pronunciation score, dictation accuracy, bookmarks, review-due), so Hub-level
views ("Continue Learning," "Needs Review," "Weak Pronunciation") never need cross-system sync —
they read one source.

**No mode ordering is enforced.** Watch → Shadowing → Pronunciation → Dictation → Summary is one
valid path; Watch → Shadowing → Summary → continue tomorrow is another; Dictation-only is equally
valid. The four modes are not a wizard and never gate one another — a learner can enter any mode at
any time, skip any other mode entirely, and nothing about the lesson considers that "incomplete" in
a way that blocks anything.

**Progress is tracked per mode, not as one aggregate bar.** A lesson card shows independent progress
for each: Shadowing (% of sentences played), Pronunciation (% of sentences with a recorded attempt),
Dictation (% of sentences with a checked attempt), Summary (viewed / not viewed) — e.g. "Shadowing
100% · Pronunciation 63% · Dictation 28%" rather than a single blended "72% done" that hides which
skill is actually behind. For MVP this is computed on read from the existing per-sentence tables
(`shadowing_sessions`, `dictation_attempts` counts against `transcript_lines` for the lesson); a
materialized/cached rollup is a legitimate later optimization if per-card aggregation queries become
a Hub performance problem at scale, not a requirement now.

**Each sentence carries its own Learning Status** across the three practice modes (a listening/
shadowing signal, a pronunciation score, a dictation accuracy score, and a derived "difficult" flag
from repeated low scores or repeated replays) — all read directly off the existing per-sentence rows
above, no new table and no AI involved. This is not a new concept: it is the concrete data
foundation `business-model.md` §2.1 already assumes for **F-007 (weakness tracking)** and **F-012
(Smart Review Queue)**, both listed there as free, computed-from-your-data features — this spec is
simply where that data actually gets produced. It also directly enables, later and without new
schema: practice-weak-sentences, review-difficult-sentences, retry-low-pronunciation-score, and a
smart review queue — all deferred to a future pass (§10), but unblocked by this one.

### 6.4 View Mode (inside Shadowing only)

`Reading` (large type, translation visible, comfortable reading — the old "Reading Mode"),
`Normal` (today's default balance), `Immersion` (video larger, translation hidden, minimal chrome,
closer to fullscreen — the old "Immersion Mode," unchanged in substance, now correctly scoped as a
display preset of Shadowing rather than a sibling of Dictation).

### 6.5 Reading Settings

Existing set (Typography, Furigana, Translation, translation language, sentence emphasis) plus:

- **Subtitle/text color** — 4 presets bundling background + text together (Warm Cream, Night, Sepia,
  High Contrast), each independently WCAG AA-verified. No free-form color picker — keeps the "no
  strong colors" spirit and avoids a contrast-failure support burden.
- Playback speed remembered as the learner's own default.
- Auto-Pause sensitivity (silence-based vs. existing beat-marker-based).
- Loop count before auto-advancing to the next sentence.
- Keyboard-shortcut cheat sheet (togglable, off by default).
- "Resume where I left off" vs. "restart from the beginning" when reopening a partially-studied
  lesson.

All settings persist across devices (existing accessibility requirement, unchanged) and every one
has a sensible default — Free never has to configure anything to get the full experience (§0.3).

### 6.6 Analysis (utility, not a mode)

Extends the existing Sentence Actions rather than replacing them: free-form text selection (not just
whole-sentence tap) opens a popover at the selection. Single-word selections resolve instantly
(dictionary + reading, no AI, same cost profile as the existing Vocabulary Preview). Phrase/clause
selections surface an "Analyze" action into the *existing* AI cascade (Lite free-preview, Deep
Plus — §3.1, no new gate). Popover also carries Play (replay just that span), Bookmark, Add to
Mining — all reusing existing Sentence Actions, no new primitives.

### 6.7 Navigation chrome

Two independent layers, not to be confused with each other:

- **App sidebar** (Home Room, Shadowing, Vocabulary, Grammar, ...) — **hidden by default** across
  the entire `/shadowing/[id]/**` route group (all four Learning Modes, not just Shadowing), with a
  small edge affordance to reveal it. Strengthens the existing "sidebar can be hidden" language in
  `screen-shadowing-detail.md` to "hidden by default."
- **Lesson header** (Back / Title / Learning Mode tabs / Bookmark / Overflow) — always visible. This
  is lesson context, not app navigation, and is unaffected by the sidebar toggle.

### 6.8 Companion

Unchanged: Dormant/Not Supported across all four Learning Modes (`design-reconciliation.md` §4,
untouched by this spec, same as the Consolidation spec left it). Summary Mode was explicitly
considered as a possible Companion touchpoint and rejected — see §0.5's rationale — to keep the
Lesson/Companion boundary intact as more Learning Modes are added in the future.

---

## 7. Route & terminology additions

Extends (does not replace) the Consolidation spec's §5 table:

| Route | Notes |
|---|---|
| `/shadowing/[id]/pronunciation` | new — Pronunciation Learning Mode |
| `/shadowing/[id]/dictation` | already listed in the Consolidation spec's table as a sibling workspace; this spec is its concrete design |
| `/shadowing/[id]/summary` | new — Summary Learning Mode |

"Import Video" / "video import" as user-facing language is retired in favor of **"Create Lesson"**
everywhere it appears in Hub copy (§2, §5). `videos.youtube_video_id` and the physical table name
remain internal/technical vocabulary only (§1.1).

---

## 8. Docs impact checklist

- `docs/design/screens/screen-shadowing-hub.md` — new content from §5, layered onto the
  Consolidation spec's Phase 2 rewrite instructions (do this rewrite once, not twice).
- `docs/design/screens/screen-shadowing-practice.md` — new content from §6, same treatment.
- `docs/product/business-model.md` — Principle 3 rewrite, table additions, new philosophy line
  (§3.4).
- `docs/design/design-reconciliation.md` — no new edits beyond what the Consolidation spec's §6
  Phase 3 already specifies (Companion "not a replacement for a removed screen" bullet, Hub/Dashboard
  gamification split). This spec's Companion decision (§0.5, §6.8) is a *confirmation*, not a change,
  so no additional edit is needed there.
- `.serena/memories/feature_backlog_deferred.md` — item #14 (transcript-submit UI) resolved by this
  spec's §2; item #11 (rejected status) resolved by §4.1's model change; both should be marked DONE
  once implemented, not before.
- Execute the Consolidation spec's §6 file list (Phases 1, 3, 4) as-is — untouched by this spec.

### 8.1 Gaps found in a repo-wide audit (2026-07-31), not covered by either spec above

The Consolidation spec's Phase 4 terminology sweep (17 files) predates this spec and was itself
scoped only to files already known to reference "Video Library"/"Video Detail." A full-repo grep for
stale references turned up seven more, none currently tracked by any plan:

- `docs/design/patterns/study-modes.md` — `Related:` header cross-references `screen-shadowing-detail.md`
  by its pre-rename filename. Missed by the Consolidation spec's Phase 4 list; add it there (same
  treatment as its sibling pattern docs).
- `docs/design/patterns/overlays-and-drawers.md` — same filename cross-reference in its `Related:`
  header **and** an inline prose sentence ("This matters most on `screen-shadowing-detail.md` and
  `screen-review.md`..."). Same fix.
- `docs/features/F-005-learn-before-watching.md` — "a prominent button on video detail page" (§UI/UX).
  The Video Detail page is deprecated with no replacement (Consolidation spec §0); this button's home
  needs to move to the Hub card or the Lesson header (§6.7) instead.
- `docs/features/F-003-learning-journey.md` — "when user views video details or dashboard, a timeline
  chart shows these snapshots." Same deprecated-page problem — and a natural fix: this comprehension-
  over-time timeline belongs in **Summary Mode** (§6.2) now, which didn't exist when F-003 was
  written.
- `japanese-learning-app-spec.md` §3.12 — already carries a "SUPERSEDED, see business-model.md"
  banner (added 2026-07-13, predates this spec), but the struck-through inline text still asserts
  "core loop free & unlimited" with no further qualification. That claim was true under the old
  Principle 3 and is now specifically false for library breadth (§3.1/§3.4). The existing banner
  pattern is otherwise sound and shouldn't be abandoned — but this one line should gain a short
  pointer to this spec's §3.4, the same way the banner already points to business-model.md.
- `docs/features/F-009-shadowing-challenge.md` — workflow step 1 says "User enters 'Challenge Mode'
  from video or dashboard," pre-dating both "Lesson" terminology and Learning Modes. Its own
  Technical Design already reuses `shadowing_sessions` — the exact table the Shadowing/Pronunciation
  Learning Modes are built on (§1.5, §6.2) — so the natural fix is small: "from video" →
  "from a lesson's Shadowing mode, or Dashboard." Not a structural conflict, just stale wording; low
  priority since F-009 is unbuilt (Effort M, no backlog item forcing it).
- `docs/design/screens/screen-architecture.md` — the Consolidation spec's Phase 3 item 8 (rename the
  Emotional Hierarchy row, remove the "Video Detail → Reading Workspace" row and the "Video Detail
  screen is about understanding" line) is necessary but was written before Learning Modes existed, so
  it under-corrects. Three follow-ups this spec adds on top of that item, applied to the same file:
  1. **Layer 2 (Workspace) examples list** — after Consolidation's edit removes the Video Detail row,
     the remaining "Shadowing → Transcript Workspace" line describes only the Shadowing Learning Mode
     specifically, not the Lesson route as a whole. Add a short note that one Lesson route now hosts
     one workspace *per Learning Mode* (§6.1–6.2), all sharing one lesson — this document's "every
     screen has exactly one primary workspace" rule still holds per-mode, it just no longer holds
     per-route the way the table implies.
  2. **"Workspace Priority" section** ("The Shadowing screen is about speaking. The Video Detail
     screen is about understanding...") — once the Video Detail line is removed, add matching
     one-line purpose statements for the three other Learning Modes in the same terse style: *"The
     Pronunciation mode is about speaking accuracy. The Dictation mode is about focused listening.
     The Summary mode is about remembering."*
  3. **Emotional Hierarchy table** — confirm explicitly (so a future editor doesn't fragment it) that
     Pronunciation/Dictation/Summary do **not** each get their own row. They are modes within the one
     "Shadowing Lesson | Practice" row Consolidation's rename already produces, not separate screens
     with separate emotional categories.

None of these seven block writing the implementation plan — they're documentation-consistency fixes,
naturally sequenced alongside the Consolidation spec's own Phase 4 sweep (§8's checklist above).

---

## 9. Data/RLS change summary (for the implementation plan)

1. Migration: add `lesson_access_level` enum + `videos.library_access` (backfill from `status`),
   drop `videos.status`, drop `video_status` enum.
2. Migration: `user_lesson_library`, `collections`, `lesson_collections` tables + RLS (§1.3, §1.4).
3. Rewrite `videos_read`, `transcripts_read`, `transcript_lines_read` RLS to the new predicate
   (§1.2). Rewrite `videos_insert` to check `library_access = 'PRIVATE'` instead of `status =
   'pending'`.
4. `lib/data/videos.ts` — `importVideo()` becomes the Create Lesson pipeline (§2.1): service-role
   dedup lookup, quota check via `user_lesson_library` count (§3.2), caption-fetch integration,
   `library_access` handling. `VideoRow`/`listVideos()` updated for the new column.
5. `lib/data/admin-videos.ts` — pending-queue functions repurposed into the Promotion Queue (§4.2):
   four filtered views instead of one FIFO queue, Promote action instead of Approve/Reject.
6. New: caption-fetch integration (`timedtext`), AI-transcript-generation action (Plus-gated,
   separate from Create Lesson's own quota), Promotion Score computation (weights TBD, §4.2).

---

## 10. Out of scope / explicitly deferred

- Renaming the `videos` DB table (and its ~6 dependent FK columns) to `lessons` (§1.1).
- Bulk/CSV admin import for lessons (existing backlog #12 is about kanji/JLPT content, not videos —
  unrelated, not pulled in here).
- Exact Promotion Score weights (§4.2) — implementation-time tuning, not a design decision.
- Future Learning Modes beyond the four designed here (Speaking Drill, Recall, Roleplay, Quiz) — the
  three-layer model (§6.1) is built to admit them without further architecture work, but none are
  designed in this pass.
- Summary Mode's AI-summary caching/generation strategy in implementation detail (it follows the
  existing Knowledge Economy cache-by-fingerprint pattern per `business-model.md` §4, but the
  specific fingerprint shape for a whole-lesson summary is an implementation decision).
- PayOS enforcement plumbing itself (checking `subscriptions.plan`/`status` in practice) — this spec
  assumes that table and its semantics as given; wiring real billing state into it is L8's job.
- The actual F-007 (weakness tracking) and F-012 (Smart Review Queue) *features/UI* — practice-weak-
  sentences, review-difficult-sentences, retry-low-pronunciation-score, a cross-lesson smart review
  queue. §6.3 builds the per-sentence Learning Status data these need, but surfacing it as a feature
  is a separate pass, already tracked in `business-model.md` §2.1 as free/computed-from-your-data.
- Reconciling the `pronunciation_score`/`rhythm_score`/`pitch_score` naming in `shadowing_sessions`
  against `business-model.md`'s Azure accuracy/fluency/completeness description (§6.2) — a pre-
  existing Layer-4 terminology gap this spec surfaces but does not resolve.
