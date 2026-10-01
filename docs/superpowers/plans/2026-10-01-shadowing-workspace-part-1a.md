# Shadowing Workspace Part 1a — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy `/shadowing/[id]` page with the Figma `105:3088` Shadowing workspace — persistent player, Live Sentence, synced transcript, marks, resume, Focus / Full Transcript, Reading Settings and Study Environment — proven live on the real Ep.729 lesson.

**Architecture:** A `(workspace)` route group whose server `layout.tsx` loads one serializable bootstrap and mounts a client `ShadowingWorkspaceShell`; the shell owns the YouTube player (behind a `PlayerAdapter`), seven separate stores, and the header; `page.tsx` renders only the Shadowing body. All timing, loop, resume and persistence rules are pure functions in `lib/shadowing-workspace/` tested in isolation; components only wire them.

**Tech Stack:** Next.js 14 App Router (RSC), React 18 (`useSyncExternalStore`), next-intl, Supabase/PostgREST + RLS, Tailwind 3.4 + CSS custom properties, Radix Popover/Dialog, lucide-react, Vitest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-01-shadowing-workspace-part-1a-design.md` (locked at `8c8f2f6`) — read it first; it is the acceptance test. Section numbers below (§x) refer to it.

## Global Constraints

- Worktree `C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\.worktrees\shadowing-workspace-1a`, branch `shadowing-workspace-1a`. Never build, serve or run Playwright in the main checkout (it shares `.next` with the owner's dev server).
- Migrations are edited **in place** (AGENTS.md §6): the preference columns go INTO `supabase/migrations/20260922000033_user_preferences.sql`; only the two new tables get new files. After any migration edit: `npx supabase db reset` then every `npm run verify:db:*`.
- New tables follow `20260929000034_user_saved_collections.sql` exactly: RLS on, `select/insert/delete` own policies, `grant select, insert, delete … to authenticated`, `revoke update … from authenticated`, `grant all … to service_role`.
- `supabase/config.toml` `max_rows = 1000`: every multi-row read in this branch goes through `fetchAllPages` (`lib/data/query-pagination.ts`) under a **total** order.
- Server → client props are explicit serializable DTOs: strings, numbers, booleans, plain arrays/objects. No `Map`, `Set`, `Date`, class instance or function (memory: a function prop blanks the page while jsdom stays green). Pin with `structuredClone(bootstrap)` in a test.
- Copy lives in `messages/en/shadowing.json` and `messages/vi/shadowing.json` under a new `workspace` key; add both; follow `messages/README.md`; pin EN leaves in `messages/en/shadowing.pin.test.ts`. `t()` on a template without values breaks in `next dev` — use `t.raw` there.
- Token rule (`components/ui/token-scale.test.ts`): no arbitrary `text-[..px]`, `p-[..]`, `gap-[..]`, radius or shadow literals. Task 4 adds `components/shadowing-workspace` and `app/[locale]/(protected)/(focus)/shadowing` to `SCANNED_DIRS`; every task that adds a file there bumps its `sources` pin.
- No dead control: nothing renders disabled or "coming soon" (spec §2 Q1, §3 ✨).
- Q4: do **not** delete or edit `ShadowingRecorderPanel`, `VideoSummaryPanel`, speech scoring, pitch, their routes, tables or tests. `ShadowingView` is deleted only in Task 12.
- Mutations are idempotent `PUT`/`DELETE`; there is no server toggle.
- Each task ends with `npx tsc --noEmit`, `npm run lint`, `npm run verify:protocol`, `npx vitest run --reporter=dot` all exit 0 (judge the exit code; never pipe through `tail`), plus the task's own gates.
- Code blocks in this plan are **drafts**. They were written against the code as read on 2026-10-01 but never compiled; compile and grep them, and when a draft disagrees with the repo, the repo wins and the run state records the correction.
- Owner viewport for every layout assertion: **1280×529**.

## Review Focus

1. A transcript with two lines at the same `start_time`, a line with `end_time = null` mid-list, and a last line with `end_time = null` → one deterministic order everywhere, `isSpoken` false in the gap after a line whose end precedes the next start, the last line ending at the video's duration (Task 3).
2. A learner who signs out and signs in as someone else in the same tab, or opens a link whose `?line=` belongs to another video → never inherits the other account's position; the foreign line id is ignored and resume proceeds (Task 3, Task 11).
3. Two rapid clicks on Bookmark where the first request fails after the second succeeds → the row stays bookmarked; the stale failure does not roll it back (Task 3, Task 7).
4. Ep.729 played at 0.75× through a sentence with Loop 3× + Auto Pause, then ⏭ pressed mid-cycle → exactly three plays then a pause; ⏭ resets the count and the next sentence plays once per its own cycle (Task 3, Task 11).
5. A focused progress slider or an open Settings popover receiving Space / ←/→ / Escape → the control keeps the key; one Escape closes only the popover; the player does not also toggle (Task 3, Task 9).

Each line has its test in the task named after it.

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/20261001000035_sentence_marks.sql` (+ `.test.ts`) | `sentence_marks` table, RLS, grants |
| `supabase/migrations/20261001000036_user_lesson_bookmarks.sql` (+ `.test.ts`) | `user_lesson_bookmarks` table, RLS, grants |
| `supabase/migrations/20260922000033_user_preferences.sql` (+ its test) | + 14 Reading Settings columns |
| `supabase/tests/shadowing-workspace.sql`, `scripts/verify-shadowing-gate.ps1`, `package.json` | live SQL gate `verify:db:shadowing` |
| `lib/preferences/options.ts`, `lib/validation/preferences.ts`, `lib/data/preferences.ts` | option lists, PATCH schema, row mapping |
| `lib/data/transcripts.ts` | paged `getTranscript`, total order |
| `lib/data/videos.ts`, `app/api/videos/[id]/progress/route.ts` | progress response carries `last_watched_at`; `getMyLessonResume` |
| `lib/data/sentence-marks.ts`, `app/api/sentence-marks/route.ts` | list / set marks |
| `lib/data/lesson-bookmarks.ts`, `app/api/videos/[id]/bookmark/route.ts` | read / set lesson bookmark |
| `lib/validation/sentence-marks.ts` | mark body schema |
| `lib/shadowing-workspace/*.ts` | pure logic: order, lookup, loop, resume, coalescer, shortcuts, view machine, keyed mutations, session record, transcript export, mode registry, bootstrap DTO |
| `lib/data/shadowing-workspace.ts` | server bootstrap loader → DTO |
| `components/video-player/load-youtube-api.ts`, `youtube-player.tsx`, `test/youtube-stub.ts` | additive player surface (rates, mute, initial position) |
| `components/shadowing-workspace/*` | shell, stores, controller, player, live sentence, transcript, header, popovers, divider, atmosphere |
| `app/[locale]/(protected)/(focus)/shadowing/[id]/(workspace)/layout.tsx`, `page.tsx` | the route (old `[id]/page.tsx` removed) |
| `app/globals.css` | reading presets, atmosphere tokens, particles, Noto Serif JP variable hook |
| `test/css-tokens.ts` | shared HSL parsing/contrast helpers (moved out of `lib/design-tokens.contrast.test.ts`) |
| `tests/e2e/fixtures/fake-youtube.ts`, `tests/e2e/fixtures/workspace-data.ts`, `tests/e2e/shadowing-workspace.spec.ts` | deterministic browser acceptance |
| `scripts/seed-real-lesson.ts`, `tests/e2e/shadowing-workspace.live.spec.ts`, `playwright.live.config.ts` | Ep.729 live gate |
| `docs/design/screens/screen-shadowing-practice.md`, `docs/product/domain-model.md` | rulings, deviations, new concepts |

---

## Open question for the owner (blocks Task 8 only)

The spec's header "source line (channel · JLPT)" has no data: `videos` has no channel/author column, and the
lesson-creation pipeline does not store one. Options: (a) show `YouTube · N3 · 23 min` (true facts only, no
channel); (b) add `videos.channel_title`, filled by the pipeline from oEmbed `author_name` and by
`scripts/seed-real-lesson.ts`, with existing rows null (line then falls back to (a)). Task 8 implements
whichever the owner picks; the run state records the answer.

---

### Task 0: Chrome probe — YouTube clock cadence and paused initialisation (Claude)

Throwaway. Nothing from this task is committed except the numbers, into the run state.

**Files:**
- Create (scratch, not committed — `tests/e2e/.probe/` is gitignored and absent from a fresh worktree): `tests/e2e/.probe/probe.config.ts` (a copy of `playwright.config.ts` with `testDir: "./tests/e2e/.probe"` and **no** `webServer`, so it cannot rebuild over a running server) and `tests/e2e/.probe/yt-probe.spec.ts`.

