# Shadowing Hub Lesson Workspace — Plan B (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data layer for the Lesson domain model — `library_access` replacing `status`,
the `user_lesson_library` dedup/quota ledger, `collections`/`lesson_collections` curation tables,
the Create Lesson pipeline, and the admin Promotion Queue backend — so Plan C (Hub UI) and Plan D
(Lesson UI) have a stable API surface to build against.

**Architecture:** Five sequential migrations (additive first, destructive last, so no policy ever
references a column that's been dropped out from under it) followed by a rewrite of
`lib/data/videos.ts` / `lib/data/admin-videos.ts` and three new modules
(`lib/data/lesson-library.ts`, `lib/data/transcript-providers.ts`, `lib/data/lesson-creation.ts`).
Every DB write outside the learner's own RLS-visible rows goes through the service-role client,
matching the existing `lib/admin/guard.ts` / `lib/data/admin-videos.ts` convention.

**Tech Stack:** PostgreSQL/Supabase migrations, Next.js API routes, TypeScript strict, Vitest +
`test/supabase-mock.ts`'s `createMockSupabase` harness.

## Global Constraints

- **CLAUDE.md §2**: never download, re-host, or proxy video — this plan's caption fetch reads only
  YouTube's own publicly-served caption *text* track (`timedtext`), never audio/video bytes.
- **CLAUDE.md §2**: no `youtube-dl`/`ytdl`/any downloader, and no scraping of third-party
  subtitle-download sites (downsub-style) — ruled out explicitly during this plan's brainstorm as an
  unstable foundation (ToS/HTML-churn risk), not something to build on even as a fallback.
- **TypeScript strict**, no `any` without a justifying comment. Validate every API input with zod.
- **Every write outside RLS-visible own-rows uses `createServiceClient()`**, never the request-scoped
  client — mirrors `lib/admin/guard.ts` and every function in the current `lib/data/admin-videos.ts`.
- **No dead code, no TODOs left behind.** A deferred feature gets a typed stub that fails loudly
  (501/"not implemented"), never a silent no-op.
- **TDD**: write the failing test first for every new function; migrations are verified by applying
  them (`npx supabase db reset`) and querying the result.
- Naming follows the domain model this spec introduces: **Lesson** in product vocabulary, `videos`
  stays the physical table name (deferred rename, spec §1.1) — new tables use "lesson" (`lesson_id`,
  `user_lesson_library`, `lesson_collections`) since they have no legacy to carry.

## Decisions locked before this plan was written (read before touching Task 10+)

These resolve three points the source spec (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md`)
left open or that conflicted with CLAUDE.md §2, decided with the user on 2026-07-31:

1. **AI Transcript Generation is a stub in this plan, not a real implementation.** The spec's §2.1
   step 6 "Generate transcript" (Plus-only AI fallback when no YouTube caption exists) would require
   fetching the video's audio to run STT — a gray area against CLAUDE.md §2's downloader ban that
   needs its own explicit sign-off before real work starts. This plan builds the `TranscriptProvider`
   abstraction (Task 11) with `youtubeCaptionProvider` fully implemented and `aiTranscriptProvider` as
   a typed stub returning `{ ok: false, status: 501 }`. Swapping in a real STT backend later is an
   isolated follow-up task against that same interface, not a rewrite.
2. **A lesson only ever reaches `FREE`/`PLUS` with a transcript already attached.** Admin-published
   lessons always carry a transcript (via Create Lesson's own caption fetch, or the existing
   `replaceVideoTranscript` SRT-paste flow) — there is no "publish a lesson with no transcript" path.
   `promoteVideo` (Task 16) enforces this with a transcript-existence check before flipping
   `library_access`.
3. **The Promotion Queue's admin UI is out of scope for this plan.** Task 16/17 build the full
   four-view backend (Needs Review / Trending / Ready to Promote / Published) and the
   promote/demote/star actions, but only the two views the *existing* admin UI already renders
   (Needs Review via the renamed `listNeedsReview`, promote via the extended `/approve` route) are
   wired to anything visible. Trending/Ready/Published have working queries and routes with no
   consuming UI yet — that UI is a separate, later plan.

---

### Task 1: Migration — `lesson_access_level` enum + `videos.library_access` column

**Files:**
- Create: `supabase/migrations/20260731000017_lesson_access_level.sql`

**Interfaces:**
- Produces: column `videos.library_access lesson_access_level not null default 'PRIVATE'`,
  backfilled from the existing `status` column. `status` itself is untouched here — it still backs
  the current RLS policies until Task 5 rewrites them, and dropping it before that would break
  every existing read.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260731000017_lesson_access_level.sql
-- Shadowing Hub Lesson Workspace spec §1.2 / §9 item 1.
--
-- Split into two migrations on purpose (this one + 20260731000021's cleanup):
-- `videos_read`/`videos_insert` (20260712000002_rls.sql, 20260712000009) still
-- reference `status` until Task 5 rewrites them. Dropping `status` here would
-- break every existing policy mid-migration-sequence. `library_access` is
-- added and backfilled now; `status`/`video_status` are dropped only once
-- nothing references them (Task 6).

create type lesson_access_level as enum ('PRIVATE', 'FREE', 'PLUS');

alter table videos add column library_access lesson_access_level not null default 'PRIVATE';

update videos set library_access = 'FREE' where status = 'approved';
-- status = 'pending' rows already default to 'PRIVATE' from the column default; no-op for them,
-- but stated explicitly so a future reader doesn't have to infer it.
update videos set library_access = 'PRIVATE' where status = 'pending';
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset` (replays every migration against the local DB, including this one).
Then verify the backfill:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select status, library_access, count(*) from videos group by 1, 2 order by 1;"
```

Expected: every `pending` row shows `library_access = PRIVATE`, every `approved` row shows
`library_access = FREE` (the seed script's videos, if any, are the rows you'll see — an empty result
set is also correct on a freshly reset DB with no seeded videos).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260731000017_lesson_access_level.sql
git commit -m "feat(db): add lesson_access_level enum and videos.library_access column"
```

---

### Task 2: Migration — `user_lesson_library` table + RLS

**Files:**
- Create: `supabase/migrations/20260731000018_user_lesson_library.sql`

**Interfaces:**
- Consumes: `videos.id`, `users.id` (existing).
- Produces: table `user_lesson_library(user_id, lesson_id, added_at)`, primary key
  `(user_id, lesson_id)`. This is both the personal-library membership table and the monthly quota
  ledger (Task 12 reads it by `count(*) where user_id = ? and added_at >= start_of_month`).

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260731000018_user_lesson_library.sql
-- Shadowing Hub Lesson Workspace spec §1.3 / §9 item 2 (part 1 of 2).

create table user_lesson_library (
  user_id uuid not null references users (id) on delete cascade,
  lesson_id uuid not null references videos (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table user_lesson_library enable row level security;

create policy user_lesson_library_read on user_lesson_library for select to authenticated
  using (user_id = auth.uid());
create policy user_lesson_library_insert on user_lesson_library for insert to authenticated
  with check (user_id = auth.uid());
-- No update/delete policy: library membership is append-only from the client's perspective (no
-- "remove from my lessons" feature is designed yet — out of scope, same as the source spec's §10).
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`. Verify the table and policies exist:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d user_lesson_library"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select polname from pg_policies where tablename = 'user_lesson_library';"
```

Expected: `\d` shows the two-column primary key + `added_at`; the policy query returns
`user_lesson_library_read` and `user_lesson_library_insert`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260731000018_user_lesson_library.sql
git commit -m "feat(db): add user_lesson_library table (personal library + quota ledger)"
```

---

### Task 3: Migration — `collections` + `lesson_collections` tables + RLS

**Files:**
- Create: `supabase/migrations/20260731000019_collections.sql`

**Interfaces:**
- Produces: `collections(id, slug, title, description, cover_image_url, display_order, created_at)`,
  `lesson_collections(lesson_id, collection_id)`. Both public-read (`using (true)`), no client write
  policy — matches the existing `grammar_points`/`badges` read-only-content pattern.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260731000019_collections.sql
-- Shadowing Hub Lesson Workspace spec §1.4 / §9 item 2 (part 2 of 2). Featured
-- is a `collections` row with slug = 'featured', not a boolean column or a
-- fourth `library_access` value — see spec §1.4 for the full rationale.

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

alter table collections enable row level security;
alter table lesson_collections enable row level security;

create policy collections_read on collections for select to authenticated using (true);
create policy lesson_collections_read on lesson_collections for select to authenticated using (true);
-- Writes are service-role only (admin curation flow) — no insert/update/delete policy needed, same
-- convention as radicals/kanji/vocab/grammar_points/badges/jlpt_tests.
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`. Verify:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select polname, tablename from pg_policies where tablename in ('collections', 'lesson_collections');"
```

Expected: four rows (`collections_read`/`collections`, `lesson_collections_read`/`lesson_collections`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260731000019_collections.sql
git commit -m "feat(db): add collections and lesson_collections tables"
```

---

### Task 4: Migration — `videos.promotion_starred` column

**Files:**
- Create: `supabase/migrations/20260731000020_promotion_starred.sql`

**Interfaces:**
- Produces: `videos.promotion_starred boolean not null default false` — backs the Promotion Queue's
  "Ready to Promote" shortlist (spec §4.2). The source spec names this view but never defines its
  storage; this column is the gap-fill, flagged here rather than silently invented.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260731000020_promotion_starred.sql
-- Backs the Promotion Queue's "Ready to Promote" view (spec §4.2), which the
-- spec describes as "admin's own shortlist/starred subset" without naming a
-- storage column — this fills that gap. Admin-only: no client write policy;
-- reads ride the existing `videos_read` policy once §1.2's rewrite (Task 5)
-- lands (a PRIVATE lesson's own owner, or an admin via service-role, can see it).

alter table videos add column promotion_starred boolean not null default false;
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`. Verify: `psql ... -c "\d videos"` shows `promotion_starred` as
`boolean not null default false`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260731000020_promotion_starred.sql
git commit -m "feat(db): add videos.promotion_starred for the Promotion Queue shortlist"
```

---

### Task 5: Migration — rewrite `videos_read` / `transcripts_read` / `transcript_lines_read` / `videos_insert` RLS

**Files:**
- Create: `supabase/migrations/20260731000021_lesson_rls_rewrite.sql`

**Interfaces:**
- Consumes: `videos.library_access` (Task 1), `user_lesson_library` (Task 2), `subscriptions` (existing).
- Produces: the single access-check predicate every future content table joins to unchanged (spec
  §1.2 — "access check lives in exactly one place").

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260731000021_lesson_rls_rewrite.sql
-- Shadowing Hub Lesson Workspace spec §1.2 / §9 item 3. Replaces the
-- status='approved' predicate with the three-branch library_access check.
-- Drops the old policies first (Postgres has no `create or replace policy`).

drop policy videos_read on videos;
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
  or added_by_user_id = auth.uid()
);

drop policy transcripts_read on transcripts;
create policy transcripts_read on transcripts for select to authenticated
  using (exists (
    select 1 from videos v
    where v.id = transcripts.video_id
      and (
        v.library_access = 'FREE'
        or (v.library_access = 'PLUS' and exists (
             select 1 from subscriptions s
             where s.user_id = auth.uid() and s.plan <> 'free' and s.status = 'active'
           ))
        or (v.library_access = 'PRIVATE' and exists (
             select 1 from user_lesson_library l
             where l.user_id = auth.uid() and l.lesson_id = v.id
           ))
        or v.added_by_user_id = auth.uid()
      )
  ));

drop policy transcript_lines_read on transcript_lines;
create policy transcript_lines_read on transcript_lines for select to authenticated
  using (exists (
    select 1 from transcripts t join videos v on v.id = t.video_id
    where t.id = transcript_lines.transcript_id
      and (
        v.library_access = 'FREE'
        or (v.library_access = 'PLUS' and exists (
             select 1 from subscriptions s
             where s.user_id = auth.uid() and s.plan <> 'free' and s.status = 'active'
           ))
        or (v.library_access = 'PRIVATE' and exists (
             select 1 from user_lesson_library l
             where l.user_id = auth.uid() and l.lesson_id = v.id
           ))
        or v.added_by_user_id = auth.uid()
      )
  ));

drop policy videos_insert on videos;
create policy videos_insert on videos for insert to authenticated
  with check (added_by_user_id = auth.uid() and library_access = 'PRIVATE');
```

Note: `added_by_user_id = auth.uid()` is kept as an extra branch (not in the source spec's SQL, which
only names three branches) so a video's own creator can always see their freshly-inserted `PRIVATE`
row even before `lib/data/lesson-creation.ts` (Task 13) gets around to inserting their
`user_lesson_library` row a few statements later in the same request — otherwise there is a brief
window, mid-pipeline, where the owner's own client-visible read of the row they just created would
be denied. Functionally a strict subset of what `user_lesson_library` will grant moments later, so it
widens nothing beyond what the owner will hold anyway.

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`.

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "select polname, tablename from pg_policies where tablename in ('videos', 'transcripts', 'transcript_lines') order by 2, 1;"
```

Expected: `videos_read`, `videos_insert`, `videos_update` on `videos`; `transcripts_read`,
`transcripts_insert` on `transcripts`; `transcript_lines_read`, `transcript_lines_insert` on
`transcript_lines` — same policy *names* as before (only bodies changed), so nothing downstream that
enumerates policies by name breaks.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260731000021_lesson_rls_rewrite.sql
git commit -m "feat(db): rewrite videos/transcripts RLS around library_access"
```

---

### Task 6: Migration — drop `videos.status` + `video_status` enum

**Files:**
- Create: `supabase/migrations/20260731000022_drop_video_status.sql`

**Interfaces:**
- Consumes: nothing after Task 5 lands (no policy references `status` anymore).
- Produces: `videos` table with no `status` column, no `video_status` type in the schema.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260731000022_drop_video_status.sql
-- Shadowing Hub Lesson Workspace spec §1.2 / §9 item 1 (part 2 of 2). Safe
-- now: Task 5 already rewrote every policy that referenced `status`.

alter table videos drop column status;
drop type video_status;
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset` — this is the first migration where a failure here means Task 5 missed a
reference; if the reset fails with a "column status does not exist" or "cannot drop type video_status
because other objects depend on it" error, grep the migrations directory for `video_status` / `status`
before proceeding.

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d videos"
```

Expected: no `status` column listed; `library_access` and `promotion_starred` present.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260731000022_drop_video_status.sql
git commit -m "feat(db): drop videos.status and video_status now that library_access replaces it"
```

---

### Task 7: `lib/data/subscriptions.ts` — plan-tier helper

**Files:**
- Create: `lib/data/subscriptions.ts`
- Test: `lib/data/subscriptions.test.ts`

**Interfaces:**
- Consumes: `createServiceClient()` from `@/lib/supabase/service` (existing).
- Produces: `getActivePlanTier(userId: string): Promise<"free" | "plus">` — used by Task 12's quota
  check and available for any future Plus-gating call site (e.g. the AI Transcript Generation stub's
  gate in Task 11).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/data/subscriptions.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

import { getActivePlanTier } from "./subscriptions";

const USER_ID = "u-sub-1";

function mockService(row: { plan: string; status: string } | null) {
  const supabase = createMockSupabase({
    tables: { subscriptions: () => ({ data: row, error: null }) },
  });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
}

beforeEach(() => {
  vi.mocked(createServiceClient).mockReset();
});

describe("getActivePlanTier", () => {
  it("returns 'free' when the user has no subscriptions row", async () => {
    mockService(null);
    await expect(getActivePlanTier(USER_ID)).resolves.toBe("free");
  });

  it("returns 'free' when plan is 'free' even if status is 'active'", async () => {
    mockService({ plan: "free", status: "active" });
    await expect(getActivePlanTier(USER_ID)).resolves.toBe("free");
  });

  it("returns 'free' when plan is premium but status is not 'active'", async () => {
    mockService({ plan: "premium_monthly", status: "past_due" });
    await expect(getActivePlanTier(USER_ID)).resolves.toBe("free");
  });

  it("returns 'plus' when plan is premium and status is 'active'", async () => {
    mockService({ plan: "premium_yearly", status: "active" });
    await expect(getActivePlanTier(USER_ID)).resolves.toBe("plus");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/data/subscriptions.test.ts`
Expected: FAIL — `./subscriptions` has no exported member `getActivePlanTier` (module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
// lib/data/subscriptions.ts
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Plan-tier resolution, mirroring the exact predicate `videos_read`'s RLS
 * policy uses for the PLUS branch (migration 20260731000021): plan must be
 * non-free AND status must be 'active'. Kept as one function so this
 * definition of "is Plus" never drifts from the DB's own check.
 */
export type PlanTier = "free" | "plus";

interface SubscriptionRow {
  plan: string;
  status: string;
}

export async function getActivePlanTier(userId: string): Promise<PlanTier> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  const row = data as SubscriptionRow | null;
  if (!row) return "free";
  return row.plan !== "free" && row.status === "active" ? "plus" : "free";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/data/subscriptions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/data/subscriptions.ts lib/data/subscriptions.test.ts
git commit -m "feat: add getActivePlanTier helper matching the videos_read RLS predicate"
```

---

### Task 8: `lib/data/videos.ts` — `library_access`, remove `importVideo`

**Files:**
- Modify: `lib/data/videos.ts`
- Modify: `lib/data/videos.test.ts` (only if any fixture references `status`; verify first — as of
  this plan's audit it does not, only `updateProgress` is tested there)

**Interfaces:**
- Produces: `VideoRow` with `library_access: LibraryAccess` replacing `status`; `LibraryAccess =
  "PRIVATE" | "FREE" | "PLUS"` exported for reuse by `lib/video-types.ts` (Task 9) and
  `lib/data/lesson-creation.ts` (Task 13). `importVideo` and `ImportVideoResult` are **removed** —
  Task 13 replaces them with `createLesson`/`CreateLessonResult`.
- Consumes: nothing new.

- [ ] **Step 1: Update `VIDEO_COLUMNS` and `VideoRow`**

In `lib/data/videos.ts`, replace lines 7–20:

```typescript
export const VIDEO_COLUMNS =
  "id, youtube_video_id, title, duration_seconds, thumbnail_url, jlpt_level_estimate, added_by_user_id, library_access, promotion_starred, created_at";

export type LibraryAccess = "PRIVATE" | "FREE" | "PLUS";

export interface VideoRow {
  id: string;
  youtube_video_id: string;
  title: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  jlpt_level_estimate: string | null;
  added_by_user_id: string | null;
  library_access: LibraryAccess;
  promotion_starred: boolean;
  created_at: string;
}
```

- [ ] **Step 2: Remove `importVideo` and `ImportVideoResult`**

Delete lines 53–115 (the `ImportVideoResult` type and `importVideo` function) entirely — this logic
moves to `lib/data/lesson-creation.ts::createLesson` (Task 13), which needs the dedup lookup to run
through the service-role client (spec §1.3's implementation note: an RLS-scoped client cannot see a
`PRIVATE` video it holds no `user_lesson_library` row for, so the old `importVideo`'s
request-scoped-client dedup lookup would now silently miss existing private lessons).

Also remove the now-unused imports this deletion leaves dangling: `parseVideoId`, `fetchOembed`,
`OembedFetchError` (from `@/lib/youtube`), `rateLimit` (from `@/lib/rate-limit`), `ImportVideoInput`
(from `@/lib/validation/video`), and the `IMPORT_LIMIT` constant — check each is unused elsewhere in
the file before deleting (only `updateProgress`, `getVideo`, `setVideoDuration`, `listVideos`,
`selectVideoById`, `requireUser` remain, none of which use these).

- [ ] **Step 3: Run the existing test suite for this file**

Run: `npx vitest run lib/data/videos.test.ts`
Expected: PASS — `updateProgress`'s tests don't touch `status`/`library_access` or `importVideo`, so
they're unaffected by this rename+removal.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors ONLY in files this plan hasn't touched yet (Task 9/14/15/16 fix them in order) — at
minimum `app/api/videos/import/route.ts` (calls the now-deleted `importVideo`) and every file
importing `VideoRow`/`VIDEO_COLUMNS`'s `status` field. Confirm the error list matches exactly the
files this plan's remaining tasks already name — if a file errors that isn't on that list, add it to
Task 15's scope before continuing.

- [ ] **Step 5: Commit**

```bash
git add lib/data/videos.ts
git commit -m "refactor: replace videos.status with library_access, extract importVideo out"
```

---

### Task 9: `lib/video-types.ts` — client-safe type mirror

**Files:**
- Modify: `lib/video-types.ts`

**Interfaces:**
- Produces: `VideoRow`/`VideoStatus` mirror kept in sync with Task 8's server-side types (this file
  has zero runtime imports so client components can import it — see the file's own header comment).

- [ ] **Step 1: Update the type**

Replace lines 13–30 of `lib/video-types.ts`:

```typescript
export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";
export type LibraryAccess = "PRIVATE" | "FREE" | "PLUS";
export type TranscriptSource =
  | "youtube_caption"
  | "user_submitted"
  | "ai_generated";

export interface VideoRow {
  id: string;
  youtube_video_id: string;
  title: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  jlpt_level_estimate: JlptLevel | null;
  added_by_user_id: string | null;
  library_access: LibraryAccess;
  promotion_starred: boolean;
  created_at: string;
}
```

(`VideoStatus` is removed entirely — every consumer moves to `LibraryAccess` in Task 15.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: same error set as Task 8's Step 4, now also covering any file importing `VideoStatus` by
name (none found in this plan's repo-wide audit, but re-check: `grep -rn "VideoStatus" --include=*.ts --include=*.tsx .` should return only this file).

- [ ] **Step 3: Commit**

```bash
git add lib/video-types.ts
git commit -m "refactor: mirror library_access in the client-safe video-types module"
```

---

### Task 10: `lib/youtube/timedtext.ts` — YouTube caption-track fetch

**Files:**
- Create: `lib/youtube/timedtext.ts`
- Create: `lib/youtube/timedtext.test.ts`
- Modify: `lib/youtube/index.ts` (add the new export)

**Interfaces:**
- Produces: `fetchJapaneseCaptions(videoId: string): Promise<TimedTextLine[] | null>` — `null` means
  "no Japanese caption track exists," never throws (best-effort, matches the existing
  `toFurigana`/companion-hook posture elsewhere in this codebase: a caption-fetch failure must not
  crash Create Lesson, it just means "no transcript found").
- Consumes: nothing (calls YouTube's own public `timedtext` endpoint directly via `fetch`).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/youtube/timedtext.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJapaneseCaptions } from "./timedtext";

const VIDEO_ID = "dQw4w9WgXcQ";

const TRACK_LIST_XML = `<?xml version="1.0" encoding="utf-8" ?><transcript_list docid="123">
  <track id="0" name="" lang_code="en" lang_original="English" lang_translated="English" lang_default="true"/>
  <track id="1" name="" lang_code="ja" lang_original="日本語" lang_translated="Japanese" lang_default="false"/>
</transcript_list>`;

const TRACK_LIST_XML_NO_JA = `<?xml version="1.0" encoding="utf-8" ?><transcript_list docid="123">
  <track id="0" name="" lang_code="en" lang_original="English" lang_translated="English" lang_default="true"/>
</transcript_list>`;

const CAPTION_BODY_XML = `<?xml version="1.0" encoding="utf-8" ?><transcript>
<text start="0.5" dur="2.0">こんにちは</text>
<text start="2.5" dur="1.5">&amp;元気ですか&lt;br&gt;</text>
</transcript>`;

function mockFetchSequence(responses: { ok: boolean; text: string }[]) {
  const fetchMock = vi.fn();
  for (const r of responses) {
    fetchMock.mockResolvedValueOnce({ ok: r.ok, text: async () => r.text } as Response);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchJapaneseCaptions", () => {
  it("returns parsed lines when a ja track exists", async () => {
    mockFetchSequence([
      { ok: true, text: TRACK_LIST_XML },
      { ok: true, text: CAPTION_BODY_XML },
    ]);

    const lines = await fetchJapaneseCaptions(VIDEO_ID);

    expect(lines).toEqual([
      { startTime: 0.5, endTime: 2.5, textJp: "こんにちは" },
      { startTime: 2.5, endTime: 4.0, textJp: "&元気ですか<br>" },
    ]);
  });

  it("returns null when no ja track is listed", async () => {
    mockFetchSequence([{ ok: true, text: TRACK_LIST_XML_NO_JA }]);
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toBeNull();
  });

  it("returns null (never throws) when the track-list request fails", async () => {
    mockFetchSequence([{ ok: false, text: "" }]);
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toBeNull();
  });

  it("returns null (never throws) when the track-list fetch itself rejects", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toBeNull();
  });

  it("returns null when the caption body has no <text> entries", async () => {
    mockFetchSequence([
      { ok: true, text: TRACK_LIST_XML },
      { ok: true, text: "<transcript></transcript>" },
    ]);
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/youtube/timedtext.test.ts`
Expected: FAIL — module `./timedtext` does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/youtube/timedtext.ts
/**
 * Best-effort YouTube caption fetch via the unofficial, keyless `timedtext`
 * endpoint (`video.google.com/timedtext`). This reads only the caption TEXT
 * track YouTube itself serves publicly — never audio/video bytes — per
 * CLAUDE.md §2. Never throws: any failure (network, missing track, malformed
 * XML) resolves to `null`, meaning "no transcript found," which Create
 * Lesson (lib/data/lesson-creation.ts) treats as the no-caption branch.
 */

export interface TimedTextLine {
  startTime: number;
  endTime: number;
  textJp: string;
}

interface CaptionTrack {
  langCode: string;
  kind: "manual" | "asr";
}

function trackListUrl(videoId: string): string {
  return `https://video.google.com/timedtext?type=list&v=${encodeURIComponent(videoId)}`;
}

function captionBodyUrl(videoId: string, track: CaptionTrack): string {
  const kindParam = track.kind === "asr" ? "&kind=asr" : "";
  return `https://video.google.com/timedtext?lang=${encodeURIComponent(track.langCode)}${kindParam}&v=${encodeURIComponent(videoId)}`;
}

/** Parses `<track lang_code="ja" kind="asr"?/>` entries out of the type=list response. */
function parseTrackList(xml: string): CaptionTrack[] {
  const tracks: CaptionTrack[] = [];
  const trackRe = /<track\b([^>]*)\/>/g;
  let match: RegExpExecArray | null;
  while ((match = trackRe.exec(xml)) !== null) {
    const attrs = match[1] ?? "";
    const langMatch = /lang_code="([^"]*)"/.exec(attrs);
    if (!langMatch) continue;
    const kind: "manual" | "asr" = /kind="asr"/.test(attrs) ? "asr" : "manual";
    tracks.push({ langCode: langMatch[1] as string, kind });
  }
  return tracks;
}

/** Decodes the handful of entities YouTube's timedtext XML actually emits. */
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Parses `<text start="..." dur="...">...</text>` entries into timed lines. */
function parseCaptionBody(xml: string): TimedTextLine[] {
  const lines: TimedTextLine[] = [];
  const textRe = /<text start="([^"]*)" dur="([^"]*)">([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;
  while ((match = textRe.exec(xml)) !== null) {
    const start = Number.parseFloat(match[1] as string);
    const dur = Number.parseFloat(match[2] as string);
    if (Number.isNaN(start) || Number.isNaN(dur)) continue;
    lines.push({ startTime: start, endTime: start + dur, textJp: decodeEntities((match[3] as string).trim()) });
  }
  return lines;
}

function pickJapaneseTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  const manual = tracks.find((t) => t.langCode === "ja" && t.kind === "manual");
  if (manual) return manual;
  return tracks.find((t) => t.langCode === "ja" && t.kind === "asr") ?? null;
}

/** Fetches the Japanese caption track for a YouTube video, or `null` if none exists / any step fails. */
export async function fetchJapaneseCaptions(videoId: string): Promise<TimedTextLine[] | null> {
  try {
    const listResponse = await fetch(trackListUrl(videoId));
    if (!listResponse.ok) return null;

    const listXml = await listResponse.text();
    const track = pickJapaneseTrack(parseTrackList(listXml));
    if (!track) return null;

    const bodyResponse = await fetch(captionBodyUrl(videoId, track));
    if (!bodyResponse.ok) return null;

    const bodyXml = await bodyResponse.text();
    const lines = parseCaptionBody(bodyXml);
    return lines.length > 0 ? lines : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Export from the module index**

In `lib/youtube/index.ts`, add:

```typescript
export { fetchJapaneseCaptions, type TimedTextLine } from "./timedtext";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/youtube/timedtext.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/youtube/timedtext.ts lib/youtube/timedtext.test.ts lib/youtube/index.ts
git commit -m "feat: fetch YouTube's own Japanese caption track via the timedtext endpoint"
```

---

### Task 11: `lib/data/transcript-providers.ts` — provider abstraction

**Files:**
- Create: `lib/data/transcript-providers.ts`
- Create: `lib/data/transcript-providers.test.ts`

**Interfaces:**
- Consumes: `fetchJapaneseCaptions` (Task 10), `getActivePlanTier` (Task 7).
- Produces: `TranscriptProvider` interface, `youtubeCaptionProvider`, `aiTranscriptProvider` — Task
  13's `createLesson` calls `youtubeCaptionProvider.fetch(videoId)` in its own pipeline;
  `aiTranscriptProvider` exists so a future task can implement real STT behind the same call shape
  without touching `lesson-creation.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/data/transcript-providers.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/youtube", () => ({ fetchJapaneseCaptions: vi.fn() }));

import { fetchJapaneseCaptions } from "@/lib/youtube";
import { aiTranscriptProvider, youtubeCaptionProvider } from "./transcript-providers";

const VIDEO_ID = "dQw4w9WgXcQ";

beforeEach(() => {
  vi.mocked(fetchJapaneseCaptions).mockReset();
});

describe("youtubeCaptionProvider", () => {
  it("returns transcript lines with source 'youtube_caption' when captions exist", async () => {
    vi.mocked(fetchJapaneseCaptions).mockResolvedValue([
      { startTime: 0, endTime: 2, textJp: "こんにちは" },
    ]);

    const result = await youtubeCaptionProvider.fetch(VIDEO_ID);

    expect(result).toEqual({
      source: "youtube_caption",
      lines: [{ startTime: 0, endTime: 2, textJp: "こんにちは", textTranslation: null }],
    });
  });

  it("returns null when fetchJapaneseCaptions returns null", async () => {
    vi.mocked(fetchJapaneseCaptions).mockResolvedValue(null);
    await expect(youtubeCaptionProvider.fetch(VIDEO_ID)).resolves.toBeNull();
  });
});

describe("aiTranscriptProvider", () => {
  it("is a typed not-implemented stub", async () => {
    await expect(aiTranscriptProvider.fetch(VIDEO_ID)).resolves.toEqual({
      ok: false,
      status: 501,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/data/transcript-providers.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/data/transcript-providers.ts
import "server-only";
import { fetchJapaneseCaptions } from "@/lib/youtube";

export interface ProviderTranscriptLine {
  startTime: number;
  endTime: number;
  textJp: string;
  textTranslation: string | null;
}

export interface ProviderTranscriptResult {
  source: "youtube_caption" | "ai_generated";
  lines: ProviderTranscriptLine[];
}

/**
 * A source of transcript lines for a YouTube video ID. `fetch` resolves to
 * `null` when no transcript is available from this provider — never throws;
 * `lib/data/lesson-creation.ts` treats `null` as "try the next provider, or
 * report no-transcript-found if this was the last one."
 */
export interface TranscriptProvider {
  fetch(videoId: string): Promise<ProviderTranscriptResult | null>;
}

export const youtubeCaptionProvider: TranscriptProvider = {
  async fetch(videoId: string): Promise<ProviderTranscriptResult | null> {
    const lines = await fetchJapaneseCaptions(videoId);
    if (!lines) return null;
    return {
      source: "youtube_caption",
      lines: lines.map((line) => ({ ...line, textTranslation: null })),
    };
  },
};

/**
 * STUB. Real AI transcript generation (Plus-only, spec §2.1 step 6 / §3.3)
 * needs a way to get the video's audio to a speech-to-text backend, which is
 * a gray area against CLAUDE.md §2's "never download video from YouTube"
 * rule and was deliberately NOT resolved when this plan was written
 * (2026-07-31) — see this plan's "Decisions locked" section. This stub keeps
 * the call shape `lib/data/lesson-creation.ts` needs stable so a real
 * implementation is a drop-in replacement, not an architecture change.
 */
export const aiTranscriptProvider: TranscriptProvider & {
  fetch(videoId: string): Promise<{ ok: false; status: 501 }>;
} = {
  async fetch(_videoId: string) {
    return { ok: false, status: 501 };
  },
};
```

Note: `aiTranscriptProvider`'s return type intentionally does not satisfy the plain
`TranscriptProvider` interface's `Promise<ProviderTranscriptResult | null>` shape — it is typed
separately (`{ ok: false; status: 501 }`) so any future caller is forced by the compiler to handle the
not-implemented case explicitly, rather than accidentally treating the stub as if it could someday
silently return `null` like a real "no transcript" outcome.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/data/transcript-providers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/data/transcript-providers.ts lib/data/transcript-providers.test.ts
git commit -m "feat: add TranscriptProvider abstraction (YouTube caption + AI stub)"
```

---

### Task 12: `lib/data/lesson-library.ts` — dedup lookup, quota, library membership

**Files:**
- Create: `lib/data/lesson-library.ts`
- Create: `lib/data/lesson-library.test.ts`

**Interfaces:**
- Consumes: `createServiceClient()`, `VIDEO_COLUMNS`/`VideoRow` (Task 8), `getActivePlanTier` (Task 7).
- Produces: `findExistingLesson(youtubeVideoId)`, `hasTranscript(lessonId)`, `countMonthlyCreations(userId, now?)`,
  `isUnderQuota(userId, now?)`, `addToLibrary(userId, lessonId)` (idempotent), `isInLibrary(userId, lessonId)`.
  All consumed by Task 13's `createLesson`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/data/lesson-library.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createServiceClient } from "@/lib/supabase/service";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("./subscriptions", () => ({ getActivePlanTier: vi.fn() }));

import { getActivePlanTier } from "./subscriptions";
import {
  addToLibrary,
  countMonthlyCreations,
  findExistingLesson,
  hasTranscript,
  isInLibrary,
  isUnderQuota,
} from "./lesson-library";

const USER_ID = "u-lib-1";
const LESSON_ID = "l-0000-0000-0000-000000000001";
const NOW = new Date("2026-07-31T12:00:00.000Z");

function mockService(tables: Parameters<typeof createMockSupabase>[0]["tables"]) {
  const supabase = createMockSupabase({ tables });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
  return supabase;
}

beforeEach(() => {
  vi.mocked(createServiceClient).mockReset();
  vi.mocked(getActivePlanTier).mockReset();
});

describe("findExistingLesson", () => {
  it("looks up by youtube_video_id via the service-role client and returns the row", async () => {
    mockService({
      videos: (calls: QueryCall[]) => {
        const eq = calls.find((c): c is Extract<QueryCall, { op: "eq" }> => c.op === "eq");
        expect(eq).toEqual({ op: "eq", column: "youtube_video_id", value: "abc123" });
        return { data: { id: LESSON_ID, youtube_video_id: "abc123" }, error: null };
      },
    });
    await expect(findExistingLesson("abc123")).resolves.toMatchObject({ id: LESSON_ID });
  });

  it("returns null when no lesson exists yet", async () => {
    mockService({ videos: () => ({ data: null, error: null }) });
    await expect(findExistingLesson("no-such-id")).resolves.toBeNull();
  });
});

describe("hasTranscript", () => {
  it("returns true when at least one transcript row exists for the lesson", async () => {
    mockService({ transcripts: () => ({ data: [{ id: "t1" }], error: null }) });
    await expect(hasTranscript(LESSON_ID)).resolves.toBe(true);
  });

  it("returns false when no transcript row exists", async () => {
    mockService({ transcripts: () => ({ data: [], error: null }) });
    await expect(hasTranscript(LESSON_ID)).resolves.toBe(false);
  });
});

describe("countMonthlyCreations / isUnderQuota", () => {
  it("counts user_lesson_library rows added this calendar month", async () => {
    mockService({
      user_lesson_library: (calls: QueryCall[]) => {
        const gte = calls.find((c): c is Extract<QueryCall, { op: "gte" }> => c.op === "gte");
        expect(gte).toEqual({ op: "gte", column: "added_at", value: "2026-07-01T00:00:00.000Z" });
        return { data: [{ lesson_id: "a" }, { lesson_id: "b" }], error: null };
      },
    });
    await expect(countMonthlyCreations(USER_ID, NOW)).resolves.toBe(2);
  });

  it("is always under quota for a plus user regardless of count", async () => {
    vi.mocked(getActivePlanTier).mockResolvedValue("plus");
    mockService({
      user_lesson_library: () => ({ data: [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }, { a: 5 }], error: null }),
    });
    await expect(isUnderQuota(USER_ID, NOW)).resolves.toBe(true);
  });

  it("blocks a free user at 3 creations this month", async () => {
    vi.mocked(getActivePlanTier).mockResolvedValue("free");
    mockService({
      user_lesson_library: () => ({ data: [{ a: 1 }, { a: 2 }, { a: 3 }], error: null }),
    });
    await expect(isUnderQuota(USER_ID, NOW)).resolves.toBe(false);
  });

  it("allows a free user under 3 creations this month", async () => {
    vi.mocked(getActivePlanTier).mockResolvedValue("free");
    mockService({
      user_lesson_library: () => ({ data: [{ a: 1 }], error: null }),
    });
    await expect(isUnderQuota(USER_ID, NOW)).resolves.toBe(true);
  });
});

describe("isInLibrary / addToLibrary", () => {
  it("isInLibrary returns true when a row already exists", async () => {
    mockService({ user_lesson_library: () => ({ data: { user_id: USER_ID, lesson_id: LESSON_ID }, error: null }) });
    await expect(isInLibrary(USER_ID, LESSON_ID)).resolves.toBe(true);
  });

  it("addToLibrary upserts on (user_id, lesson_id) so a re-add is a no-op, not a duplicate", async () => {
    let upsertCalls: QueryCall[] = [];
    mockService({
      user_lesson_library: (calls: QueryCall[]) => {
        upsertCalls = calls;
        return { data: { user_id: USER_ID, lesson_id: LESSON_ID }, error: null };
      },
    });
    await addToLibrary(USER_ID, LESSON_ID);
    const upsert = upsertCalls.find((c): c is Extract<QueryCall, { op: "upsert" }> => c.op === "upsert");
    expect(upsert?.values).toEqual({ user_id: USER_ID, lesson_id: LESSON_ID });
    expect(upsert?.options).toEqual({ onConflict: "user_id,lesson_id", ignoreDuplicates: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/data/lesson-library.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/data/lesson-library.ts
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getActivePlanTier } from "@/lib/data/subscriptions";
import { VIDEO_COLUMNS, type VideoRow } from "@/lib/data/videos";

/** Free-tier monthly Create Lesson allowance (spec §3.1). Plus is unlimited. */
export const FREE_MONTHLY_LESSON_QUOTA = 3;

/**
 * Dedup lookup by `youtube_video_id`, ALWAYS via the service-role client
 * (spec §1.3's implementation note) — an ordinary authenticated client
 * cannot see a `PRIVATE` video it holds no `user_lesson_library` row for, so
 * a plain `select` would silently miss existing private lessons and cause
 * duplicate creation.
 */
export async function findExistingLesson(youtubeVideoId: string): Promise<VideoRow | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("videos")
    .select(VIDEO_COLUMNS)
    .eq("youtube_video_id", youtubeVideoId)
    .maybeSingle();
  if (error) throw error;
  return (data as VideoRow | null) ?? null;
}

export async function hasTranscript(lessonId: string): Promise<boolean> {
  const service = createServiceClient();
  const { data, error } = await service.from("transcripts").select("id").eq("video_id", lessonId);
  if (error) throw error;
  return ((data as { id: string }[] | null) ?? []).length > 0;
}

function startOfMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Count of `user_lesson_library` rows added this calendar month — the ONLY quota ledger (spec §3.2). */
export async function countMonthlyCreations(userId: string, now: Date = new Date()): Promise<number> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("user_lesson_library")
    .select("lesson_id")
    .eq("user_id", userId)
    .gte("added_at", startOfMonth(now));
  if (error) throw error;
  return ((data as { lesson_id: string }[] | null) ?? []).length;
}

/** Plus is always unlimited; Free is capped at `FREE_MONTHLY_LESSON_QUOTA` per calendar month. */
export async function isUnderQuota(userId: string, now: Date = new Date()): Promise<boolean> {
  const tier = await getActivePlanTier(userId);
  if (tier === "plus") return true;
  const count = await countMonthlyCreations(userId, now);
  return count < FREE_MONTHLY_LESSON_QUOTA;
}

export async function isInLibrary(userId: string, lessonId: string): Promise<boolean> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("user_lesson_library")
    .select("user_id, lesson_id")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/**
 * Idempotent add: `ignoreDuplicates` makes a re-paste of the same URL by the
 * same user a no-op rather than a duplicate-key error or a second quota hit.
 */
export async function addToLibrary(userId: string, lessonId: string): Promise<void> {
  const service = createServiceClient();
  const { error } = await service
    .from("user_lesson_library")
    .upsert({ user_id: userId, lesson_id: lessonId }, { onConflict: "user_id,lesson_id", ignoreDuplicates: true });
  if (error) throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/data/lesson-library.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/data/lesson-library.ts lib/data/lesson-library.test.ts
git commit -m "feat: add lesson-library dedup lookup, quota accounting, and membership helpers"
```

---

### Task 13: `lib/data/lesson-creation.ts` — the Create Lesson pipeline

**Files:**
- Create: `lib/data/lesson-creation.ts`
- Create: `lib/data/lesson-creation.test.ts`

**Interfaces:**
- Consumes: `requireUser` (Task 8's `lib/data/videos.ts`), `findExistingLesson`/`hasTranscript`/
  `isUnderQuota`/`isInLibrary`/`addToLibrary` (Task 12), `youtubeCaptionProvider` (Task 11),
  `parseVideoId`/`fetchOembed`/`OembedFetchError` (existing `@/lib/youtube`), `toFurigana` (existing
  `@/lib/japanese`), `rateLimit` (existing `@/lib/rate-limit`), `requireAdmin` (existing
  `@/lib/admin/guard`), `VIDEO_COLUMNS`/`VideoRow` (Task 8).
- Produces: `createLesson(input: CreateLessonInput): Promise<CreateLessonResult>` (user-mode) and
  `createLessonAsAdmin(input: CreateLessonAsAdminInput): Promise<CreateLessonResult>` (admin-seed
  mode, spec §4.1 Phase 1) — both are Task 14/17's only entry points into lesson creation.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/data/lesson-creation.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin/guard";
import { fetchOembed, OembedFetchError } from "@/lib/youtube";
import { toFurigana } from "@/lib/japanese";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/youtube", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/youtube")>();
  return { ...actual, fetchOembed: vi.fn() };
});
vi.mock("@/lib/japanese", () => ({ toFurigana: vi.fn() }));
vi.mock("@/lib/data/transcript-providers", () => ({
  youtubeCaptionProvider: { fetch: vi.fn() },
}));

import { youtubeCaptionProvider } from "@/lib/data/transcript-providers";
import { createLesson, createLessonAsAdmin } from "./lesson-creation";

const USER = { id: "u-create-1" };
const ADMIN = { id: "admin-1", email: "admin@example.com" };
const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const VIDEO_ID = "dQw4w9WgXcQ";
const LESSON_ID = "l-0000-0000-0000-000000000099";

function mockClient(user: { id: string } | null) {
  const supabase = createMockSupabase({ user, tables: {} });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

function mockService(tables: Parameters<typeof createMockSupabase>[0]["tables"]) {
  const supabase = createMockSupabase({ tables });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
  return supabase;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createServiceClient).mockReset();
  vi.mocked(requireAdmin).mockReset();
  vi.mocked(fetchOembed).mockReset();
  vi.mocked(toFurigana).mockReset().mockResolvedValue([]);
  vi.mocked(youtubeCaptionProvider.fetch).mockReset();
});

describe("createLesson (user mode)", () => {
  it("returns 401 when signed out", async () => {
    mockClient(null);
    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("returns 400 for an unparseable URL", async () => {
    mockClient(USER);
    const result = await createLesson({ youtubeUrl: "not a url" });
    expect(result).toEqual({ ok: false, status: 400 });
  });

  it("takes the learner straight to an existing FREE lesson with no quota check and no library row", async () => {
    mockClient(USER);
    mockService({
      videos: () => ({
        data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "FREE", promotion_starred: false },
        error: null,
      }),
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });

    expect(result).toMatchObject({ ok: true, alreadyInLibrary: false, transcriptStatus: "existing" });
    expect(fetchOembed).not.toHaveBeenCalled();
  });

  it("dedup-hits an existing PRIVATE lesson with a transcript: quota-checked, library row added, no fetch", async () => {
    mockClient(USER);
    let libraryUpserted = false;
    mockService({
      videos: () => ({
        data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "PRIVATE", promotion_starred: false },
        error: null,
      }),
      transcripts: () => ({ data: [{ id: "t1" }], error: null }),
      subscriptions: () => ({ data: null, error: null }),
      user_lesson_library: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "upsert")) libraryUpserted = true;
        if (calls.some((c) => c.op === "gte")) return { data: [], error: null }; // 0 so far this month
        return { data: null, error: null }; // isInLibrary check: not yet a member
      },
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });

    expect(result).toMatchObject({ ok: true, alreadyInLibrary: false, transcriptStatus: "existing" });
    expect(libraryUpserted).toBe(true);
    expect(fetchOembed).not.toHaveBeenCalled();
    expect(youtubeCaptionProvider.fetch).not.toHaveBeenCalled();
  });

  it("blocks a Free user already at quota from creating a brand-new lesson", async () => {
    mockClient(USER);
    mockService({
      videos: () => ({ data: null, error: null }), // no existing lesson at all
      subscriptions: () => ({ data: null, error: null }), // free tier
      user_lesson_library: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "gte")) return { data: [{ a: 1 }, { a: 2 }, { a: 3 }], error: null };
        return { data: null, error: null };
      },
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });

    expect(result).toEqual({ ok: false, status: 403, reason: "quota_exceeded" });
    expect(fetchOembed).not.toHaveBeenCalled();
  });

  it("creates a brand-new PRIVATE lesson and reports transcriptStatus 'fetched' on caption success", async () => {
    mockClient(USER);
    vi.mocked(fetchOembed).mockResolvedValue({ title: "Test", thumbnailUrl: "t.jpg", authorName: "A" });
    vi.mocked(youtubeCaptionProvider.fetch).mockResolvedValue({
      source: "youtube_caption",
      lines: [{ startTime: 0, endTime: 2, textJp: "こんにちは", textTranslation: null }],
    });
    mockService({
      videos: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "insert")) {
          return {
            data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "PRIVATE", promotion_starred: false },
            error: null,
          };
        }
        return { data: null, error: null }; // dedup lookup: nothing exists yet
      },
      subscriptions: () => ({ data: null, error: null }),
      user_lesson_library: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "gte")) return { data: [], error: null };
        return { data: null, error: null };
      },
      transcripts: () => ({ data: { id: "t-new" }, error: null }),
      transcript_lines: () => ({ data: null, error: null }),
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });

    expect(result).toMatchObject({ ok: true, alreadyInLibrary: false, transcriptStatus: "fetched" });
  });

  it("creates a brand-new PRIVATE lesson but reports transcriptStatus 'missing' with no quota spent on caption failure", async () => {
    mockClient(USER);
    vi.mocked(fetchOembed).mockResolvedValue({ title: "Test", thumbnailUrl: "t.jpg", authorName: "A" });
    vi.mocked(youtubeCaptionProvider.fetch).mockResolvedValue(null);
    let libraryTouched = false;
    mockService({
      videos: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "insert")) {
          return {
            data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "PRIVATE", promotion_starred: false },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      subscriptions: () => ({ data: null, error: null }),
      user_lesson_library: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "gte")) return { data: [], error: null };
        if (calls.some((c) => c.op === "upsert")) libraryTouched = true;
        return { data: null, error: null };
      },
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });

    expect(result).toMatchObject({ ok: true, alreadyInLibrary: false, transcriptStatus: "missing" });
    expect(libraryTouched).toBe(false);
  });

  it("maps an oEmbed failure to a 422", async () => {
    mockClient(USER);
    vi.mocked(fetchOembed).mockRejectedValue(new OembedFetchError("boom"));
    mockService({
      videos: () => ({ data: null, error: null }),
      subscriptions: () => ({ data: null, error: null }),
      user_lesson_library: () => ({ data: [], error: null }),
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });
    expect(result).toEqual({ ok: false, status: 422 });
  });
});

