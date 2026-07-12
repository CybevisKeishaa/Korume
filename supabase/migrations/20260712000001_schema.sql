-- Nihongo Cinema — full schema (spec §4 + differentiators from CLAUDE.md §5).
-- Auth is handled by Supabase (auth.users). public.users is the profile row;
-- passwords live in auth.users only (never store password_hash here — CLAUDE.md §2).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type jlpt_level as enum ('N5', 'N4', 'N3', 'N2', 'N1');
create type target_goal as enum ('communication', 'jlpt', 'work');
create type reading_type as enum ('on', 'kun');
create type transcript_source as enum ('youtube_caption', 'user_submitted', 'ai_generated');
create type video_status as enum ('pending', 'approved');
create type conversation_role as enum ('user', 'ai');
create type jlpt_section as enum ('vocab', 'grammar', 'reading', 'listening');
create type subscription_plan as enum ('free', 'premium_monthly', 'premium_yearly');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');

-- Shared trigger to maintain updated_at where present.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Users & stats
-- ---------------------------------------------------------------------------
create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  level jlpt_level not null default 'N5',
  target_goal target_goal,
  daily_minutes int not null default 15 check (daily_minutes between 0 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_stats (
  user_id uuid primary key references users (id) on delete cascade,
  xp int not null default 0 check (xp >= 0),
  streak_current int not null default 0 check (streak_current >= 0),
  streak_longest int not null default 0 check (streak_longest >= 0),
  last_active_date date
);

-- Create the profile + stats rows automatically when an auth user is created.
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.user_stats (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Kanji
-- ---------------------------------------------------------------------------
create table radicals (
  id uuid primary key default gen_random_uuid(),
  character text not null unique,
  meaning_en text,
  meaning_vi text
);

create table kanji (
  id uuid primary key default gen_random_uuid(),
  character text not null unique,
  jlpt_level jlpt_level,
  stroke_count int check (stroke_count > 0),
  radical_id uuid references radicals (id) on delete set null,
  meaning_en text,
  meaning_vi text,
  stroke_order_svg text,
  mnemonic_text text,
  mnemonic_image_url text,
  created_at timestamptz not null default now()
);

create table kanji_readings (
  id uuid primary key default gen_random_uuid(),
  kanji_id uuid not null references kanji (id) on delete cascade,
  reading text not null,
  reading_type reading_type not null
);

create table user_kanji_progress (
  user_id uuid not null references users (id) on delete cascade,
  kanji_id uuid not null references kanji (id) on delete cascade,
  srs_stage int not null default 0,
  next_review_at timestamptz,
  ease_factor numeric(4, 2) not null default 2.50,
  last_reviewed_at timestamptz,
  primary key (user_id, kanji_id)
);

-- ---------------------------------------------------------------------------
-- Vocabulary
-- ---------------------------------------------------------------------------
create table vocab (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  reading text,
  meaning_en text,
  meaning_vi text,
  jlpt_level jlpt_level,
  audio_url text,
  part_of_speech text,
  created_at timestamptz not null default now()
);

-- vocab_examples.source_video_id set null on video delete (declared after videos).
create table vocab_examples (
  id uuid primary key default gen_random_uuid(),
  vocab_id uuid not null references vocab (id) on delete cascade,
  sentence_jp text not null,
  sentence_translation text,
  source_video_id uuid
);

create table user_vocab_progress (
  user_id uuid not null references users (id) on delete cascade,
  vocab_id uuid not null references vocab (id) on delete cascade,
  srs_stage int not null default 0,
  next_review_at timestamptz,
  ease_factor numeric(4, 2) not null default 2.50,
  last_reviewed_at timestamptz,
  primary key (user_id, vocab_id)
);

-- ---------------------------------------------------------------------------
-- Grammar
-- ---------------------------------------------------------------------------
create table grammar_points (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  jlpt_level jlpt_level,
  explanation text,
  structure_pattern text,
  example_sentences jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table user_grammar_progress (
  user_id uuid not null references users (id) on delete cascade,
  grammar_id uuid not null references grammar_points (id) on delete cascade,
  mastery_score numeric(5, 2) not null default 0,
  last_practiced_at timestamptz,
  primary key (user_id, grammar_id)
);

-- ---------------------------------------------------------------------------
-- Videos & transcripts (NEVER store the video itself — CLAUDE.md §2)
-- ---------------------------------------------------------------------------
create table videos (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null unique,
  title text not null,
  duration_seconds int check (duration_seconds >= 0),
  thumbnail_url text,
  jlpt_level_estimate jlpt_level,
  added_by_user_id uuid references users (id) on delete set null,
  status video_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- Now that videos exists, wire vocab_examples.source_video_id.
alter table vocab_examples
  add constraint vocab_examples_source_video_fk
  foreign key (source_video_id) references videos (id) on delete set null;

create table transcripts (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos (id) on delete cascade,
  source transcript_source not null,
  language text not null default 'ja',
  created_at timestamptz not null default now()
);

create table transcript_lines (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references transcripts (id) on delete cascade,
  start_time numeric(10, 3) not null,
  end_time numeric(10, 3),
  text_jp text not null,
  text_translation text,
  furigana_json jsonb
);

create table user_video_progress (
  user_id uuid not null references users (id) on delete cascade,
  video_id uuid not null references videos (id) on delete cascade,
  last_watched_position numeric(10, 3) not null default 0,
  completed_at timestamptz,
  primary key (user_id, video_id)
);

create table user_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table user_playlist_items (
  playlist_id uuid not null references user_playlists (id) on delete cascade,
  video_id uuid not null references videos (id) on delete cascade,
  order_index int not null default 0,
  primary key (playlist_id, video_id)
);

-- ---------------------------------------------------------------------------
-- Shadowing & dictation
-- ---------------------------------------------------------------------------
create table shadowing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  video_id uuid references videos (id) on delete set null,
  transcript_line_id uuid references transcript_lines (id) on delete set null,
  recording_url text, -- private, encrypted-at-rest storage only (CLAUDE.md §2)
  pronunciation_score numeric(5, 2),
  rhythm_score numeric(5, 2),
  pitch_score numeric(5, 2), -- differentiator #1: pitch-accent scoring (CLAUDE.md §5)
  created_at timestamptz not null default now()
);

create table dictation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  video_id uuid references videos (id) on delete set null,
  transcript_line_id uuid references transcript_lines (id) on delete set null,
  user_input text not null,
  accuracy_score numeric(5, 2),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Speaking / conversation
-- ---------------------------------------------------------------------------
create table conversation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  scenario_type text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table conversation_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references conversation_sessions (id) on delete cascade,
  role conversation_role not null,
  content text not null,
  pronunciation_score numeric(5, 2),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- JLPT
-- ---------------------------------------------------------------------------
create table jlpt_tests (
  id uuid primary key default gen_random_uuid(),
  level jlpt_level not null,
  title text not null,
  section_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table jlpt_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references jlpt_tests (id) on delete cascade,
  section jlpt_section not null,
  question_data jsonb not null,
  correct_answer text not null
);

create table user_test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  test_id uuid not null references jlpt_tests (id) on delete cascade,
  score numeric(6, 2),
  section_scores jsonb,
  completed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Gamification
-- ---------------------------------------------------------------------------
create table badges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  icon_url text,
  criteria jsonb not null default '{}'::jsonb
);

create table user_badges (
  user_id uuid not null references users (id) on delete cascade,
  badge_id uuid not null references badges (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- ---------------------------------------------------------------------------
-- Community
-- ---------------------------------------------------------------------------
create table forum_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references forum_posts (id) on delete cascade,
  user_id uuid references users (id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Billing
-- ---------------------------------------------------------------------------
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  stripe_customer_id text,
  plan subscription_plan not null default 'free',
  status subscription_status not null default 'trialing',
  current_period_end timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create trigger subscriptions_set_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();
