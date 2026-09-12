-- Local `supabase db reset` seed hook.
--
-- Study content (kanji / vocab / grammar) and badges are treated as versioned
-- reference data and live in MIGRATIONS (20260712000005_content_n5_n4.sql) so
-- they deploy to every environment via `supabase db push`. Nothing extra was
-- seeded here for a long time; the video below is the first dev-only
-- throwaway row.

-- One FREE-tier video so `tests/e2e/route-group-provider-identity.spec.ts`
-- ("(app) -> (focus)") can reach a real `(focus)/videos/[id]/shadowing`
-- route without a live YouTube network call or an admin-bootstrap flow —
-- creating a lesson for real goes through `lib/data/lesson-creation.ts`,
-- which calls the real YouTube oEmbed endpoint (`lib/youtube/oembed.ts`) and
-- requires `requireAdmin()`, neither of which belongs in a deterministic e2e
-- gate. `library_access = 'FREE'` makes it visible to any authenticated user
-- under the `videos_read` policy (20260731000023_plus_metadata_visible.sql),
-- so the freshly-registered e2e account can read it with no library-linking
-- setup. Fixed id so the spec can reference it directly instead of querying
-- for it. No transcript row: `ShadowingPage` and `ShadowingView` already
-- handle `transcript === null` (later ingestion UI's job, not this one's).
insert into videos (id, youtube_video_id, title, library_access)
values (
  'e2e00000-0000-0000-0000-000000000001',
  'e2e_seed_video_01',
  'E2E Seed Video',
  'FREE'
)
on conflict (id) do nothing;

-- C3 Explore fixture: an authenticated browser can exercise an actual
-- RLS-visible collection card and stored transcript preview without calling
-- an external video or caption service. The Japanese lines are fixture copy,
-- not imported content.
insert into videos (id, youtube_video_id, title, duration_seconds, jlpt_level_estimate, library_access, situation_id)
select
  'e2e00000-0000-0000-0000-000000000002',
  'e2e_explore_lesson_01',
  'E2E Explore Lesson',
  180,
  'N5',
  'FREE',
  id
from lesson_situations
where slug = 'restaurant'
on conflict (id) do nothing;

insert into lesson_collections (lesson_id, collection_id)
select 'e2e00000-0000-0000-0000-000000000002', id
from collections
where slug = 'beginner-foundation'
on conflict (lesson_id, collection_id) do nothing;

insert into transcripts (id, video_id, source)
values ('e2e00000-0000-0000-0000-000000000003', 'e2e00000-0000-0000-0000-000000000002', 'youtube_caption')
on conflict (id) do nothing;

insert into transcript_lines (id, transcript_id, start_time, text_jp) values
  ('e2e00000-0000-0000-0000-000000000004', 'e2e00000-0000-0000-0000-000000000003', 0, 'いらっしゃいませ。'),
  ('e2e00000-0000-0000-0000-000000000005', 'e2e00000-0000-0000-0000-000000000003', 2, 'ラーメンをお願いします。'),
  ('e2e00000-0000-0000-0000-000000000006', 'e2e00000-0000-0000-0000-000000000003', 4, 'かしこまりました。')
on conflict (id) do nothing;