describe("createLessonAsAdmin", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const result = await createLessonAsAdmin({ youtubeUrl: YOUTUBE_URL, libraryAccess: "FREE" });
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("creates directly at the requested tier with no quota check", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, user: ADMIN });
    vi.mocked(fetchOembed).mockResolvedValue({ title: "Test", thumbnailUrl: "t.jpg", authorName: "A" });
    vi.mocked(youtubeCaptionProvider.fetch).mockResolvedValue({
      source: "youtube_caption",
      lines: [{ startTime: 0, endTime: 2, textJp: "こんにちは", textTranslation: null }],
    });
    let insertedLibraryAccess: unknown;
    mockService({
      videos: (calls: QueryCall[]) => {
        const insert = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        if (insert) {
          insertedLibraryAccess = (insert.values as { library_access: unknown }).library_access;
          return {
            data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "FREE", promotion_starred: false },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      transcripts: () => ({ data: { id: "t-new" }, error: null }),
      transcript_lines: () => ({ data: null, error: null }),
    });

    const result = await createLessonAsAdmin({ youtubeUrl: YOUTUBE_URL, libraryAccess: "FREE" });

    expect(result).toMatchObject({ ok: true, transcriptStatus: "fetched" });
    expect(insertedLibraryAccess).toBe("FREE");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/data/lesson-creation.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/data/lesson-creation.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin, type RequireAdminResult } from "@/lib/admin/guard";
import { parseVideoId, fetchOembed, OembedFetchError } from "@/lib/youtube";
import { toFurigana } from "@/lib/japanese";
import { rateLimit } from "@/lib/rate-limit";
import { youtubeCaptionProvider } from "@/lib/data/transcript-providers";
import {
  addToLibrary,
  findExistingLesson,
  hasTranscript,
  isInLibrary,
  isUnderQuota,
} from "@/lib/data/lesson-library";
import { VIDEO_COLUMNS, requireUser, type LibraryAccess, type VideoRow } from "@/lib/data/videos";

/**
 * "Create Lesson" pipeline (spec §2.1). This is the ONE entry point for
 * turning a YouTube URL into a studyable Lesson row — used by the
 * learner-facing flow (`createLesson`) AND the admin seed flow
 * (`createLessonAsAdmin`, spec §4.1 Phase 1) so the dedup/caption-fetch/
 * transcript-insert logic never has to be written twice.
 */

const CREATE_LIMIT = { limit: 20, windowMs: 60_000 };

export type TranscriptStatus = "existing" | "fetched" | "missing";

export interface CreateLessonInput {
  youtubeUrl: string;
}

export type CreateLessonResult =
  | { ok: true; data: VideoRow; alreadyInLibrary: boolean; transcriptStatus: TranscriptStatus }
  | { ok: false; status: 401 | 400 | 422 }
  | { ok: false; status: 403; reason: "quota_exceeded" }
  | { ok: false; status: 429; retryAfter: number };

type GuardFailure = Extract<RequireAdminResult, { ok: false }>;

export interface CreateLessonAsAdminInput {
  youtubeUrl: string;
  libraryAccess: Exclude<LibraryAccess, "PRIVATE">;
}

export type CreateLessonAsAdminResult =
  | { ok: true; data: VideoRow; transcriptStatus: TranscriptStatus }
  | GuardFailure
  | { ok: false; status: 400 | 422 };

/** Inserts the `videos` row (service-role) and attempts the caption fetch; shared by both entry points. */
async function insertLessonAndFetchTranscript(
  videoId: string,
  meta: { title: string; thumbnailUrl: string },
  addedByUserId: string | null,
  libraryAccess: LibraryAccess,
): Promise<{ lesson: VideoRow; transcriptStatus: TranscriptStatus }> {
  const service = createServiceClient();
  const { data: inserted, error: insertError } = await service
    .from("videos")
    .insert({
      youtube_video_id: videoId,
      title: meta.title,
      thumbnail_url: meta.thumbnailUrl,
      added_by_user_id: addedByUserId,
      library_access: libraryAccess,
    })
    .select(VIDEO_COLUMNS)
    .single();
  if (insertError) throw insertError;

  const lesson = inserted as VideoRow;
  const transcriptStatus = await attemptCaptionFetch(lesson.id, videoId);
  return { lesson, transcriptStatus };
}

/** Attempts the caption-fetch → transcript/transcript_lines insert for an existing lesson row. */
async function attemptCaptionFetch(lessonId: string, youtubeVideoId: string): Promise<TranscriptStatus> {
  const captionResult = await youtubeCaptionProvider.fetch(youtubeVideoId);
  if (!captionResult) return "missing";

  const service = createServiceClient();
  const { data: transcript, error: transcriptError } = await service
    .from("transcripts")
    .insert({ video_id: lessonId, source: captionResult.source, language: "ja" })
    .select("id")
    .single();
  if (transcriptError) throw transcriptError;

  const transcriptId = (transcript as { id: string }).id;
  const linesWithFurigana = [];
  for (const line of captionResult.lines) {
    let furigana: unknown = null;
    try {
      furigana = await toFurigana(line.textJp);
    } catch (err) {
      // Best-effort, same posture as lib/data/admin-videos.ts::replaceVideoTranscript —
      // a tokenizer hiccup must not fail the whole caption ingest.
      console.error(`[lesson-creation] furigana generation failed for a caption line on lesson ${lessonId}:`, err);
    }
    linesWithFurigana.push({
      transcript_id: transcriptId,
      start_time: line.startTime,
      end_time: line.endTime,
      text_jp: line.textJp,
      text_translation: line.textTranslation,
      furigana_json: furigana,
    });
  }

  const { error: linesError } = await service.from("transcript_lines").insert(linesWithFurigana);
  if (linesError) throw linesError;

  return "fetched";
}

export async function createLesson(input: CreateLessonInput): Promise<CreateLessonResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`lessons:create:${user.id}`, CREATE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const videoId = parseVideoId(input.youtubeUrl);
  if (!videoId) return { ok: false, status: 400 };

  const existing = await findExistingLesson(videoId);

  // Already published: no quota, no library row — the learner just gets in (spec §2.1 step 3).
  if (existing && existing.library_access !== "PRIVATE") {
    return { ok: true, data: existing, alreadyInLibrary: false, transcriptStatus: "existing" };
  }

  // Existing PRIVATE lesson that already has a transcript: dedup hit (spec §2.1 step 4).
  if (existing && (await hasTranscript(existing.id))) {
    const alreadyMember = await isInLibrary(user.id, existing.id);
    if (!alreadyMember) {
      if (!(await isUnderQuota(user.id))) return { ok: false, status: 403, reason: "quota_exceeded" };
      await addToLibrary(user.id, existing.id);
    }
    return { ok: true, data: existing, alreadyInLibrary: alreadyMember, transcriptStatus: "existing" };
  }

  // Either no lesson at all, or an orphaned PRIVATE lesson with no transcript yet (spec §2.1 step 5).
  if (!(await isUnderQuota(user.id))) return { ok: false, status: 403, reason: "quota_exceeded" };

  let transcriptStatus: TranscriptStatus;
  let lesson: VideoRow;
  if (existing) {
    lesson = existing;
    transcriptStatus = await attemptCaptionFetch(lesson.id, videoId);
  } else {
    let meta;
    try {
      meta = await fetchOembed(videoId);
    } catch (err) {
      if (err instanceof OembedFetchError) return { ok: false, status: 422 };
      throw err;
    }
    const result = await insertLessonAndFetchTranscript(videoId, meta, user.id, "PRIVATE");
    lesson = result.lesson;
    transcriptStatus = result.transcriptStatus;
  }

  // Only a confirmed-studyable lesson consumes a slot (spec §2.1 step 5/6, §3.2).
  if (transcriptStatus === "fetched") {
    await addToLibrary(user.id, lesson.id);
  }

  return { ok: true, data: lesson, alreadyInLibrary: false, transcriptStatus };
}

