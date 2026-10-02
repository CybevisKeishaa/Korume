-- supabase/migrations/20260807000025_lesson_taxonomy.sql
-- Plan C spec §3.5 / D11. TWO axes, not one: the Figma chip row mixes
-- situations (Restaurant, Office) with sources (Anime, Podcast, News), while
-- the original design prompt kept them as separate sections. One column would
-- freeze that collapse into the schema.
--
-- `source_id` here means CONTENT ORIGIN (NHK, Podcast, Anime, Drama, Vlog).
-- It is unrelated to `transcripts.source`, which records how a transcript was
-- obtained. Neither should be renamed to the other.
--
-- Cardinality is provisional: FK columns serve the single-select chip row
-- that exists today. Going many-to-many is a foreseen evolution (a
-- lesson_situation_assignments table), not a design failure — which is why
-- lib/data/lesson-taxonomy.ts returns arrays from day one.
--
-- Labels are NOT stored here. Slugs only; display strings live in the i18n
-- catalog (shadowing.situations.*, shadowing.sources.*). English label maps in
-- code are the mistake lib/jlpt-ui.ts's SECTION_LABELS already cost us.

create table lesson_situations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_order int not null default 0,
  -- The glyph a Practice by Situation tile shows (Figma 37:5331); decorative,
  -- so nullable. Same shape as collections.icon.
  icon text check (char_length(icon) <= 16)
);

create table lesson_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_order int not null default 0
);

alter table videos add column situation_id uuid references lesson_situations (id);
alter table videos add column source_id uuid references lesson_sources (id);

create index idx_videos_situation_id on videos (situation_id);
create index idx_videos_source_id on videos (source_id);

create view learner_videos with (security_invoker = true) as
select
  v.id, v.youtube_video_id, v.title, v.duration_seconds, v.thumbnail_url,
  v.jlpt_level_estimate, v.added_by_user_id, v.library_access,
  v.promotion_starred, v.created_at, v.situation_id, v.source_id, v.channel_title,
  p.last_watched_position, p.completed_at, p.last_watched_at,
  (p.video_id is not null and p.completed_at is null and p.last_watched_position > 0) as in_progress,
  (case when p.video_id is not null and p.completed_at is null and p.last_watched_position > 0 then p.last_watched_at end) as in_progress_last_watched_at,
  (exists (select 1 from user_lesson_library ull where ull.user_id = auth.uid() and ull.lesson_id = v.id)
    or (v.library_access = 'PRIVATE' and v.added_by_user_id = auth.uid())) as in_library
from videos v
left join user_video_progress p on p.user_id = auth.uid() and p.video_id = v.id;

revoke all on learner_videos from public, anon, authenticated;
grant select on learner_videos to authenticated;

alter table lesson_situations enable row level security;
alter table lesson_sources enable row level security;

create policy lesson_situations_read on lesson_situations for select to authenticated using (true);
create policy lesson_sources_read on lesson_sources for select to authenticated using (true);
-- Writes are service-role only (admin curation), same convention as
-- collections/radicals/kanji/badges: no insert/update/delete policy needed.

insert into lesson_situations (slug, display_order, icon) values
  ('conversation', 1, '💬'), ('restaurant', 2, '🍜'), ('business', 3, '💼'), ('daily-life', 4, '🏠'),
  ('travel', 5, '🚆'), ('office', 6, '🏢'), ('shopping', 7, '🛍️'), ('cafe', 8, '☕');

insert into lesson_sources (slug, display_order) values
  ('youtube', 1), ('nhk', 2), ('podcast', 3), ('drama', 4),
  ('anime', 5), ('vlog', 6), ('news', 7);
