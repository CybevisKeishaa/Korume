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
  display_order int not null default 0
);

create table lesson_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_order int not null default 0
);

alter table videos add column situation_id uuid references lesson_situations (id);
alter table videos add column source_id uuid references lesson_sources (id);

create index videos_situation_id_idx on videos (situation_id);
create index videos_source_id_idx on videos (source_id);

alter table lesson_situations enable row level security;
alter table lesson_sources enable row level security;

create policy lesson_situations_read on lesson_situations for select to authenticated using (true);
create policy lesson_sources_read on lesson_sources for select to authenticated using (true);
-- Writes are service-role only (admin curation), same convention as
-- collections/radicals/kanji/badges: no insert/update/delete policy needed.

insert into lesson_situations (slug, display_order) values
  ('conversation', 1), ('restaurant', 2), ('business', 3), ('daily-life', 4),
  ('travel', 5), ('office', 6), ('shopping', 7), ('cafe', 8);

insert into lesson_sources (slug, display_order) values
  ('youtube', 1), ('nhk', 2), ('podcast', 3), ('drama', 4),
  ('anime', 5), ('vlog', 6), ('news', 7);