export async function createLessonAsAdmin(input: CreateLessonAsAdminInput): Promise<CreateLessonAsAdminResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const videoId = parseVideoId(input.youtubeUrl);
  if (!videoId) return { ok: false, status: 400 };

  const existing = await findExistingLesson(videoId);
  if (existing) {
    const transcriptStatus = (await hasTranscript(existing.id)) ? "existing" : await attemptCaptionFetch(existing.id, videoId);
    return { ok: true, data: existing, transcriptStatus };
  }

  let meta;
  try {
    meta = await fetchOembed(videoId);
  } catch (err) {
    if (err instanceof OembedFetchError) return { ok: false, status: 422 };
    throw err;
  }

  const { lesson, transcriptStatus } = await insertLessonAndFetchTranscript(videoId, meta, null, input.libraryAccess);
  return { ok: true, data: lesson, transcriptStatus };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/data/lesson-creation.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/data/lesson-creation.ts lib/data/lesson-creation.test.ts
git commit -m "feat: add the Create Lesson pipeline (user + admin-seed entry points)"
```

---

### Task 14: `app/api/videos/import/route.ts` — repoint to `createLesson`

**Files:**
- Modify: `app/api/videos/import/route.ts`

**Interfaces:**
- Consumes: `createLesson` (Task 13).
- Produces: same route path/method (`POST /api/videos/import`) — Plan C/D own any future rename of
  the route itself; this task only swaps the underlying pipeline and response shape.

- [ ] **Step 1: Rewrite the route**

```typescript
// app/api/videos/import/route.ts
import { NextResponse } from "next/server";
import { createLesson } from "@/lib/data/lesson-creation";
import { importVideoSchema } from "@/lib/validation/video";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = importVideoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid video URL", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await createLesson({ youtubeUrl: parsed.data.youtubeUrl });
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many imports, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    if (result.status === 403) {
      return NextResponse.json({ error: "Monthly lesson quota reached" }, { status: 403 });
    }
    const message =
      result.status === 401
        ? "Unauthorized"
        : result.status === 422
          ? "Could not fetch video metadata"
          : "Invalid video";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json(
    { data: result.data, alreadyInLibrary: result.alreadyInLibrary, transcriptStatus: result.transcriptStatus },
    { status: 201 },
  );
}
```

Note: `importVideoSchema`'s field name (`youtubeUrl`) is unchanged — verify against
`lib/youtube/schema.ts` before assuming; adjust the destructure above if the actual field name
differs.

- [ ] **Step 2: Typecheck and run the full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: this route has no dedicated test file (confirmed absent during this plan's audit), so no
route-level test to update; the full suite should now show a strictly smaller error/failure set than
Task 8's checkpoint (only Task 15/16/17's files remain).

- [ ] **Step 3: Commit**

```bash
git add app/api/videos/import/route.ts
git commit -m "refactor: point POST /api/videos/import at the Create Lesson pipeline"
```

---

### Task 15: Mechanical frontend/type fixups (`status` → `library_access`)

**Files:**
- Modify: `components/video/video-card.tsx`
- Modify: `components/video/video-card.test.tsx`
- Modify: `components/video-player/dictation-view.test.tsx`
- Modify: `components/video-player/shadowing-view.test.tsx`
- Modify: `lib/data/recommendations.ts`
- Modify: `lib/data/recommendations.test.ts`
- Modify: `lib/data/admin-stats.ts`
- Modify: `lib/data/admin-stats.test.ts`

**Interfaces:**
- No new exports — behavior-preserving renames only, so every existing caller/test keeps working
  unchanged. This task exists purely to keep `tsc`/`npm run build`/`npm test` green given Tasks 8–9
  removed `status`/`VideoStatus` (per the "keep build green" decision at the top of this plan).

- [ ] **Step 1: `components/video/video-card.tsx`**

Replace line 40:

```typescript
          {video.library_access === "PRIVATE" && (
```

(unchanged surrounding JSX — the "pending review" badge now reads as "not yet published," which is
the correct meaning: a `PRIVATE` lesson is either the viewer's own unpublished import or, per the RLS
rewrite's `added_by_user_id = auth.uid()` branch, one they can see because they own it.)

- [ ] **Step 2: `components/video/video-card.test.tsx`**

Replace line 14 (`status: "approved",`) with `library_access: "FREE",`. Replace lines 36 and 41:

```typescript
    render(<VideoCard video={{ ...base, library_access: "PRIVATE" }} />);
```
```typescript
    render(<VideoCard video={{ ...base, library_access: "FREE" }} />);
```

- [ ] **Step 3: `components/video-player/dictation-view.test.tsx` and `shadowing-view.test.tsx`**

In each file's `VIDEO` fixture, replace `status: "approved",` with `library_access: "FREE",` and add
`promotion_starred: false,` alongside it (both new required `VideoRow` fields from Task 8).

- [ ] **Step 4: `lib/data/recommendations.ts`**

Replace line 104:

```typescript
    .in("library_access", ["FREE", "PLUS"])
```

(Recommendations should surface `PLUS` lessons too, shown locked to Free viewers per business-model.md
§5 "show don't tell" — this is a superset of the old `status = 'approved'` filter, not a narrowing.)

- [ ] **Step 5: `lib/data/recommendations.test.ts`**

Update the assertion at line 52 from `expect(eqValue(calls, "status")).toBe("approved");` to assert
the new `.in(...)` call instead:

```typescript
    const inCall = calls.find((c): c is Extract<QueryCall, { op: "in" }> => c.op === "in" && c.column === "library_access");
    expect(inCall?.values).toEqual(["FREE", "PLUS"]);
```

(Import `QueryCall` from `@/test/supabase-mock` in this file if not already imported.)

- [ ] **Step 6: `lib/data/admin-stats.ts`**

Replace line 102 (`service.from("videos").select("status"),`) with
`service.from("videos").select("library_access"),`. Replace line 141:

```typescript
  const videoAccessLevels = (videosRes.data as { library_access: string }[] | null) ?? [];
```

Replace lines 166–167:

```typescript
        videosPending: videoAccessLevels.filter((v) => v.library_access === "PRIVATE").length,
        videosApproved: videoAccessLevels.filter((v) => v.library_access === "FREE" || v.library_access === "PLUS").length,
```

(`AdminStats`'s own field names `videosPending`/`videosApproved` are kept unchanged — this is an
internal query rewrite, not a public API/type change, so nothing consuming `AdminStats` needs to
change.)

- [ ] **Step 7: `lib/data/admin-stats.test.ts`**

Update the fixture at line 77 from
`videos: () => ({ data: [{ status: "pending" }, { status: "approved" }, { status: "approved" }], error: null }),`
to:

```typescript
      videos: () => ({
        data: [
          { library_access: "PRIVATE" },
          { library_access: "FREE" },
          { library_access: "PLUS" },
        ],
        error: null,
      }),
```

- [ ] **Step 8: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS / no errors, except any file Task 16 hasn't touched yet
(`lib/data/admin-videos.ts`/`.test.ts` still reference `status` until that task).

- [ ] **Step 9: Commit**

```bash
git add components/video/video-card.tsx components/video/video-card.test.tsx \
  components/video-player/dictation-view.test.tsx components/video-player/shadowing-view.test.tsx \
  lib/data/recommendations.ts lib/data/recommendations.test.ts \
  lib/data/admin-stats.ts lib/data/admin-stats.test.ts
git commit -m "refactor: adapt existing frontend/recommendation/admin-stats call sites to library_access"
```

---

### Task 16: `lib/data/admin-videos.ts` — Promotion Queue backend

**Files:**
- Modify: `lib/data/admin-videos.ts`
- Modify: `lib/data/admin-videos.test.ts`

**Interfaces:**
- Produces: `listNeedsReview(cursor?)` (renamed from `listPendingVideos`, same shape/behavior —
  `library_access = 'PRIVATE'` instead of `status = 'pending'`), `promoteVideo(id, tier)` (renamed
  from `approveVideo`, now requires a transcript to exist before promoting — spec §4.1's "a lesson
  only reaches FREE/PLUS with a transcript"), `demoteVideo(id)` (new — tier back to `PRIVATE`),
  `starVideo(id, starred)` (new — toggles `promotion_starred`), `listTrendingLessons()` (new —
  Promotion-Score-ranked `PRIVATE` lessons), `listReadyToPromote()` (new — `promotion_starred = true`
  `PRIVATE` lessons), `listPublishedLessons(cursor?)` (new — `FREE`/`PLUS` lessons). `rejectVideo` is
  kept (same hard-delete behavior, only its filter changes from `status = 'pending'` to
  `library_access = 'PRIVATE'`) — the source spec retires this action's *product* role once a
  Promotion Queue UI exists, but per this plan's Decision 3, that UI is a separate plan, so removing
  the capability now would regress the only admin UI that exists today.

- [ ] **Step 1: Update the failing/changed tests first**

In `lib/data/admin-videos.test.ts`:
- Rename the imported symbols on line 15: `approveVideo` → `promoteVideo`, `listPendingVideos` →
  `listNeedsReview`.
- Update every `describe("listPendingVideos", ...)` → `describe("listNeedsReview", ...)`.
- Update the query-shape assertion at line 44 from `expect(eqValue(calls, "status")).toBe("pending");`
  to `expect(eqValue(calls, "library_access")).toBe("PRIVATE");`.
- Update the fixture row at lines 47–56 to include `library_access: "PRIVATE"` instead of no such
  field (the mock resolver's returned row shape doesn't need to change beyond this, since
  `PendingVideoListItem`/`PENDING_COLUMNS` never selected `status` in the first place — confirm by
  re-reading `PENDING_COLUMNS` on line 26–27 before editing, which already excludes `status`/
  `library_access` entirely).
- Add a new test replacing the `approveVideo` describe block:

```typescript
describe("promoteVideo", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const result = await promoteVideo(VIDEO_ID, "FREE");
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("refuses to promote a lesson with no transcript", async () => {
    mockService({
      transcripts: () => ({ data: [], error: null }),
    });
    const result = await promoteVideo(VIDEO_ID, "FREE");
    expect(result).toEqual({ ok: false, status: 422 });
  });

  it("promotes a lesson with a transcript to the requested tier", async () => {
    mockService({
      transcripts: () => ({ data: [{ id: "t1" }], error: null }),
      videos: () => ({ data: { id: VIDEO_ID, library_access: "FREE" }, error: null }),
    });
    const result = await promoteVideo(VIDEO_ID, "FREE");
    expect(result).toEqual({ ok: true, data: { id: VIDEO_ID, library_access: "FREE" } });
  });
});

describe("demoteVideo", () => {
  it("sets library_access back to PRIVATE", async () => {
    mockService({
      videos: (calls: QueryCall[]) => {
        const update = calls.find((c): c is Extract<QueryCall, { op: "update" }> => c.op === "update");
        expect(update?.values).toEqual({ library_access: "PRIVATE" });
        return { data: { id: VIDEO_ID, library_access: "PRIVATE" }, error: null };
      },
    });
    const result = await demoteVideo(VIDEO_ID);
    expect(result).toEqual({ ok: true, data: { id: VIDEO_ID, library_access: "PRIVATE" } });
  });
});

describe("starVideo", () => {
  it("toggles promotion_starred", async () => {
    mockService({
      videos: (calls: QueryCall[]) => {
        const update = calls.find((c): c is Extract<QueryCall, { op: "update" }> => c.op === "update");
        expect(update?.values).toEqual({ promotion_starred: true });
        return { data: { id: VIDEO_ID, promotion_starred: true }, error: null };
      },
    });
    const result = await starVideo(VIDEO_ID, true);
    expect(result).toEqual({ ok: true, data: { id: VIDEO_ID, promotion_starred: true } });
  });
});
```

- [ ] **Step 2: Run test to verify the renamed/new tests fail**

Run: `npx vitest run lib/data/admin-videos.test.ts`
Expected: FAIL — `promoteVideo`/`listNeedsReview`/`demoteVideo`/`starVideo` are not yet exported.

- [ ] **Step 3: Rewrite the implementation**

In `lib/data/admin-videos.ts`:
- Rename `listPendingVideos` → `listNeedsReview`; change its query at (current) line 74 from
  `.eq("status", "pending")` to `.eq("library_access", "PRIVATE")`.
- Replace `approveVideo` (lines 152–171) with:

```typescript
export type PromoteVideoResult =
  | { ok: true; data: { id: string; library_access: "FREE" | "PLUS" } }
  | GuardFailure
  | { ok: false; status: 404 | 422 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * Promote a PRIVATE lesson to FREE or PLUS. Requires a transcript to already
 * exist (spec §4.1 — "a lesson only reaches FREE/PLUS with a transcript
 * already attached," decided 2026-07-31): otherwise a published lesson could
 * have no studyable content, which the domain model treats as impossible.
 */
export async function promoteVideo(id: string, tier: "FREE" | "PLUS"): Promise<PromoteVideoResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const limited = rateLimit(`admin:videos:promote:${admin.user.id}`, APPROVE_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const service = createServiceClient();
  const { data: transcripts, error: transcriptError } = await service
    .from("transcripts")
    .select("id")
    .eq("video_id", id);
  if (transcriptError) throw transcriptError;
  if (((transcripts as { id: string }[] | null) ?? []).length === 0) {
    return { ok: false, status: 422 };
  }

  const { data, error } = await service
    .from("videos")
    .update({ library_access: tier })
    .eq("id", id)
    .eq("library_access", "PRIVATE")
    .select("id, library_access")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true, data: data as { id: string; library_access: "FREE" | "PLUS" } };
}

export type DemoteVideoResult =
  | { ok: true; data: { id: string; library_access: "PRIVATE" } }
  | GuardFailure
  | { ok: false; status: 404 };

/** Demote a published lesson back to PRIVATE (spec §4.2 "management" view). */
export async function demoteVideo(id: string): Promise<DemoteVideoResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const service = createServiceClient();
  const { data, error } = await service
    .from("videos")
    .update({ library_access: "PRIVATE" })
    .eq("id", id)
    .select("id, library_access")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true, data: data as { id: string; library_access: "PRIVATE" } };
}