- [ ] **Step 1: Serve a built worktree app on port 3000** (`npm run build && npm run start` in the worktree; never the main checkout). Sign in as a fresh learner; Ep.729 must be seeded (session scratchpad script or Task 11's `scripts/seed-real-lesson.ts`).

- [ ] **Step 2: Measure `getCurrentTime()` resolution while playing.** In the probe, open the legacy `/en/shadowing/<ep729 id>`, start playback, then sample `getCurrentTime()` from the page's player via `requestAnimationFrame` for 10 s and record: distinct values, median and max gap between value changes (ms). Repeat at 0.75× and 1×.

- [ ] **Step 3: Measure paused initialisation.** For each candidate — (a) `new YT.Player(…, { playerVars: { start: floor(p) } })` + `seekTo(p, true)` in `onReady` + `pauseVideo()`; (b) `cueVideoById({ videoId, startSeconds: p })` in `onReady`; (c) `seekTo(p, true)` then `pauseVideo()` in `onReady` — record: does audio/video start (state reaches PLAYING)? `getCurrentTime()` after ready? state after 2 s? Does the first Play start at `p` ± 0.3 s?

- [ ] **Step 4: Decide and record.** Write into `docs/superpowers/run-state/shadowing-workspace-1a.md` § T0: the clock source (`rAF` reading `getCurrentTime()` vs the 250 ms interval vs another interval) that gives the best boundary latency, and the initialisation call that stays paused at `p`. If no source can plausibly meet 300 ms, stop and report the numbers to the owner (spec §7.4) — do not continue to Task 3.

---

### Task 1: Migrations and the live SQL gate

**Files:**
- Create: `supabase/migrations/20261001000035_sentence_marks.sql`, `supabase/migrations/20261001000035_sentence_marks.test.ts`
- Create: `supabase/migrations/20261001000036_user_lesson_bookmarks.sql`, `supabase/migrations/20261001000036_user_lesson_bookmarks.test.ts`
- Modify: `supabase/migrations/20260922000033_user_preferences.sql` (+ its existing `.test.ts`)
- Modify: `lib/preferences/options.ts` (option lists — the migration test imports them)
- Create: `supabase/tests/shadowing-workspace.sql`, `scripts/verify-shadowing-gate.ps1`
- Modify: `package.json` (script `verify:db:shadowing`)

**Interfaces:**
- Produces (in `lib/preferences/options.ts`):

```ts
export const READING_FURIGANA_OPTIONS = ["always", "adaptive", "hidden"] as const;
export const READING_TRANSLATION_OPTIONS = ["hidden", "reveal", "always"] as const;
export const READING_JP_FONT_OPTIONS = ["gothic", "mincho"] as const;
export const READING_TEXT_SIZE_OPTIONS = ["s", "m", "l", "xl"] as const;
export const READING_LINE_HEIGHT_OPTIONS = ["compact", "comfortable", "airy"] as const;
export const READING_WIDTH_OPTIONS = ["narrow", "normal", "wide"] as const;
export const READING_EMPHASIS_OPTIONS = ["minimal", "soft", "strong"] as const;
export const READING_COLOR_PRESET_OPTIONS = ["warm_cream", "night", "sepia", "high_contrast"] as const;
export const PLAYBACK_RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
/** 0 = ∞ (repeat until the learner changes sentence or turns loop off). */
export const PLAYBACK_LOOP_COUNT_OPTIONS = [1, 3, 5, 0] as const;
export const RESUME_BEHAVIOR_OPTIONS = ["resume", "restart"] as const;
export const STUDY_ATMOSPHERE_OPTIONS = [
  "none", "evening_study", "coffee_shop", "rainy_day", "quiet_library", "spring_morning", "summer_night",
] as const;
export const SENTENCE_MARK_KINDS = ["bookmark", "difficult"] as const;
```

  plus one `type X = (typeof X_OPTIONS)[number]` per list (`ReadingFurigana`, `ReadingTranslation`, `ReadingJpFont`, `ReadingTextSize`, `ReadingLineHeight`, `ReadingWidth`, `ReadingEmphasis`, `ReadingColorPreset`, `PlaybackRate`, `PlaybackLoopCount`, `ResumeBehavior`, `StudyAtmosphere`, `SentenceMarkKind`).

- [ ] **Step 1: Write the failing migration tests**

`supabase/migrations/20261001000035_sentence_marks.test.ts` — same `normalized()` helper as `20260929000034_user_saved_collections.test.ts`:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SENTENCE_MARK_KINDS } from "@/lib/preferences/options";

const directory = join(process.cwd(), "supabase/migrations");
const filename = "20261001000035_sentence_marks.sql";
function normalized(file: string): string {
  return readFileSync(join(directory, file), "utf8").replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();
}

describe("sentence marks SQL contract", () => {
  const sql = normalized(filename);
  it("keeps sentence_marks in exactly one migration", () => {
    const files = readdirSync(directory).filter((f) => f.endsWith(".sql") && normalized(f).includes("sentence_marks"));
    expect(files).toEqual([filename]);
  });
  it("owns a mark by user, line and kind, and cascades with both", () => {
    expect(sql).toContain("user_id uuid not null references users (id) on delete cascade");
    expect(sql).toContain("transcript_line_id uuid not null references transcript_lines (id) on delete cascade");
    expect(sql).toContain(`kind text not null check (kind in (${SENTENCE_MARK_KINDS.map((k) => `'${k}'`).join(", ")}))`);
    expect(sql).toContain("created_at timestamptz not null default now()");
    expect(sql).toContain("primary key (user_id, transcript_line_id, kind)");
  });
  it("lets a learner read, mark and unmark only their own rows, on lines they can read", () => {
    const policies = sql.match(/create policy sentence_marks_[a-z]+_own on sentence_marks/g) ?? [];
    expect(policies).toEqual([
      "create policy sentence_marks_select_own on sentence_marks",
      "create policy sentence_marks_insert_own on sentence_marks",
      "create policy sentence_marks_delete_own on sentence_marks",
    ]);
    expect(sql).toContain("alter table sentence_marks enable row level security");
    expect(sql).toContain("exists (select 1 from transcript_lines tl where tl.id = transcript_line_id)");
    expect(sql).toContain("revoke update on sentence_marks from authenticated");
  });
});
```

`…000036_user_lesson_bookmarks.test.ts`: the same three tests for `user_lesson_bookmarks` with
`video_id uuid not null references videos (id) on delete cascade`, `primary key (user_id, video_id)`,
`exists (select 1 from videos v where v.id = video_id)`, policies `user_lesson_bookmarks_{select,insert,delete}_own`.

In the existing `20260922000033_user_preferences.test.ts`, add one test that, for every list above
except `SENTENCE_MARK_KINDS`, asserts the column's `check (<col> in (…))` literal is built from the
option list (numbers unquoted), its `not null default` value, and that `playback_auto_pause boolean
not null default false` and `show_shortcut_hints boolean not null default false` exist.

- [ ] **Step 2: Run them** — `npx vitest run supabase/migrations` → FAIL (files/columns missing).

- [ ] **Step 3: Write the migrations**

`20261001000035_sentence_marks.sql`:

```sql
-- Explicit, learner-set lightweight marks on one transcript line (spec 2026-10-01 part 1a §5.1, Q5).
-- Pin (companion_memories) and Mining (sentence_mining_cards) are separate systems; derived
-- difficulty is computed from learning evidence and is never written here.
create table sentence_marks (
  user_id uuid not null references users (id) on delete cascade,
  transcript_line_id uuid not null references transcript_lines (id) on delete cascade,
  kind text not null check (kind in ('bookmark', 'difficult')),
  created_at timestamptz not null default now(),
  primary key (user_id, transcript_line_id, kind)
);

alter table sentence_marks enable row level security;

create policy sentence_marks_select_own on sentence_marks
  for select to authenticated using (user_id = auth.uid());
-- The exists runs under the learner's own transcript_lines RLS: a line they cannot read cannot be marked.
create policy sentence_marks_insert_own on sentence_marks
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from transcript_lines tl where tl.id = transcript_line_id)
  );
create policy sentence_marks_delete_own on sentence_marks
  for delete to authenticated using (user_id = auth.uid());

-- No update: a mark is a fact with a time, toggled by insert and delete.
grant select, insert, delete on sentence_marks to authenticated;
revoke update on sentence_marks from authenticated;
grant all on sentence_marks to service_role;
```

`20261001000036_user_lesson_bookmarks.sql`: identical shape, `video_id uuid not null references
videos (id) on delete cascade`, `primary key (user_id, video_id)`, insert check
`exists (select 1 from videos v where v.id = video_id)`, header comment naming it the Lesson
Bookmark (separate from `user_lesson_library` membership and from playlists).

In `20260922000033_user_preferences.sql`, inside `create table user_preferences (…)` before
`updated_at`, add:

```sql
  reading_furigana text not null default 'adaptive' check (reading_furigana in ('always', 'adaptive', 'hidden')),
  reading_translation text not null default 'always' check (reading_translation in ('hidden', 'reveal', 'always')),
  reading_jp_font text not null default 'gothic' check (reading_jp_font in ('gothic', 'mincho')),
  reading_text_size text not null default 'm' check (reading_text_size in ('s', 'm', 'l', 'xl')),
  reading_line_height text not null default 'comfortable' check (reading_line_height in ('compact', 'comfortable', 'airy')),
  reading_width text not null default 'normal' check (reading_width in ('narrow', 'normal', 'wide')),
  reading_emphasis text not null default 'soft' check (reading_emphasis in ('minimal', 'soft', 'strong')),
  reading_color_preset text not null default 'warm_cream'
    check (reading_color_preset in ('warm_cream', 'night', 'sepia', 'high_contrast')),
  playback_default_rate numeric(3, 2) not null default 1
    check (playback_default_rate in (0.5, 0.75, 1, 1.25, 1.5, 1.75, 2)),
  playback_loop_count smallint not null default 1 check (playback_loop_count in (1, 3, 5, 0)),
  playback_auto_pause boolean not null default false,
  show_shortcut_hints boolean not null default false,
  resume_behavior text not null default 'resume' check (resume_behavior in ('resume', 'restart')),
  study_atmosphere text not null default 'none' check (study_atmosphere in
    ('none', 'evening_study', 'coffee_shop', 'rainy_day', 'quiet_library', 'spring_morning', 'summer_night')),
```

Adjust the Step 1 test's expected literal format to whatever the file actually normalises to (e.g.
line breaks inside `check (…)` collapse to single spaces).

- [ ] **Step 4: Run** `npx vitest run supabase/migrations` → PASS.

- [ ] **Step 5: Write the live gate** `supabase/tests/shadowing-workspace.sql`, modelled on
`supabase/tests/settings-page.sql` (same `auth.users` insert, `\gset`, `set local role authenticated`,
`request.jwt.claims`, `raise exception 'FAIL …'` / `raise notice 'PASS …'`). Users
`shadowinggate-a@example.invalid`, `shadowinggate-b@example.invalid`. As `postgres`, create: one FREE
video with a transcript and two lines; one PRIVATE video `added_by_user_id = A` with a transcript and
one line. Then, each in its own `begin … commit` block:

1. A (authenticated) inserts a `bookmark` and a `difficult` mark on the FREE line and bookmarks the
   FREE video → PASS when A then reads 2 marks and 1 bookmark.
2. A inserts the same `bookmark` again → `unique_violation` (the API treats it as success).
3. B reads marks and bookmarks with `user_id <> auth.uid()` → 0 rows; B deletes them → `row_count` 0.
4. B inserts a mark on A's PRIVATE line → `insufficient_privilege` (RLS `with check`), proven by
   `exception when insufficient_privilege then null` and a `FAIL` otherwise.
5. B bookmarks A's PRIVATE video → `insufficient_privilege`.
6. B inserts a mark with `user_id = A` on the FREE line → `insufficient_privilege`.
7. B `update sentence_marks set kind = 'difficult'` → `insufficient_privilege` (no update grant).
8. A deletes their bookmark mark → row_count 1.
9. As `postgres`: delete the FREE line → A's remaining mark on it is gone (cascade); delete the
   FREE video → A's lesson bookmark is gone (cascade).
10. Every new `user_preferences` CHECK: inserting `reading_furigana = 'all'`,
    `playback_default_rate = 0.8`, `playback_loop_count = 2`, `study_atmosphere = 'beach'` each raise
    `check_violation`; a row with every column at a legal non-default value is accepted.

End by deleting the gate's users and videos.

`scripts/verify-shadowing-gate.ps1`: copy `scripts/verify-pronunciation-gate.ps1` with `$sqlPath`
→ `supabase/tests/shadowing-workspace.sql` and the messages renamed "Shadowing workspace".
`package.json`: `"verify:db:shadowing": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-shadowing-gate.ps1"`.

