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
  -- A collection's role: a hub shelf, a learning path (a course), or a
  -- practice goal. A path and a goal are ordered collections, not new entities.
  kind text not null default 'shelf' check (kind in ('shelf', 'path', 'goal')),
  -- Goals only: the persisted score a goal trains (accuracy ->
  -- pronunciation_score, pitch -> pitch_score, rhythm -> rhythm_score).
  skill_focus text check (skill_focus in ('accuracy', 'pitch', 'rhythm')),
  -- A short glyph the path and goal cards show (Figma 37:5450); decorative, so nullable.
  icon text check (char_length(icon) <= 16),
  created_at timestamptz not null default now(),
  constraint collections_skill_focus_goal_check check ((kind = 'goal') = (skill_focus is not null))
);

create table lesson_collections (
  lesson_id uuid not null references videos (id) on delete cascade,
  collection_id uuid not null references collections (id) on delete cascade,
  -- Editorial order inside a collection; 0 means unordered, so callers keep their existing order.
  position int not null default 0,
  primary key (lesson_id, collection_id)
);

alter table collections enable row level security;
alter table lesson_collections enable row level security;

create policy collections_read on collections for select to authenticated using (true);
create policy lesson_collections_read on lesson_collections for select to authenticated using (true);
-- Writes are service-role only (admin curation flow) — no insert/update/delete policy needed, same
-- convention as radicals/kanji/vocab/grammar_points/badges/jlpt_tests.