export type StarVideoResult =
  | { ok: true; data: { id: string; promotion_starred: boolean } }
  | GuardFailure
  | { ok: false; status: 404 };

/** Toggle a PRIVATE lesson's "Ready to Promote" shortlist flag (spec §4.2). */
export async function starVideo(id: string, starred: boolean): Promise<StarVideoResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const service = createServiceClient();
  const { data, error } = await service
    .from("videos")
    .update({ promotion_starred: starred })
    .eq("id", id)
    .select("id, promotion_starred")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true, data: data as { id: string; promotion_starred: boolean } };
}
```

- Update `rejectVideo`'s two `.eq("status", "pending")` filters (lines 220/221 area) to
  `.eq("library_access", "PRIVATE")`.

- Add the Trending / Ready to Promote / Published views and the score function:

```typescript
export interface PromotionScoreInputs {
  libraryCount: number;
  studySessionCount: number;
  completedCount: number;
}

/**
 * Initial Promotion Score weights (spec §4.2 explicitly leaves these as an
 * implementation-time decision, not fixed). Bookmark count is OMITTED: no
 * `bookmarks` table exists anywhere in this schema yet, so there is nothing
 * to weigh — add it here if/when a bookmarks feature ships.
 */
export function computePromotionScore(inputs: PromotionScoreInputs): number {
  return inputs.libraryCount * 3 + inputs.studySessionCount * 1 + inputs.completedCount * 2;
}