- [ ] **Step 6: Run** `npx supabase db reset` then `npm run verify:db:shadowing` → `Shadowing workspace: live PostgreSQL gate passed`; also `verify:db:settings`, `verify:db:pronunciation`, `verify:db:lesson-jobs` → 0.

- [ ] **Step 7: Mutation check** — temporarily delete the `and exists (…)` clause from the sentence-marks insert policy, reset, run the gate → it must FAIL at case 4. Restore, reset, gate green.

- [ ] **Step 8: Commit** — `feat(db): sentence marks, lesson bookmarks and reading settings columns`.

---

### Task 2: Data layer and API

**Files:**
- Modify: `lib/validation/preferences.ts`, `lib/data/preferences.ts` (+ `lib/data/preferences.test.ts`)
- Modify: `lib/data/transcripts.ts` (+ its test)
- Modify: `lib/data/videos.ts`, `app/api/videos/[id]/progress/route.ts` (+ tests)
- Create: `lib/validation/sentence-marks.ts`, `lib/data/sentence-marks.ts`, `app/api/sentence-marks/route.ts` (+ tests)
- Create: `lib/data/lesson-bookmarks.ts`, `app/api/videos/[id]/bookmark/route.ts` (+ tests)

**Interfaces:**
- Consumes: Task 1 option lists.
- Produces:

```ts
// lib/preferences/options.ts — UserPreferences gains (DEFAULT_PREFERENCES mirrors the SQL defaults):
readingFurigana: ReadingFurigana; readingTranslation: ReadingTranslation; readingJpFont: ReadingJpFont;
readingTextSize: ReadingTextSize; readingLineHeight: ReadingLineHeight; readingWidth: ReadingWidth;
readingEmphasis: ReadingEmphasis; readingColorPreset: ReadingColorPreset; playbackDefaultRate: PlaybackRate;
playbackLoopCount: PlaybackLoopCount; playbackAutoPause: boolean; showShortcutHints: boolean;
resumeBehavior: ResumeBehavior; studyAtmosphere: StudyAtmosphere;

// lib/data/transcripts.ts
export async function getTranscript(videoId: string): Promise<GetTranscriptResult>; // unchanged signature, paged

// lib/data/videos.ts
export interface VideoProgressRow { …; last_watched_at: string | null }
export async function getMyLessonResume(videoId: string): Promise<{ position: number; lastWatchedAt: string | null } | null>;

// lib/data/sentence-marks.ts
export interface SentenceMarkDto { lineId: string; kind: SentenceMarkKind }
export async function listMySentenceMarks(transcriptId: string): Promise<SentenceMarkDto[]>;
export type SetSentenceMarkResult = { ok: true } | { ok: false; status: 401 | 404 } | { ok: false; status: 429; retryAfter: number };
export async function setSentenceMark(lineId: string, kind: SentenceMarkKind, marked: boolean): Promise<SetSentenceMarkResult>;

// lib/data/lesson-bookmarks.ts
export async function isLessonBookmarked(videoId: string): Promise<boolean>;
export async function setLessonBookmark(videoId: string, bookmarked: boolean): Promise<SetSentenceMarkResult>;

// lib/validation/sentence-marks.ts
export const sentenceMarkBodySchema: z.ZodObject<{ transcriptLineId: z.ZodString; kind: z.ZodEnum<…> }>; // .strict()
```

- [ ] **Step 1: Failing tests — preferences.** In `lib/data/preferences.test.ts` (uses `test/supabase-mock.ts`, like its existing cases): `readPreferences` maps every new column to its camelCase field (a row with all 14 non-defaults); `fromRow(null)` returns the new defaults; `updateMyPreferences({ readingFurigana: "always" })` upserts `reading_furigana`. In a validation test: each new single-field strict object parses; `{ readingFurigana: "all" }`, `{ playbackDefaultRate: 0.8 }`, `{ playbackLoopCount: 2 }`, and a two-field body `{ readingFurigana: "always", readingWidth: "wide" }` are rejected.

- [ ] **Step 2: Implement.** Extend `UserPreferences`, `DEFAULT_PREFERENCES`, `PreferencesRow`, `COLUMNS`, `fromRow`, `TO_COLUMN` (the `Record<Exclude<keyof UserPreferences,"dailyMinutes">,string>` type makes a missed column a compile error). `preferencesPatchSchema` gains one `.strict()` single-field object per new field: `z.enum(...)` for text lists, `z.boolean()` for the two booleans, and for the numeric lists `z.number().refine((v) => (PLAYBACK_RATE_OPTIONS as readonly number[]).includes(v))` (same for loop count). `playback_default_rate` comes back from PostgREST as a number or string depending on the driver — normalise with `Number(row.playback_default_rate)` in `fromRow` and test that a string `"0.75"` maps to `0.75`.

- [ ] **Step 3: Failing test — paged transcript.** In the transcripts test, mock `transcript_lines` to hold 1500 rows across two pages and assert `getTranscript` returns 1500 lines, in `(start_time, id)` order, including two rows with equal `start_time` whose ids sort them. Run → FAIL (today returns the first page only).

- [ ] **Step 4: Implement** in `getTranscript`:

```ts
const lines = await fetchAllPages<TranscriptLineRow>((from, to) => supabase
  .from("transcript_lines")
  .select("id, start_time, end_time, text_jp, text_translation, furigana_json")
  .eq("transcript_id", transcriptId)
  .order("start_time", { ascending: true })
  .order("id", { ascending: true })
  .range(from, to));
```

`start_time`/`end_time` are `numeric` → normalise with `Number(…)` (and `null` stays `null`) before returning; add that to the test.

- [ ] **Step 5: Failing tests — progress + resume.** `updateProgress` selects and returns `last_watched_at`; the route's JSON includes it. `getMyLessonResume(videoId)` returns `null` when signed out or no row, else `{ position: Number(last_watched_position), lastWatchedAt }`.

- [ ] **Step 6: Implement** (add `last_watched_at` to the select string and both `VideoProgressRow` types: `lib/data/videos.ts` and `lib/video-types.ts`).

- [ ] **Step 7: Failing tests — marks and bookmark data.** Mirroring `setCollectionSaved`'s tests in `lib/data/collections.test.ts`: signed out → 401; rate-limited (30/min, key `sentence-mark:<uid>`) → 429; insert ok → ok; insert `23505` → ok (idempotent); insert `42501` (RLS refused) or `23503` (no such line) → 404; delete → ok even when nothing was deleted; any other error throws. `listMySentenceMarks` pages with `fetchAllPages` over `sentence_marks` joined to the transcript's lines — use `.select("transcript_line_id, kind, transcript_lines!inner(transcript_id)").eq("transcript_lines.transcript_id", transcriptId).order("transcript_line_id").order("kind")` (verify the embedded-filter syntax against PostgREST in the gate DB; if it does not compile, read the line ids from the bootstrapped transcript and filter with `fetchByIdChunks`) — test it with 1200 marks. `isLessonBookmarked` / `setLessonBookmark`: same shape on `user_lesson_bookmarks`, rate-limit key `lesson-bookmark:<uid>`.

- [ ] **Step 8: Implement** `lib/data/sentence-marks.ts`, `lib/data/lesson-bookmarks.ts`, `lib/validation/sentence-marks.ts`:

```ts
export const sentenceMarkBodySchema = z.object({
  transcriptLineId: z.string().uuid(),
  kind: z.enum(SENTENCE_MARK_KINDS),
}).strict();
```

- [ ] **Step 9: Failing route tests, then routes.** `app/api/sentence-marks/route.ts` exports `PUT` and `DELETE`, each: parse JSON (400 `Invalid JSON`), `sentenceMarkBodySchema.safeParse` (400 `Invalid input`), call `setSentenceMark(id, kind, method === "PUT")`, map 401/404/429 exactly like `app/api/collections/[id]/save/route.ts` (404 body is `{ error: "Not found" }` — no line or video metadata), 500 opaque. Success body `{ data: { marked: boolean } }`. `app/api/videos/[id]/bookmark/route.ts`: a copy of the collections save route over `setLessonBookmark`, success `{ data: { bookmarked } }`.

- [ ] **Step 10: Run** vitest, tsc, lint → 0. **Mutation:** make `setSentenceMark` treat `42501` as success → the 404 test must fail; restore.

- [ ] **Step 11: Commit** — `feat(data): marks, lesson bookmark, reading preferences, paged transcript, progress timestamp`.

---

### Task 3: Pure workspace logic

All files under `lib/shadowing-workspace/`, each with a sibling `*.test.ts`. No React, no I/O.

**Files:**
- Create: `types.ts`, `transcript-order.ts`, `sentence-lookup.ts`, `loop-machine.ts`, `resume.ts`, `session-resume-record.ts`, `progress-coalescer.ts`, `shortcuts.ts`, `workspace-view.ts`, `keyed-mutations.ts`, `transcript-export.ts`, `learning-modes.ts`, `transcript-search.ts`

**Interfaces (Produces):**