export type ListTrendingResult = { ok: true; data: (PendingVideoListItem & { score: number })[] } | GuardFailure;

/** PRIVATE lessons ranked by Promotion Score, highest first (spec §4.2). */
export async function listTrendingLessons(): Promise<ListTrendingResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const service = createServiceClient();
  const { data: privateLessons, error } = await service
    .from("videos")
    .select(PENDING_COLUMNS)
    .eq("library_access", "PRIVATE");
  if (error) throw error;

  const lessons = (privateLessons as PendingVideoRow[]) ?? [];
  const lessonIds = lessons.map((l) => l.id);
  if (lessonIds.length === 0) return { ok: true, data: [] };

  const [libraryRes, shadowingRes, dictationRes, progressRes] = await Promise.all([
    service.from("user_lesson_library").select("lesson_id").in("lesson_id", lessonIds),
    service.from("shadowing_sessions").select("video_id").in("video_id", lessonIds),
    service.from("dictation_attempts").select("video_id").in("video_id", lessonIds),
    service.from("user_video_progress").select("video_id, completed_at").in("video_id", lessonIds),
  ]);
  if (libraryRes.error) throw libraryRes.error;
  if (shadowingRes.error) throw shadowingRes.error;
  if (dictationRes.error) throw dictationRes.error;
  if (progressRes.error) throw progressRes.error;

  const countBy = (rows: { lesson_id?: string; video_id?: string }[], key: "lesson_id" | "video_id") => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const id = row[key];
      if (!id) continue;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  };

  const libraryCounts = countBy((libraryRes.data as { lesson_id: string }[]) ?? [], "lesson_id");
  const shadowingCounts = countBy((shadowingRes.data as { video_id: string }[]) ?? [], "video_id");
  const dictationCounts = countBy((dictationRes.data as { video_id: string }[]) ?? [], "video_id");
  const completedCounts = countBy(
    ((progressRes.data as { video_id: string; completed_at: string | null }[]) ?? []).filter((r) => r.completed_at),
    "video_id",
  );

  const scored = lessons.map((lesson) => ({
    ...lesson,
    importerName: null,
    hasTranscript: false,
    transcriptLineCount: 0,
    score: computePromotionScore({
      libraryCount: libraryCounts.get(lesson.id) ?? 0,
      studySessionCount: (shadowingCounts.get(lesson.id) ?? 0) + (dictationCounts.get(lesson.id) ?? 0),
      completedCount: completedCounts.get(lesson.id) ?? 0,
    }),
  }));
  scored.sort((a, b) => b.score - a.score);

  return { ok: true, data: scored };
}

export type ListReadyToPromoteResult = { ok: true; data: PendingVideoListItem[] } | GuardFailure;

/** Admin's own starred shortlist of PRIVATE lessons (spec §4.2). */
export async function listReadyToPromote(): Promise<ListReadyToPromoteResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const service = createServiceClient();
  const { data, error } = await service
    .from("videos")
    .select(PENDING_COLUMNS)
    .eq("library_access", "PRIVATE")
    .eq("promotion_starred", true);
  if (error) throw error;

  const rows = (data as PendingVideoRow[]) ?? [];
  return {
    ok: true,
    data: rows.map((v) => ({ ...v, importerName: null, hasTranscript: false, transcriptLineCount: 0 })),
  };
}

export type ListPublishedResult = { ok: true; data: PendingVideoListItem[] } | GuardFailure;

/** FREE/PLUS lessons, for re-tier/demote management (spec §4.2). */
export async function listPublishedLessons(): Promise<ListPublishedResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;

  const service = createServiceClient();
  const { data, error } = await service
    .from("videos")
    .select(PENDING_COLUMNS)
    .in("library_access", ["FREE", "PLUS"])
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data as PendingVideoRow[]) ?? [];
  return {
    ok: true,
    data: rows.map((v) => ({ ...v, importerName: null, hasTranscript: false, transcriptLineCount: 0 })),
  };
}
```

Note: `PENDING_COLUMNS` (line 26–27) does not include `library_access`/`promotion_starred` — add both
to that column list now, since `listTrendingLessons`/`listReadyToPromote`/`listPublishedLessons` all
select through it and the Promotion Queue's future UI will need to display tier/starred state. Add the
matching fields to the `PendingVideoRow` interface (lines 29–38) too:
`library_access: "PRIVATE" | "FREE" | "PLUS"; promotion_starred: boolean;` — otherwise the cast
`data as PendingVideoRow[]` in each new function silently drops those two columns from the type even
though they're present at runtime.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/data/admin-videos.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no errors remaining anywhere in the repo (this is the last data-layer task).

- [ ] **Step 6: Commit**

```bash
git add lib/data/admin-videos.ts lib/data/admin-videos.test.ts
git commit -m "feat: rebuild admin-videos.ts as the Promotion Queue backend"
```

---

### Task 17: Admin Promotion Queue API routes

**Files:**
- Modify: `app/api/admin/videos/pending/route.ts` (call `listNeedsReview`; keep the URL path
  `/api/admin/videos/pending` unchanged so the existing admin UI needs no changes)
- Modify: `app/api/admin/videos/[id]/approve/route.ts` (call `promoteVideo`, accept an optional
  `{ tier?: "FREE" | "PLUS" }` body defaulting to `"FREE"` so the existing bodyless-POST admin UI
  keeps working unchanged)
- Create: `app/api/admin/videos/[id]/demote/route.ts`
- Create: `app/api/admin/videos/[id]/star/route.ts`
- Create: `app/api/admin/videos/trending/route.ts`
- Create: `app/api/admin/videos/ready/route.ts`
- Create: `app/api/admin/videos/published/route.ts`
- Modify: `lib/validation/admin-video.ts` (add the promote-tier and star-body schemas)

**Interfaces:**
- Consumes: Task 16's `listNeedsReview`/`promoteVideo`/`demoteVideo`/`starVideo`/
  `listTrendingLessons`/`listReadyToPromote`/`listPublishedLessons`.
- Produces: the full Promotion Queue API surface, ready for a future admin-UI plan to consume — no UI
  changes in this task per this plan's Decision 3.

- [ ] **Step 1: Add validation schemas**

In `lib/validation/admin-video.ts`, add:

```typescript
/** POST /api/admin/videos/[id]/approve body — tier defaults to FREE for the existing single-button UI. */
export const promoteVideoSchema = z.object({
  tier: z.enum(["FREE", "PLUS"]).default("FREE"),
});
export type PromoteVideoInput = z.infer<typeof promoteVideoSchema>;