```ts
// types.ts
import type { FuriganaSegment } from "@/lib/japanese/types";
export interface WorkspaceLine {
  id: string; index: number; startTime: number; endTime: number | null;
  textJp: string; textTranslation: string | null; furigana: FuriganaSegment[] | null;
}

// transcript-order.ts
export function canonicalLines(rows: readonly TranscriptLineRow[]): WorkspaceLine[]; // sort (start_time, id), index = position

// sentence-lookup.ts
export function effectiveEnd(lines: readonly WorkspaceLine[], index: number, duration: number | null): number;
export interface SentencePosition { index: number | null; isSpoken: boolean }
export function locateSentence(lines: readonly WorkspaceLine[], time: number, duration: number | null): SentencePosition;
export function sameSentencePosition(a: SentencePosition, b: SentencePosition): boolean;
export function previousTarget(lines: readonly WorkspaceLine[], current: number | null, time: number): number | null; // §7.4 ⏮ 1.5 s rule
export function nextTarget(lines: readonly WorkspaceLine[], current: number | null): number | null;

// loop-machine.ts
export interface LoopConfig { enabled: boolean; count: PlaybackLoopCount; autoPause: boolean } // count 0 = ∞
export interface LoopState { sentenceIndex: number | null; playsCompleted: number }
export type BoundaryDecision = { kind: "replay" } | { kind: "continue" } | { kind: "pause" };
export function decideAtSentenceEnd(config: LoopConfig, state: LoopState): { decision: BoundaryDecision; next: LoopState };
export function resetLoop(sentenceIndex: number | null): LoopState;

// session-resume-record.ts
export interface SessionResumeRecord { userId: string; videoId: string; position: number; savedAt: number; syncedServerAt: string | null }
export function sessionResumeKey(userId: string, videoId: string): string; // `shadowing-resume:${userId}:${videoId}`
export function parseSessionResumeRecord(raw: string | null, userId: string, videoId: string): SessionResumeRecord | null;

// resume.ts
export interface ResumeInput {
  lines: readonly WorkspaceLine[]; duration: number | null; deepLinkLineId: string | null;
  resumeBehavior: ResumeBehavior;
  server: { position: number; lastWatchedAt: string | null } | null;
  session: SessionResumeRecord | null;
}
export interface ResumeDecision { position: number; source: "deep-link" | "session" | "server" | "start" }
export function resolveStartPosition(input: ResumeInput): ResumeDecision;

// progress-coalescer.ts
export type ProgressFlushReason = "tick" | "pause" | "ended" | "hidden" | "pagehide" | "leave";
export interface ProgressSent { position: number; at: number } // at = Date.now() of the last server write
export const SERVER_WRITE_INTERVAL_MS = 12_000;
export const MEANINGFUL_DELTA_S = 1;
export function shouldWriteServer(last: ProgressSent | null, position: number, now: number, reason: ProgressFlushReason): boolean;

// shortcuts.ts
export type WorkspaceShortcut = "toggle-play" | "previous-sentence" | "next-sentence" | "rewind-5" | "toggle-loop" | "toggle-focus";
export function isInteractiveTarget(target: EventTarget | null): boolean;
export function shortcutFor(event: Pick<KeyboardEvent, "key" | "shiftKey" | "ctrlKey" | "metaKey" | "altKey" | "target">): WorkspaceShortcut | null;

// workspace-view.ts
export type WorkspaceView = "normal" | "focus" | "full-transcript";
export type FullscreenTarget = "none" | "workspace" | "player";
export type EscapeAction = "close-popover" | "exit-fullscreen" | "exit-view" | "none";
export function toggleView(current: WorkspaceView, requested: Exclude<WorkspaceView, "normal">): WorkspaceView;
export function escapeAction(state: { popoverOpen: boolean; fullscreen: FullscreenTarget; view: WorkspaceView }): EscapeAction;

// keyed-mutations.ts
export interface KeyedMutator {
  run<T>(key: string, options: { apply: () => void; request: () => Promise<T>; rollback: () => void; onSettled?: (ok: boolean) => void }): Promise<void>;
  isPending(key: string): boolean;
}
export function createKeyedMutator(): KeyedMutator;

// transcript-export.ts
export function toSrt(lines: readonly WorkspaceLine[], duration: number | null): string;
export function toPlainText(lines: readonly WorkspaceLine[]): string;

// learning-modes.ts
export type LearningModeId = "shadowing" | "pronunciation" | "listening" | "summary";
export interface LearningMode { id: LearningModeId; segment: "" | "pronunciation" | "listening" | "summary"; complete: boolean }
export const LEARNING_MODES: readonly LearningMode[]; // only shadowing complete in 1a
export function completedModes(modes?: readonly LearningMode[]): LearningMode[];
export function shouldRenderModeNav(modes?: readonly LearningMode[]): boolean; // completedModes().length >= 2

// transcript-search.ts
export function matchingLineIndexes(lines: readonly WorkspaceLine[], query: string): number[]; // trimmed, case-insensitive, JP + translation; "" → all
```

- [ ] **Step 1: Write the failing tests.** Concrete cases (one `it` each):

`transcript-order.test.ts`: rows given out of order with two equal `start_time` → sorted by `(start_time, id)`, `index` 0..n−1; numeric strings `"12.96"` already normalised by Task 2 are numbers here (type test only).