/** POST /api/admin/videos/[id]/star body. */
export const starVideoSchema = z.object({
  starred: z.boolean(),
});
export type StarVideoInput = z.infer<typeof starVideoSchema>;
```

- [ ] **Step 2: Update `app/api/admin/videos/pending/route.ts`**

Change the import and call on lines 2 and 12: `listPendingVideos` → `listNeedsReview`. No other
changes — response shape is identical.

- [ ] **Step 3: Update `app/api/admin/videos/[id]/approve/route.ts`**

```typescript
// app/api/admin/videos/[id]/approve/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { promoteVideo } from "@/lib/data/admin-videos";
import { promoteVideoSchema } from "@/lib/validation/admin-video";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const text = await request.text();
  let body: unknown = {};
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const parsed = promoteVideoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = await promoteVideo(params.id, parsed.data.tier);
  if (!result.ok) {
    if (result.status === 429) {
      return NextResponse.json(
        { error: "Too many requests, slow down" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(result.retryAfter / 1000)) } },
      );
    }
    const message =
      result.status === 401
        ? "Unauthorized"
        : result.status === 403
          ? "Forbidden"
          : result.status === 422
            ? "Lesson has no transcript yet"
            : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
```

- [ ] **Step 4: Create the demote/star routes**

```typescript
// app/api/admin/videos/[id]/demote/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { demoteVideo } from "@/lib/data/admin-videos";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await demoteVideo(params.id);
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : result.status === 403 ? "Forbidden" : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
```

```typescript
// app/api/admin/videos/[id]/star/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { starVideo } from "@/lib/data/admin-videos";
import { starVideoSchema } from "@/lib/validation/admin-video";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!z.string().uuid().safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = starVideoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = await starVideo(params.id, parsed.data.starred);
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : result.status === 403 ? "Forbidden" : "Not found";
    return NextResponse.json({ error: message }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
```

- [ ] **Step 5: Create the three read-only view routes**

```typescript
// app/api/admin/videos/trending/route.ts
import { NextResponse } from "next/server";
import { listTrendingLessons } from "@/lib/data/admin-videos";

export async function GET() {
  const result = await listTrendingLessons();
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "Forbidden";
    return NextResponse.json({ error: message }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}
```

```typescript
// app/api/admin/videos/ready/route.ts
import { NextResponse } from "next/server";
import { listReadyToPromote } from "@/lib/data/admin-videos";

export async function GET() {
  const result = await listReadyToPromote();
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "Forbidden";
    return NextResponse.json({ error: message }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}
```

```typescript
// app/api/admin/videos/published/route.ts
import { NextResponse } from "next/server";
import { listPublishedLessons } from "@/lib/data/admin-videos";

export async function GET() {
  const result = await listPublishedLessons();
  if (!result.ok) {
    const message = result.status === 401 ? "Unauthorized" : "Forbidden";
    return NextResponse.json({ error: message }, { status: result.status });
  }
  return NextResponse.json({ data: result.data });
}
```

- [ ] **Step 6: Typecheck and run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no errors, all tests pass. This is the full-repo green checkpoint for Plan B.

- [ ] **Step 7: Manual smoke check**

Run: `npx supabase start` (if not already running) then `npm run dev`. Sign in as the bootstrap admin
(`ADMIN_EMAILS`), then from a second (or the same) browser tab:
`curl -X POST http://localhost:3000/api/admin/videos/<some-private-lesson-id>/approve -H "Cookie: <session>"`
should 422 if that lesson has no transcript, 200 with `library_access: "FREE"` if it does. This is a
manual check (no e2e harness change is in this plan's scope) — confirm at least the happy path once
before considering this task done.

- [ ] **Step 8: Commit**

```bash
git add app/api/admin/videos/pending/route.ts app/api/admin/videos/[id]/approve/route.ts \
  app/api/admin/videos/[id]/demote/route.ts app/api/admin/videos/[id]/star/route.ts \
  app/api/admin/videos/trending/route.ts app/api/admin/videos/ready/route.ts \
  app/api/admin/videos/published/route.ts lib/validation/admin-video.ts
git commit -m "feat: add Promotion Queue API routes (promote/demote/star/trending/ready/published)"
```

---

### Task 18: Close out the backlog/docs pointers

**Files:**
- Modify: `.serena/memories/feature_backlog_deferred.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Mark backlog items #14 and #11 DONE**

Per the source spec's §8 docs-impact checklist: "item #14 (transcript-submit UI) resolved by this
spec's §2; item #11 (rejected status) resolved by §4.1's model change; both should be marked DONE once
implemented, not before." Now that Tasks 1–17 are merged, edit
`.serena/memories/feature_backlog_deferred.md`:
- Item 14 (`User transcript ingestion UI`): append `✅ DONE — superseded by the Create Lesson pipeline
  (Shadowing Hub Lesson Workspace Plan B, merged <commit-hash-of-this-plan's-final-commit>). Caption
  auto-fetch (YouTube timedtext) replaces the old "coming soon" ingestion panel; manual paste (admin
  SRT attach) still exists unchanged.`
- Item 11 (`rejected video status + persist lý do reject`): append `✅ RESOLVED DIFFERENTLY — Shadowing
  Hub Lesson Workspace Plan B: PRIVATE lessons block no one, so there is no more approval gate to
  reject FROM. \`rejectVideo\` (hard-delete) is kept as an admin housekeeping action on unpublished
  lessons, not a moderation gate.`

Do not mark item 7 (AI-generated content human-review gate) or any other backlog item — this plan's
AI Transcript Generation stub does not resolve that item; it is untouched.

- [ ] **Step 2: Commit**

```bash
git add .serena/memories/feature_backlog_deferred.md
git commit -m "docs: mark feature-backlog items #14 and #11 resolved by Plan B"
```

---

## Self-review notes (kept for the record, not part of the executable plan)

- **Spec coverage**: §9 items 1–5 map to Tasks 1–9/12–17; item 6's caption-fetch → Task 10/11;
  AI-transcript-generation and Promotion Score are both covered with the scope explicitly narrowed by
  this plan's "Decisions locked" section (stub / initial formula respectively — both are spec-sanctioned
  open items, not silently dropped requirements).
- **Deferred by this plan, not by the spec**: real AI STT implementation, Promotion Queue admin UI,
  bookmark-count in the Promotion Score (no `bookmarks` table exists in this schema at all — adding one
  is out of scope; flagged, not silently ignored).
- **Out of scope, unchanged from the spec's own §10**: `videos` → `lessons` table rename, bulk/CSV
  admin import, exact Promotion Score weight tuning, future Learning Modes, Summary Mode's caching
  strategy, PayOS enforcement plumbing itself (this plan assumes `subscriptions.plan`/`status` as
  given, per Task 7/Task 5's RLS — wiring real billing state into that table is a separate, later
  piece of work).