`sentence-lookup.test.ts` with lines A(0–3.55), B(3.55–5.09), C(5.09, end null), D(9.0–10.0), duration 20:
- `t=-1` → `{index:null,isSpoken:false}`; `t=0` → A spoken; `t=3.55` → B (boundary belongs to the next line); `t=6` → C spoken (C's effective end = D.start = 9); `t=9.5` → D; `t=12` → D, `isSpoken:false` (gap after D, before duration); `t=25` → D, false.
- duplicates: two lines at 4.0 → the later-in-order one is current at t=4.0.
- `effectiveEnd` of the last line with `endTime=null` and duration 20 → 20; with `duration=null` → `Infinity`.
- `previousTarget`: at 2.0 s into B → B; at 1.0 s into B → A; at index 0 → 0; null current → null.
- `sameSentencePosition` true only when both fields equal.

`loop-machine.test.ts`:
- loop off, autoPause off → continue; loop off, autoPause on → pause.
- loop on count 3: plays 0→ replay (playsCompleted 1), 1 → replay (2), 2 → continue with autoPause off / pause with autoPause on, and `next.playsCompleted` resets to 0.
- count 1 + autoPause off → continue (no unexpected replay); count 1 + autoPause on → pause.
- count 0 (∞) → replay forever (100 iterations), autoPause never fires.
- `resetLoop(5)` → `{ sentenceIndex: 5, playsCompleted: 0 }`.

`session-resume-record.test.ts`: key format; valid JSON for the same user/video → record; other user → null; other video → null; malformed JSON / missing fields / non-finite position → null.

`resume.test.ts` (lines as above, duration 1396):
- valid `?line` id → its `startTime`, source `deep-link`, even with `resumeBehavior: "restart"`.
- `?line` id not in `lines` (another video's or deleted) → ignored, falls through to resume.
- `restart` without deep link → 0 / `start`.
- server only `{position: 600, …}` → start of the sentence containing 600, source `server`.
- position `4.9` → 0; position `1390` (inside last 10 s) → 0; position `5000` (beyond duration) → 0; `NaN` → 0.
- session record with `syncedServerAt = "2026-10-01T10:00:00Z"`, server `lastWatchedAt = "2026-10-01T10:00:00Z"` → session wins; server `"…10:05:00Z"` → server wins; session `syncedServerAt: null` and server null → session wins; session null → server.
- duration `null` → overflow rule skipped, near-end rule skipped, other rules apply.

`progress-coalescer.test.ts`: first tick with `last=null` and position > 0 → true; tick 5 s after the last write → false; tick 12 s later but moved 0.4 s → false; 12 s later moved 3 s → true; `pause`/`ended`/`hidden`/`pagehide`/`leave` → true whenever `position` differs from `last.position` by ≥ 0.05, regardless of time.

`shortcuts.test.ts`: Space → toggle-play; ArrowLeft → previous; ArrowRight → next; Shift+ArrowLeft → rewind-5; `l`/`L` → toggle-loop; `f`/`F` → toggle-focus; with Ctrl/Meta/Alt → null; target = each of `input`, `textarea`, `select`, `button`, `a[href]`, `[role=slider]`, `[role=menuitem]`, `[role=option]`, `[contenteditable=true]`, an element inside `[role=dialog]` → null (`isInteractiveTarget` true); target = `document.body` or a plain `div` → the shortcut.

`workspace-view.test.ts`: `toggleView("normal","focus")` → focus; `("focus","focus")` → normal; `("focus","full-transcript")` → full-transcript; escape priority table: popover open beats fullscreen beats view; nothing open + normal → none.

`keyed-mutations.test.ts` (fake promises you resolve/reject by hand): (1) apply runs synchronously, rollback not called on success; (2) single failure → rollback called; (3) request 1 then request 2 on the same key, 2 resolves, then 1 rejects → rollback NOT called; (4) 1 resolves, 2 rejects → rollback called; (5) different keys are independent; (6) `isPending` true between run and settle.

`transcript-export.test.ts`: two lines → exact SRT text (`1\n00:00:00,000 --> 00:00:03,550\n…\n\n2\n…`), a null `endTime` takes the next start / duration; `toPlainText` → `JP\nVI` blocks separated by a blank line, translation omitted when null.

`learning-modes.test.ts`: default registry → `completedModes()` is `[shadowing]`, `shouldRenderModeNav()` false; with a second complete mode injected → true and order preserved.

`transcript-search.test.ts`: `""`/`"  "` → all indexes; Japanese substring; Vietnamese substring case-insensitively (`"BẠN"` matches `"bạn"`); no match → `[]`.

- [ ] **Step 2: Run** `npx vitest run lib/shadowing-workspace` → FAIL (modules missing).

- [ ] **Step 3: Implement.** Key drafts:

```ts
// sentence-lookup.ts
export function effectiveEnd(lines: readonly WorkspaceLine[], index: number, duration: number | null): number {
  const line = lines[index]!;
  if (line.endTime !== null) return line.endTime;
  const next = lines[index + 1];
  if (next) return next.startTime;
  return duration ?? Number.POSITIVE_INFINITY;
}

export function locateSentence(lines: readonly WorkspaceLine[], time: number, duration: number | null): SentencePosition {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid]!.startTime <= time) { found = mid; low = mid + 1; } else { high = mid - 1; }
  }
  if (found < 0) return { index: null, isSpoken: false };
  return { index: found, isSpoken: time < effectiveEnd(lines, found, duration) };
}
```

```ts
// loop-machine.ts
export function decideAtSentenceEnd(config: LoopConfig, state: LoopState) {
  const plays = state.playsCompleted + 1;
  if (config.enabled && (config.count === 0 || plays < config.count)) {
    return { decision: { kind: "replay" } as const, next: { ...state, playsCompleted: plays } };
  }
  const decision = config.autoPause ? ({ kind: "pause" } as const) : ({ kind: "continue" } as const);
  return { decision, next: { ...state, playsCompleted: 0 } };
}
```

```ts
// keyed-mutations.ts
export function createKeyedMutator(): KeyedMutator {
  const latest = new Map<string, number>();
  let counter = 0;
  return {
    async run(key, { apply, request, rollback, onSettled }) {
      const token = ++counter;
      latest.set(key, token);
      apply();
      let ok = true;
      try { await request(); } catch { ok = false; }
      const isLatest = latest.get(key) === token;
      if (isLatest) latest.delete(key);
      if (!ok && isLatest) rollback();
      onSettled?.(ok);
    },
    isPending: (key) => latest.has(key),
  };
}
```

`resume.ts`: deep link first (`lines.find(l => l.id === id)`), then `restart` → 0, then pick the
candidate (`session` vs `server` by `server.lastWatchedAt > session.syncedServerAt`, comparing
`Date.parse` values; `null` server timestamp never beats a session record), then validate
(`Number.isFinite`, `≥ 5`, `≤ duration`, `< duration − 10` when duration known), then snap with
`locateSentence(...).index` → that line's `startTime` (a position before the first line snaps to 0).

`shortcuts.ts` `isInteractiveTarget`: `target instanceof Element` and
`target.closest('input, textarea, select, button, a[href], [role="slider"], [role="menuitem"], [role="menuitemradio"], [role="option"], [role="dialog"], [contenteditable=""], [contenteditable="true"]') !== null`.

- [ ] **Step 4: Run** → PASS. **Mutations** (each must turn a test red, then restore): `<=` → `<` in `locateSentence`; drop the `isLatest` guard in `createKeyedMutator`; swap the `>` in the session/server comparison; remove `[role="slider"]` from the selector.

- [ ] **Step 5: Commit** — `feat(shadowing): pure workspace logic — order, lookup, loop, resume, persistence, shortcuts, views`.

---

### Task 4: Bootstrap, route group, shell skeleton and stores

**Files:**
- Create: `lib/data/shadowing-workspace.ts` (+ test)
- Create: `lib/shadowing-workspace/bootstrap.ts` (DTO type)
- Create: `app/[locale]/(protected)/(focus)/shadowing/[id]/(workspace)/layout.tsx`, `…/(workspace)/page.tsx`
- Delete: `app/[locale]/(protected)/(focus)/shadowing/[id]/page.tsx` (its content now lives in the route group; `ShadowingView` itself stays until Task 12)
- Create: `components/shadowing-workspace/playback-position-store.ts` (+ test), `components/shadowing-workspace/workspace-context.tsx` (+ test), `components/shadowing-workspace/workspace-shell.tsx`
- Modify: `components/ui/token-scale.test.ts` (scan the two new directories)
- Modify: `messages/en/shadowing.json`, `messages/vi/shadowing.json`, `messages/en/shadowing.pin.test.ts` (`workspace.*` keys introduced in this task: `emptyTranscript.title/body`, `regionLabel`)

**Interfaces:**
- Consumes: Task 2 data functions, Task 3 `canonicalLines`.
- Produces:

```ts
// lib/shadowing-workspace/bootstrap.ts
export interface WorkspaceBootstrap {
  userId: string;
  video: { id: string; youtubeVideoId: string; title: string; durationSeconds: number | null; jlptLevel: JlptLevel | null };
  transcript: { id: string; lines: WorkspaceLine[] } | null;
  masteryMap: Record<string, number>;
  preferences: UserPreferences;
  resume: { position: number; lastWatchedAt: string | null } | null;
  lessonBookmarked: boolean;
  marks: SentenceMarkDto[];
}

// lib/data/shadowing-workspace.ts
export type LoadWorkspaceResult = { ok: true; data: WorkspaceBootstrap } | { ok: false; status: 401 | 404 };
export async function loadWorkspaceBootstrap(videoId: string): Promise<LoadWorkspaceResult>;

// components/shadowing-workspace/playback-position-store.ts
export interface PlaybackPositionStore { get(): number; set(time: number): void; subscribe(listener: () => void): () => void }
export function createPlaybackPositionStore(initial: number): PlaybackPositionStore;
export function usePlaybackTime(store: PlaybackPositionStore): number; // useSyncExternalStore

// components/shadowing-workspace/workspace-context.tsx — one context per row of spec §4.3
export function useLesson(): { video: WorkspaceBootstrap["video"]; lines: WorkspaceLine[]; masteryMap: Record<string, number>; transcriptId: string | null };
export function usePlaybackController(): PlaybackController;   // defined in Task 5; context created here with a placeholder type import
export function usePositionStore(): PlaybackPositionStore;
export function useCurrentSentence(): SentencePosition;
export function useSession(): [SessionState, React.Dispatch<SessionAction>];
export function usePreferences(): { preferences: UserPreferences; setPreference<K extends PreferenceKey>(key: K, value: UserPreferences[K]): void; pending(key: PreferenceKey): boolean };
export function useMarks(): { isMarked(lineId: string, kind: SentenceMarkKind): boolean; toggleMark(lineId: string, kind: SentenceMarkKind): void; lessonBookmarked: boolean; toggleLessonBookmark(): void; pending(key: string): boolean };

export interface SessionState {
  view: WorkspaceView; fullscreen: FullscreenTarget; liveSentenceHidden: boolean;
  transcriptTranslation: "follow" | "shown" | "hidden";       // §7.8 panel 👁 override
  lineFurigana: Record<string, boolean>;                     // per-line override: true = shown, false = hidden
  lineTranslationRevealed: Record<string, boolean>;          // reveal mode
  query: string; splitRatio: number; openPopover: string | null;
}
export type SessionAction =
  | { type: "toggle-view"; view: "focus" | "full-transcript" } | { type: "exit-view" }
  | { type: "set-fullscreen"; target: FullscreenTarget } | { type: "toggle-live-sentence" }
  | { type: "cycle-transcript-translation"; persisted: ReadingTranslation }
  | { type: "toggle-line-furigana"; lineId: string; shownByMode: boolean }
  | { type: "reveal-line-translation"; lineId: string } | { type: "reset-overrides" }
  | { type: "set-query"; query: string } | { type: "set-split"; ratio: number }
  | { type: "set-popover"; id: string | null };
export const DEFAULT_SPLIT_RATIO = 0.5;
```

`PreferenceKey = Exclude<keyof UserPreferences, "dailyMinutes" | "learningSchedule" | "scheduleDays">`.

- [ ] **Step 1: Failing tests.**
  - `lib/data/shadowing-workspace.test.ts` (mock the data functions with `vi.mock`): 401 when signed out; 404 when `getVideo` is not ok; transcript null → `transcript: null`, `marks: []` (no marks read); a full load returns lines in canonical order; **`structuredClone(result.data)` deep-equals `result.data`** (no Map/Date/function); `masteryMap` is a plain object.
  - `playback-position-store.test.ts`: `set` notifies subscribers; setting the same value does not notify; unsubscribe stops notifications.
  - `workspace-context.test.tsx`: the session reducer — `toggle-view` uses `toggleView`; `cycle-transcript-translation` from `follow` with persisted `always` → `hidden`, then → `shown`… (follow → opposite of persisted → follow); `reset-overrides` clears the three override fields; a `useCurrentSentence` consumer does **not** re-render when the position store ticks inside the same sentence (count renders with a ref; drive the store 10 times within one sentence → 1 render; cross a boundary → 2), and does re-render when only `isSpoken` flips.
  - `usePreferences().setPreference` writes the context synchronously, PATCHes `/api/user/preferences` with exactly `{ [key]: value }`, and on failure rolls back only when it is the latest mutation (reuse `createKeyedMutator`; mock `fetch`). Changing `readingTranslation` or `readingFurigana` dispatches `reset-overrides` for the matching overrides (§7.8 "cleared when the persisted mode changes").
  - `useMarks().toggleMark` PUTs `/api/sentence-marks` `{ transcriptLineId, kind }` when unmarked and DELETEs when marked; race test from Review Focus 3: click, click, first request rejects after second resolves → still marked.

- [ ] **Step 2: Implement** `loadWorkspaceBootstrap` (parallel `Promise.all` of `getVideo`, `getTranscript`, `getVocabMasteryMap`, `getMyPreferences`, `getMyLessonResume`, `isLessonBookmarked`, then `listMySentenceMarks(transcript.id)` when a transcript exists; `userId` from `requireUser`), the store, the contexts and the reducer.

- [ ] **Step 3: Route.**

```tsx
// (workspace)/layout.tsx
import { notFound, redirect } from "next/navigation";
import { loadWorkspaceBootstrap } from "@/lib/data/shadowing-workspace";
import { ShadowingWorkspaceShell } from "@/components/shadowing-workspace/workspace-shell";

export const dynamic = "force-dynamic";

export default async function ShadowingWorkspaceLayout({ children, params }: {
  children: React.ReactNode; params: { locale: string; id: string };
}) {
  const result = await loadWorkspaceBootstrap(params.id);
  if (!result.ok) {
    if (result.status === 401) redirect(`/${params.locale}/login`);
    notFound();
  }
  return <ShadowingWorkspaceShell bootstrap={result.data}>{children}</ShadowingWorkspaceShell>;
}
```

Check how sibling protected layouts handle 401 (the `(protected)/layout.tsx` probably already redirects) and copy that instead of the draft's redirect if so. `page.tsx` renders `<ShadowingModeBody />` (Task 6/7 fill it; in this task it renders the empty-transcript state or a placeholder region labelled `workspace.regionLabel` — the placeholder is replaced within the same branch, before Task 12's parity gate). **Layouts receive no `searchParams`:** `?line=` is read in the shell with `useSearchParams()`.

The shell in this task: providers + a CSS grid with the header slot, the left column (player slot), the divider slot and the right column (`{children}`). No `template.tsx`; no `key` prop on the shell, providers or the player slot.

- [ ] **Step 4: token-scale.** Add `{ dir: "components/shadowing-workspace", rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY], sources: <count> }` and `{ dir: "app/[locale]/(protected)/(focus)/shadowing", rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY], sources: <count> }` — counts from `collectSources`; later tasks bump them.

- [ ] **Step 5: Run** vitest, tsc, lint, protocol → 0. Open `/en/shadowing/<ep729 id>` in a dev server **in the worktree** (`npx next dev -p 3001`) → the shell renders, no console error about non-serializable props.

- [ ] **Step 6: Commit** — `feat(shadowing): workspace route group, bootstrap DTO and stores`.

---

### Task 5: Player adapter and playback controller

**Files:**
- Modify (additive only): `components/video-player/load-youtube-api.ts`, `components/video-player/youtube-player.tsx`, `test/youtube-stub.ts` (+ `test/youtube-stub.test.ts`)
- Create: `components/shadowing-workspace/player-adapter.ts`, `components/shadowing-workspace/use-playback-controller.ts` (+ test), `components/shadowing-workspace/use-progress-persistence.ts` (+ test)

**Interfaces:**
- Consumes: Task 3 lookup/loop/resume/coalescer/session record; Task 4 stores; Task 0's decisions.
- Produces:

```ts
// load-youtube-api.ts — YtPlayerLike gains (additive):
getAvailablePlaybackRates(): number[]; mute(): void; unMute(): void; isMuted(): boolean;
cueVideoById?(options: { videoId: string; startSeconds?: number }): void; // keep only if T0 chose it

// youtube-player.tsx — new optional props and handle members (existing callers unaffected):
//   initialPosition?: number   (applied once in onReady per T0's chosen call, player stays paused)
//   YouTubePlayerHandle gains getAvailablePlaybackRates, mute, unMute, isMuted

// player-adapter.ts
export type PlayerAdapter = YouTubePlayerHandle; // the narrow seam; nothing else touches YT

// use-playback-controller.ts
export interface PlaybackController {
  play(): void; pause(): void; togglePlay(): void; isPlaying(): boolean;
  seekTo(seconds: number): void; seekToSentence(index: number, options?: { play?: boolean }): void;
  previousSentence(): void; nextSentence(): void; rewind(seconds: number): void;
  setRate(rate: number): void; availableRates(): number[];
  toggleMute(): void; isMuted(): boolean;
  setLoop(config: Partial<LoopConfig>): void; loopConfig(): LoopConfig;
}
export function usePlaybackControllerState(args: {
  adapterRef: React.RefObject<PlayerAdapter>; lines: WorkspaceLine[]; duration: number | null;
  positionStore: PlaybackPositionStore; onSentence(position: SentencePosition): void;
  initialLoop: LoopConfig; initialRate: number;
}): { controller: PlaybackController; onTick(time: number): void; onStateChange(state: YtPlayerStateValue): void; onReady(): void };

// use-progress-persistence.ts
export function useProgressPersistence(args: {
  userId: string; videoId: string; positionStore: PlaybackPositionStore; isPlaying: () => boolean;
}): { flush(reason: ProgressFlushReason): void };
```

- [ ] **Step 1: Failing tests** (`use-playback-controller.test.ts`, with `installYouTubeStub()` from `test/youtube-stub.ts` and lines A(0–3), B(3–6), C(6–9)):
  - tick 2.9 → current A; tick 3.0 → B; the `onSentence` callback fires once per change (and once when `isSpoken` flips in a gap).
  - **Review Focus 4:** loop 3 + autoPause on, playing B: ticks crossing 6.0 → seek to 3 (play 2), again (play 3), then `pauseVideo` called, current stays B; `nextSentence()` mid-cycle → seek to 6, count reset.
  - autoPause on, loop off → pause at each boundary; pressing play continues into the next sentence (no extra replay).
  - `previousSentence()` at 4.6 (1.6 s into B) → seek 3; at 3.8 → seek 0.
  - `rewind(5)` at 2.0 → seek 0.
  - `setRate(0.8)` when available rates are `[0.5,0.75,1]` → clamps to the nearest available (0.75).
  - `seekToSentence(2, { play: true })` updates the position store to 6 **before** the next tick and calls `playVideo`.
  - Boundary detection uses the sentence that was playing: a seek that jumps over a boundary does **not** trigger a loop replay (track `lastTickTime`; only a forward crossing `last < end <= now` with `now - last < 1.5 s` counts).
- `use-progress-persistence.test.ts` (fake timers, mocked `fetch`, real `sessionStorage` from jsdom):
  - session record written under `shadowing-resume:<user>:<video>` on every position change (throttled to ≥ 1 s).
  - server PATCH only when `shouldWriteServer` says so; on `visibilitychange` → hidden and on `pagehide` a PATCH with `keepalive: true`; on unmount a `leave` flush.
  - the response's `last_watched_at` is stored as `syncedServerAt`.
- `youtube-stub.test.ts`: the stub implements the new members.

- [ ] **Step 2: Implement.** The controller keeps a `LoopState` ref and `lastTickTime` ref; `onTick(t)`: `positionStore.set(t)`; compute `locateSentence`; publish if changed (`sameSentencePosition`); if a loop-relevant boundary of the *active* sentence was crossed, apply `decideAtSentenceEnd` (`replay` → `seekTo(start)`; `pause` → `pause()` and `seekTo(end − 0.01)` only if T0 shows YouTube overshoots; `continue` → nothing); reset the loop state whenever the active sentence changes for any other reason. The tick source is what T0 chose (wire `onTick` from `YouTubePlayer`'s interval or a `requestAnimationFrame` loop that reads `adapter.getCurrentTime()` while PLAYING).

- [ ] **Step 3: Run** → PASS; the existing `dictation-view` and `mining-clip-player` tests stay green (additive change). **Mutation:** remove the `now - last < 1.5` guard → the seek-over-boundary test fails.

- [ ] **Step 4: Commit** — `feat(shadowing): player adapter, playback controller and progress persistence`.

---

### Task 6: Player UI and Live Sentence

**Files:**
- Create: `components/shadowing-workspace/workspace-player.tsx`, `progress-bar.tsx`, `beat-markers.tsx`, `sentence-loop-control.tsx`, `speed-control.tsx`, `live-sentence.tsx`, `ruby-sentence.tsx` (+ tests for each behavioural one)
- Modify: `components/shadowing-workspace/workspace-shell.tsx` (mount the player in the left column), messages (+ pins)

**Interfaces:**
- Consumes: Task 4 hooks, Task 5 controller.
- Produces: `<WorkspacePlayer />`, `<LiveSentence />`, `<RubySentence segments mode lineId />` (reused by Task 7's Full Transcript rows).

Behaviour (spec §7.3, §7.5, §7.8):
- Video: `YouTubePlayer` inside an `aspect-video` box; its width is `min(column width, (available height − control bar − Live Sentence minimum) × 16/9)`, computed with CSS (`max-height` + `aspect-ratio`) rather than JS where possible. At 1280×529 the Japanese line of Live Sentence must be visible without scrolling (asserted in Task 11).
- Subtitle overlay: current line's `textJp`, hidden when the 📄 toggle is off (`aria-pressed`, accessible name `workspace.player.subtitlesShow` / `subtitlesHide`).
- Centre play button when paused (`aria-label` play).
- `ProgressBar`: a native `<input type="range">` (min 0, max duration, step 0.1) styled with tokens; it is the only seek control; ←/→ on it are native. `BeatMarkers`: **one** `<svg aria-hidden="true">` with one `<line>` per sentence start, `pointer-events: none`; current sentence's marker uses the accent token at low opacity.
- Left group: ⏮ `previousSentence`, ⏯, ⏭ `nextSentence`, ↶5s `rewind(5)` (lucide `RotateCcw` + "5" glyph, label `workspace.player.rewind5`).
- Right group: `SentenceLoopControl` (pill "Sentence", `aria-pressed` = loop enabled, a Radix Popover with radio items 1×/3×/5×/∞ that set the session loop count; default from `playbackLoopCount`), `SpeedControl` (shows `1×`, popover lists `availableRates()`), mute toggle, 📄 subtitle toggle, ⛶ player fullscreen (Task 9 wires it; in this task the button dispatches `set-fullscreen: player`).
- `LiveSentence`: label `workspace.liveSentence.label`; `RubySentence` with `<ruby>`/`<rt>` per segment flowing inline (`display: inline`, normal wrapping — **not** one segment per line), card height auto; translation beneath per §7.8 (`always` → text; `hidden` → nothing; `reveal` → a button "Show translation" that reveals for this line in this session); 👁̸ toggle (`aria-pressed`, label `workspace.liveSentence.hideJapanese` / `showJapanese`) hides only the Japanese line; while `isSpoken` is false the card uses the softened style; no ✨.
- Furigana mode: `always` → every reading; `hidden` → none; `adaptive` → reuse the existing adaptive rule (`masteryMap`, as `components/video-player/transcript-pane.tsx` / `furigana-text.tsx` do today — find and import that predicate rather than re-deriving it); the per-line override from `SessionState.lineFurigana` wins for that line.

- [ ] **Step 1: Failing tests** (RTL): ruby renders all segments inside one paragraph; translation modes (three cases + reveal click); 👁̸ hides Japanese and keeps translation and does not call `pause`; loop popover sets count and the pill reflects `aria-pressed`; beat markers render exactly one `svg` with `n` lines and **zero** focusable descendants (`querySelectorAll('[tabindex],button,a,input')` inside it → 0); subtitle toggle hides the overlay text.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Run** → PASS; token-scale pins bumped.
- [ ] **Step 4: Commit** — `feat(shadowing): workspace player and Live Sentence`.

---

### Task 7: Transcript panel

**Files:**
- Create: `components/shadowing-workspace/transcript-panel.tsx`, `transcript-row.tsx`, `use-auto-follow.ts` (+ tests)
- Modify: `(workspace)/page.tsx` (renders the panel), messages (+ pins)

**Interfaces:**
- Consumes: Task 3 `matchingLineIndexes`, Task 4 hooks, Task 6 `RubySentence`; existing `MineLineControl` and `PinLineControl` (`components/video-player/*`, props `{ line: TranscriptLineRow }` — adapt a `WorkspaceLine` back to that shape in one helper `toTranscriptLineRow(line)` in `lib/shadowing-workspace/types.ts`).
- Produces: `<TranscriptPanel />`, `useAutoFollow(containerRef, currentIndex, enabled)` returning `{ suspended: boolean; resume(): void }`.

Behaviour (spec §7.6, §7.8):
- Header: label, `workspace.transcript.meta` = "{count} sentences · {minutes} min" (`t` with values), 👁 button cycling the session override (`aria-pressed` reflects the effective state), ⤢ (`toggle-view: full-transcript`), search `<input type="search">` with label.
- Rows (`<ol>` of `<li>`, each row a focusable element with `aria-current="true"` when current): number (original `index + 1`, zero-padded to 2 like Figma), Japanese, small translation (effective mode), state classes for current / past / future, `isSpoken=false` softening, bookmark and difficult indicators (`aria-label`ed icons).
- Hover/focus-within actions: Replay (`seekToSentence(i, { play: true })`), Bookmark and Difficult (`toggleMark`, `aria-pressed`), `MineLineControl`, `PinLineControl`, furigana-for-this-line (`toggle-line-furigana`). Clicking the row body = Replay.
- Search: filter to `matchingLineIndexes`; Enter → `seekToSentence(first)`; auto-follow suspended while the query is non-empty.
- Auto-follow: when `currentIndex` changes and not suspended, scroll the row to the centre — `behavior: "smooth"` unless reduce motion (`lib/motion/motion-enabled.ts`), `instant` otherwise. Set a `programmaticScrollUntil` timestamp (now + 600 ms, or until `scrollend`) before scrolling; a `scroll`/`wheel`/`touchmove`/`keydown(PageUp/PageDown/Home/End)` outside that window suspends auto-follow and shows the pill `workspace.transcript.backToCurrent`, which resumes and scrolls.
- In `full-transcript` view the rows render `RubySentence` (furigana) and a wider reading measure (`readingWidth`).

- [ ] **Step 1: Failing tests:** current row has `aria-current`; past rows get the past style; marks toggle with `aria-pressed` and call `fetch` with PUT then DELETE; search filters and keeps original numbers; Enter seeks to the first match; 👁 override does not call `/api/user/preferences`; furigana-for-this-line changes only that row; `useAutoFollow`: a programmatic scroll does not suspend, a user `wheel` does, `resume()` clears it.
- [ ] **Step 2: Implement.** **Step 3: Run** → PASS. **Mutation:** remove the programmatic-scroll window → the "programmatic scroll does not suspend" test fails.
- [ ] **Step 4: Commit** — `feat(shadowing): transcript panel with search, marks and auto-follow`.

---

### Task 8: Header, lesson bookmark, overflow and mode navigation

Blocked on the owner's answer to the Open question above.

**Files:**
- Create: `components/shadowing-workspace/workspace-header.tsx`, `lesson-bookmark-button.tsx`, `workspace-overflow-menu.tsx`, `mode-nav.tsx` (+ tests)
- Modify: shell (header slot), messages (+ pins); if the owner picked (b): the videos migration (in place), `VIDEO_COLUMNS`, the lesson-creation pipeline's persist step, Task 11's seed script

**Behaviour (spec §7.2, Q1):**
- ← Back: `Link` to `/shadowing` (`@/lib/i18n` navigation), label `workspace.header.back`.
- Title (`h1`), source line (per the owner's answer), JLPT badge (existing `Badge`), `workspace.header.sentenceCounter` "Sentence {current} / {total}" (current = `index + 1`, or `—` before the first line).
- Right: Study Environment (Task 10 popover trigger), Focus Mode (`toggle-view: focus`, `aria-pressed`), ⛶ workspace fullscreen (Task 9), ⚙ Reading Settings (Task 10 trigger), `LessonBookmarkButton` (`aria-pressed`, PUT/DELETE `/api/videos/[id]/bookmark` through `useMarks().toggleLessonBookmark`), `⋯` overflow (Radix Popover with a `role="menu"` list): **Save to playlist** — reuse `components/community/save-to-playlist-button.tsx` (check its API; render it inside the menu) — and **Download transcript** with two items `.srt` / `.txt` using `toSrt` / `toPlainText` and a `Blob` + object URL download (`<video title>.srt`), absent when there is no transcript.
- `ModeNav`: renders `null` when `shouldRenderModeNav()` is false; otherwise a `nav` with `aria-label` and one `Link` per completed mode, `aria-current="page"` on the active one. A test injects a two-mode registry to prove the bar renders.

- [ ] **Step 1: Failing tests** for each bullet (counter text at index null / 0 / 281 of 282; bookmark race uses the keyed mutator; download produces the exact `toSrt` text — spy on `URL.createObjectURL`; ModeNav null by default, renders with two modes).
- [ ] **Step 2: Implement.** **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(shadowing): workspace header, lesson bookmark, overflow and mode navigation`.

---

### Task 9: Views, fullscreen, Escape, shortcuts and the divider

**Files:**
- Create: `components/shadowing-workspace/use-fullscreen.ts`, `use-workspace-shortcuts.ts`, `workspace-divider.tsx` (+ tests)
- Modify: shell (view-dependent layout classes, PiP container), Live Sentence/transcript (hidden per view)

**Behaviour (spec §7.4 shortcuts and Escape, §7.7):**
- Layout by `view`: `normal` — two columns with the divider; `focus` — transcript not rendered, left column centred `max-width ≈ 60rem` (token, not px literal); `full-transcript` — transcript full width; the **same** player element moves into a fixed bottom-right PiP container via CSS (the player's DOM node is never unmounted: keep one wrapper whose classes change; assert with a mount counter).
- `useFullscreen`: `requestFullscreen` on the workspace root or the player wrapper; listens to `fullscreenchange` to sync `SessionState.fullscreen`; restores focus to the triggering button on exit.
- Escape handler at the shell: compute `escapeAction` from `openPopover`, `fullscreen`, `view`; Radix already closes its own popover on Escape — the shell must ignore an Escape whose event was already handled (`event.defaultPrevented`) or whose target is inside a popover/dialog, so one press does one thing; `exit-fullscreen` lets the browser do it (no extra `exit-view` on the same press).
- `useWorkspaceShortcuts`: `keydown` on `document`; `shortcutFor(event)`; ignore when `isInteractiveTarget(event.target)`; `preventDefault` for Space so the page does not scroll.
- `WorkspaceDivider`: `role="separator"`, `aria-orientation="vertical"`, `aria-valuemin`/`max`/`now` (percent), `tabIndex=0`, visible focus ring token; pointer drag (pointer capture) and ←/→ step 5%; clamps so each pane ≥ its minimum (left ≥ 22rem, right ≥ 20rem — tokens); ratio stored in `SessionState.splitRatio`.

- [ ] **Step 1: Failing tests:** view transitions render/hide the right regions; the player mount counter stays 1 across normal → focus → full-transcript → normal and across a divider drag and a settings change; Escape with a popover open closes only the popover (Review Focus 5); Space on a focused slider does not call `togglePlay`; Space on body does and is `preventDefault`ed; divider keyboard changes `aria-valuenow` by 5 and clamps; fullscreen with `document.documentElement.requestFullscreen` shimmed: state set, Escape order respected, focus restored.
- [ ] **Step 2: Implement.** **Step 3: Run** → PASS.
- [ ] **Step 4: Commit** — `feat(shadowing): focus and full-transcript views, fullscreen, shortcuts and the divider`.

---

### Task 10: Reading Settings, Study Environment and contrast

**Files:**
- Create: `components/shadowing-workspace/reading-settings-popover.tsx`, `study-environment-popover.tsx`, `atmosphere-layer.tsx` (+ tests)
- Create: `test/css-tokens.ts` (move `parsePrimitives`, `parseAliases`, HSL→RGB, luminance, contrast, alpha blend out of `lib/design-tokens.contrast.test.ts`; that test imports them — behaviour unchanged)
- Create: `lib/shadowing-workspace/reading-theme.contrast.test.ts`
- Modify: `app/globals.css` (reading presets, atmosphere tokens and particles), `(workspace)/layout.tsx` (load `Noto_Serif_JP` via `next/font/google` with `variable: "--font-jp-serif"`, applied on the workspace root only)

**Behaviour (spec §6):**
- ⚙ popover (non-modal `Popover`, not `Dialog`): one control per setting in §6.1's table using existing `SegmentedControl`, `Select`, `Switch`; each change → `setPreference(key, value)` immediately. Shortcut hints switch persists `showShortcutHints`; the hint sheet itself is a separate small popover whose open state is session-only and which opens by default only when `showShortcutHints` is true.
- Applying settings: the workspace root gets `data-reading-preset`, `data-reading-size`, `data-reading-line-height`, `data-reading-width`, `data-reading-emphasis`, `data-reading-font`, `data-atmosphere`; `globals.css` maps them to CSS variables (`--reading-surface`, `--reading-foreground`, `--reading-muted`, `--reading-scale`, `--reading-leading`, `--reading-measure`, `--reading-current-surface`, `--atmosphere-glow`, `--atmosphere-overlay`, `--atmosphere-glass`, `--atmosphere-shadow`). Every colour is an HSL triplet primitive plus `var()` alias, the format `test/css-tokens.ts` parses.
- Reading size multiplies the existing display scale: `font-size: calc(var(--reading-scale) * <base token>)` inside the workspace only.
- `playbackDefaultRate` applies when the player becomes ready; changing it later also sets the live rate. `playbackLoopCount` sets the default of the Sentence popover. `playbackAutoPause` feeds `LoopConfig.autoPause`. `resumeBehavior` is read by `resolveStartPosition` at load.
- Study Environment popover: radio list None + six (labels in messages, VI + EN). `AtmosphereLayer`: `aria-hidden`, `pointer-events: none`, absolutely positioned behind content; glow + overlay as gradients; particles: ≤ 12 spans with a keyframe animation, rendered only when the atmosphere has particles. CSS: `:root[data-reduce-motion="true"] .atmosphere-particles, @media (prefers-reduced-motion: reduce) { .atmosphere-particles { display: none } }` — not slowed, removed.
- Atmospheres never set a text colour; text sits on `--reading-surface` blended with `--atmosphere-glass` and `--atmosphere-overlay`.

- [ ] **Step 1: Failing tests:**
  - `reading-theme.contrast.test.ts`: for each of 4 presets × 7 atmospheres, compute the effective surface (preset surface → blend glass at its alpha → blend overlay at its alpha) and assert `contrast(--reading-foreground, surface) ≥ 4.5` and `contrast(--reading-muted, surface) ≥ 4.5` and the current-sentence surface likewise; the test fails with the pair named.
  - a CSS test (string scan of `globals.css`, like `design-tokens.test.ts`) that `.atmosphere-particles` is `display: none` under both the media query and `[data-reduce-motion="true"]`, and that no `[data-atmosphere=…]` block sets `color` or a `--reading-foreground`.
  - RTL: changing a setting calls `setPreference` with the exact key/value; the root's data attributes follow; the Environment popover sets `studyAtmosphere`; particles are absent from the DOM when reduce motion is on.
- [ ] **Step 2: Implement.** **Step 3: Run** → PASS (the moved helpers keep `lib/design-tokens.contrast.test.ts` green). **Mutation:** set the high-contrast preset's muted colour to the surface colour → the contrast test fails naming that pair.
- [ ] **Step 4: Commit** — `feat(shadowing): reading settings, study environment and contrast gate`.

---

### Task 11: Browser acceptance — deterministic and live (Claude)

**Files:**
- Create: `tests/e2e/fixtures/fake-youtube.ts`, `tests/e2e/fixtures/workspace-data.ts`, `tests/e2e/shadowing-workspace.spec.ts`
- Create: `scripts/seed-real-lesson.ts`, `playwright.live.config.ts`, `tests/e2e/shadowing-workspace.live.spec.ts`
- Modify: `playwright.config.ts` (`testIgnore` gains `"*.live.spec.ts"`), `package.json` (`"test:e2e:live": "playwright test --config=playwright.live.config.ts"`)

**fake-youtube.ts** — `export async function installFakeYouTube(page: Page): Promise<void>` calls `page.addInitScript` with a script that defines `window.YT = { Player, PlayerState }` **before** the app loads (the app's loader returns early when `window.YT.Player` exists — `load-youtube-api.ts:71`). The fake `Player` implements every `YtPlayerLike` member the app uses after Task 5 (including `getAvailablePlaybackRates`, `mute`, `unMute`, `isMuted`, and T0's initialisation call), renders a `<div data-testid="fake-yt">` into the host, fires `onReady` on a microtask, and exposes `window.__fakeYt = { advance(seconds), setTime(t), state(), mounts }` so tests drive the clock: `advance` moves time while PLAYING at the current rate and emits ticks through whatever tick source the app uses (if the app reads `getCurrentTime()` in rAF, `advance` only needs to move the value; if it relies on the 250 ms interval, use `page.clock`). `mounts` counts `new Player` calls.

**workspace-data.ts** — service-role seed like `tests/e2e/fixtures/search-data.ts`: one FREE video with a unique prefix and 30 synthetic lines (3 s each, two with equal `start_time`, one with `end_time: null`, Vietnamese translations, furigana from `toFurigana`), returns `{ videoId, lineIds, cleanup }`.

**shadowing-workspace.spec.ts** — viewport 1280×529, fresh learner per test (`registerViaUi`), `installFakeYouTube` before `goto`. Tests:
1. Layout: header, player, Live Sentence Japanese line, transcript all visible without page scroll; no horizontal overflow; `fake-yt` mounted once.
2. Sync: `setTime(7)` + play → Live Sentence and the `aria-current` row show line 3; `advance` across 3 boundaries → each switches; the gap line shows the softened state.
3. Loop ×3 + Auto Pause (via Settings and the Sentence popover): exactly three seeks back to the start, then state PAUSED, current unchanged.
4. Resume: play to line 12, navigate to `/en/shadowing` by clicking Back (client-side), click back into the lesson → current line 12, state not PLAYING, `mounts` = 2 (a new page mount is expected here; the "same instance across modes" gate is Part 2's).
5. Corrupt position: as service role set `last_watched_position = 99999` → opens at line 1.
6. `?line=<id of another video's line>` → ignored, resume applies; `?line=<own line 20>` → line 20 even with `restart`.
7. Marks + bookmark + a preference, then **client-side** leave-and-return (Back link, then the Hub card or `page.goBack()` — not `reload`) → all three show the new state.
8. Views: Focus hides the transcript; Full Transcript shows furigana rows and the PiP; Escape returns to normal; `mounts` unchanged across all of it and across a divider drag and a settings change.
9. Divider: keyboard ←/→ changes `aria-valuenow`; drag changes the pane widths; neither pane shrinks below its minimum.
10. Fullscreen shimmed (`addInitScript` stubbing `Element.prototype.requestFullscreen` / `document.exitFullscreen` and dispatching `fullscreenchange`): one Escape exits fullscreen only, the next exits Focus.
11. Shortcuts: Space toggles play on body; Space with the progress slider focused does not.
12. Atmosphere: choose Rainy Day → `data-atmosphere="rainy_day"`; with reduce motion on, no `.atmosphere-particles` in the DOM.

**scripts/seed-real-lesson.ts** — run with `npx vite-node scripts/seed-real-lesson.ts -- --dir <path> --youtube <id>`: reads the `*[ja].srt` and `*[ja-vi]*.srt` in `--dir`, `parseTranscript` both, fails unless counts and every `startTime` match, upserts the video by `youtube_video_id` (FREE, title from the file name, `duration_seconds` from the last end), replaces its transcript (`youtube_caption`), inserts lines with `toFurigana` and the Vietnamese text, and prints `video <uuid> lines <n>`. Idempotent: a second run leaves exactly one video and one transcript. (Starts from the session scratchpad seed of 2026-10-01; `videos` has no `status` column any more.)

**playwright.live.config.ts** — same as `playwright.config.ts` but `testMatch: "*.live.spec.ts"`, no `testIgnore`, and `webServer` reused only (`reuseExistingServer: true`, no build) — the live run is against a server the operator started in the worktree.

**shadowing-workspace.live.spec.ts** — reads `EP729_VIDEO_ID` (the lesson uuid) from env; if unset or the video does not exist → `throw new Error("fixture missing: run scripts/seed-real-lesson.ts and set EP729_VIDEO_ID")`. Steps:
1. Assert a real `iframe[src*="youtube.com/embed/Fwj3tH4Uls8"]` is attached and, via the page, `getDuration()` is within 1390–1400 s (proves the subject exists before anything is measured).
2. Seek to the middle (~700 s) → the current row's `[start, end)` contains the player time.
3. Latency: play at 1×; for 8 consecutive boundaries record `(time the current-row attribute changed, measured with a MutationObserver + performance.now()) − (time getCurrentTime() first ≥ the line's start_time, polled in rAF)`; attach all deltas plus max and p95 to the report (`testInfo.attach`); assert every delta ≤ 300 ms. If it fails, the attachment is the evidence for the owner — never raise the threshold.
4. Auto-follow, replay, loop ×3 (count seeks via the time going backwards), speed 0.75 (`getPlaybackRate`), furigana present, Vietnamese translation text matches the seeded line.
5. Resume: seek to X, client-side leave and return → within one sentence of X, paused.
6. Corrupt position → 0.

- [ ] **Step 1:** Write `fake-youtube.ts` and `workspace-data.ts`; prove the fake is the subject: test 1 asserts `[data-testid="fake-yt"]` exists and no real `youtube.com` request was made (`page.on("request")`).
- [ ] **Step 2:** Write tests 1–12; run against a worktree build on port 3000 (`npm run build && npm run start` in the worktree, then `npx playwright test tests/e2e/shadowing-workspace.spec.ts`). Kill any orphan on :3000 first (`netstat -ano | grep :3000`).
- [ ] **Step 3:** Also run `tests/e2e/shadowing-hub.spec.ts` and `tests/e2e/shadowing-explore.spec.ts` → green (alone if the known parallel-load flake appears; record it).
- [ ] **Step 4:** Write the seed script and run it twice against the local DB → one video, 282 lines; record the uuid in the run state.
- [ ] **Step 5:** Write the live config and spec; run `EP729_VIDEO_ID=<uuid> npm run test:e2e:live` → green, deltas attached; paste max/p95 into the run state.
- [ ] **Step 6: Commit** — `test(e2e): shadowing workspace deterministic and Ep.729 live acceptance`.

---

### Task 12: Parity, removal of the legacy view, documentation

**Files:**
- Delete: `components/video-player/shadowing-view.tsx` and its test **only if** nothing else imports it (grep `shadowing-view` across `app/`, `components/`, `lib/`, `tests/`).
- Keep, verified untouched: `shadowing-recorder-panel.tsx`, `video-summary-panel.tsx`, `playback-controls.tsx` and `transcript-pane.tsx` if they still have callers (`dictation-view`, …) — delete a file only when grep shows no caller, and list each kept/deleted file with its caller count in the run state.
- Modify: `docs/design/screens/screen-shadowing-practice.md` (Header: the 1a header; Sidebar unchanged; a "Part 1a deviations" note pointing to spec §3; Reading Settings: translation language and silence-based auto-pause deferred, quick controls are session overrides §7.8; Sentence Actions: Bookmark/Difficult are `sentence_marks`), `docs/product/domain-model.md` (add **Sentence Mark** and **Lesson Bookmark**, and say what they are not: Pin, Mining, My Lessons, Playlist).
- Modify: `messages/*/shadowing.json` — remove keys only the deleted view used (and their pins).

- [ ] **Step 1: Parity checklist** against the legacy view, each with the test that proves it: player controls (T6/T11), resume (T11-4/5), transcript sync (T11-2), mining/pin (T7), speed/loop (T6/T11-3), persistence (T11-7), player error overlay (port the `playerError` alert into `WorkspacePlayer` if not done — legacy behaviour), no-transcript empty state (T4).
- [ ] **Step 2: Dead-code audit and deletion** as above; tsc/lint/vitest green.
- [ ] **Step 3: Docs.**
- [ ] **Step 4: Full gate:** fresh `npx supabase db reset`; every `verify:db:*`; tsc, lint, protocol, vitest; deterministic e2e + hub/explore specs; live Ep.729 spec. Record every exit code and the latency numbers in the run state.
- [ ] **Step 5: Commit** — `chore(shadowing): retire the legacy shadowing view; document part 1a`.

---

## Self-review (2026-10-01)

- Spec coverage: §2 Q1 → T3 `learning-modes` + T8; Q2 → T3 `workspace-view` + T9; Q3 → no drawer, ✨ absent (T6); Q4 → Global Constraints + T12; Q5 → T1/T2/T7; Bookmark → T1/T2/T8. §3 deviations → T6 (16:9, ruby), T8 (Back, overflow), T9 (50/50 divider), T12 (docs). §4.2 truncation → T2. §4.3 stores, race, stale bootstrap → T4, T11-7. §5 → T1/T2. §6 → T1/T2/T10. §7.1 viewport → T6/T11-1. §7.4 → T3/T5/T9/T11. §7.5–7.8 → T6/T7. §8 → T1 gate, T3–T10 unit/component, T11 e2e + live. §9 order → task order; T0 and T11 are Claude's.
- Placeholders: none intended; the source-line choice is an explicit owner question, not a TBD.
- Names: `WorkspaceLine`, `SentencePosition`, `LoopConfig`, `PlaybackController`, `PlaybackPositionStore`, `WorkspaceBootstrap`, `SessionState`, `createKeyedMutator`, `resolveStartPosition`, `shouldWriteServer` are used with the same spelling in every task.
