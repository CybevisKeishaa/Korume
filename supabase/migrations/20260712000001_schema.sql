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
  -- Null until one-shot browser detection or the learner chooses a zone.
  study_timezone text check (study_timezone is null or length(study_timezone) between 1 and 64),
  -- Edit Profile fields (port-profile spec §2.1). Lists and allowlists live in lib/profile/*; the DB enforces shape.
  username text unique check (username is null or username ~ '^[a-z0-9_]{3,20}$'),
  bio text check (bio is null or char_length(bio) <= 160),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  native_language text check (native_language is null or native_language ~ '^[a-z]{2,3}$'),
  target_jlpt_level jlpt_level,
  learning_goal text check (learning_goal is null or char_length(learning_goal) <= 200),
  preferred_practices text[] not null default '{}' check (cardinality(preferred_practices) <= 8),
  -- Path inside the private `avatars` bucket; written only by the server (no client grant).
  avatar_path text check (avatar_path is null or char_length(avatar_path) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_stats (
  user_id uuid primary key references users (id) on delete cascade,
  xp int not null default 0 check (xp >= 0)
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
  created_at timestamptz not null default now(),
  -- port-dashboard S3: the repo's saved-word identity (lib/summary/refs.ts normalizeRef = NFKC + JS trim) computed in
  -- SQL. The trim set is ECMAScript WhiteSpace + LineTerminator spelled out \u2014 never \s, whose meaning depends on the
  -- collation provider. Parity is tested both ways (lib/summary/lexical-key-fixture.ts).
  lexical_key text generated always as (
    regexp_replace(normalize(word, NFKC), '^[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$', '', 'g')
  ) stored
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
  mastered_at timestamptz,
  primary key (user_id, vocab_id)
);

-- mastered_at is the FIRST time the word reached mastery (port-profile spec §2.2): once set it never changes,
-- whatever later happens to srs_stage. The app decides when to set it (MASTERY_THRESHOLD lives in TypeScript).
create function keep_first_mastered_at() returns trigger language plpgsql set search_path = public as $$
begin
  if old.mastered_at is not null then new.mastered_at := old.mastered_at; end if;
  return new;
end $$;
create trigger user_vocab_progress_keep_mastered_at before update on user_vocab_progress
  for each row execute function keep_first_mastered_at();

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
  channel_title text check (char_length(channel_title) <= 200),
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

create function latest_transcript_ids(p_video_ids uuid[])
  returns table (video_id uuid, transcript_id uuid)
  language sql
  stable
  security invoker
  set search_path = public
as $$
  select distinct on (t.video_id) t.video_id, t.id
  from transcripts t
  where t.video_id = any (p_video_ids)
  order by t.video_id, t.created_at desc, t.id desc;
$$;

revoke all on function latest_transcript_ids(uuid[]) from public, anon;
grant execute on function latest_transcript_ids(uuid[]) to authenticated, service_role;

-- Sentences per lesson: the line count of each video's latest transcript, the
-- one every reader shows. Counted here because a PostgREST read of the lines
-- is capped at max_rows (1000) and would undercount without an error.
-- SECURITY INVOKER: the transcript RLS decides which lessons the caller counts;
-- a lesson with no readable transcript returns no row.
create function video_sentence_counts(p_video_ids uuid[])
  returns table (video_id uuid, sentence_count int)
  language sql
  stable
  security invoker
  set search_path = public
as $$
  select latest.video_id, count(l.id)::int
  from (
    select distinct on (t.video_id) t.video_id, t.id
    from transcripts t
    where t.video_id = any (p_video_ids)
    order by t.video_id, t.created_at desc, t.id desc
  ) latest
  left join transcript_lines l on l.transcript_id = latest.id
  group by latest.video_id;
$$;

-- Supabase grants anon EXECUTE by default, so revoking from public alone leaves it.
revoke all on function video_sentence_counts(uuid[]) from public, anon;
grant execute on function video_sentence_counts(uuid[]) to authenticated;

create table user_video_progress (
  user_id uuid not null references users (id) on delete cascade,
  video_id uuid not null references videos (id) on delete cascade,
  last_watched_position numeric(10, 3) not null default 0,
  completed_at timestamptz,
  first_completed_at timestamptz,
  -- When the learner last moved this row; maintained by the trigger below.
  -- Nullable: a row with no known time is never given a fabricated one.
  last_watched_at timestamptz,
  primary key (user_id, video_id)
);

create or replace function set_user_video_progress_last_watched_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT'
    or new.last_watched_position is distinct from old.last_watched_position
    or new.completed_at is distinct from old.completed_at then
    new.last_watched_at = now();
  end if;
  return new;
end;
$$;

create trigger user_video_progress_set_last_watched_at
  before insert or update on user_video_progress
  for each row execute function set_user_video_progress_last_watched_at();

-- port-dashboard S7: the FIRST completion, stamped by the server clock. completed_at is overwritten on every
-- completion and is client-writable through RLS, so this column ignores any client value (plan P8).
create function keep_first_completed_at() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.first_completed_at is not null then
    new.first_completed_at := old.first_completed_at;
  elsif (tg_op = 'INSERT' and new.completed_at is not null)
    or (tg_op = 'UPDATE' and old.completed_at is null and new.completed_at is not null) then
    new.first_completed_at := now();
  else
    new.first_completed_at := null;
  end if;
  return new;
end $$;
create trigger user_video_progress_first_completed before insert or update on user_video_progress
  for each row execute function keep_first_completed_at();

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

-- Aggregate before PostgREST applies its max_rows cap. SECURITY INVOKER keeps
-- the caller's table permissions and RLS in force; the explicit user predicate
-- makes the function's scope unambiguous.
create function pronunciation_metric_means(p_start timestamptz, p_end timestamptz)
  returns table (pronunciation_score numeric, pitch_score numeric, rhythm_score numeric)
  language sql
  stable
  security invoker
  set search_path = public
as $$
  select
    avg(s.pronunciation_score),
    avg(s.pitch_score),
    avg(s.rhythm_score)
  from shadowing_sessions s
  where s.user_id = auth.uid()
    and s.created_at >= p_start
    and s.created_at < p_end;
$$;

revoke all on function pronunciation_metric_means(timestamptz, timestamptz) from public, anon;
grant execute on function pronunciation_metric_means(timestamptz, timestamptz) to authenticated;

-- JLPT Speaking is a view over lessons and the caller's sessions, not an
-- entity: per level, the lessons the caller can see (videos RLS, via SECURITY
-- INVOKER), how many of them the caller has shadowed, and the caller's mean
-- score there. Aggregated here for the same max_rows reason as above.
create function jlpt_speaking_summary()
  returns table (level jlpt_level, lesson_count bigint, practiced_count bigint, average_score numeric)
  language sql
  stable
  security invoker
  set search_path = public
as $$
  select
    v.jlpt_level_estimate,
    count(distinct v.id),
    count(distinct s.video_id),
    avg(s.pronunciation_score)
  from videos v
  left join shadowing_sessions s on s.video_id = v.id and s.user_id = auth.uid()
  where v.jlpt_level_estimate is not null
  group by v.jlpt_level_estimate;
$$;

revoke all on function jlpt_speaking_summary() from public, anon;
grant execute on function jlpt_speaking_summary() to authenticated;

-- The caller's newest session per lesson: half of a lesson's "last activity"
-- (owner ruling 17), with user_video_progress.last_watched_at the other half.
create function lesson_last_spoken_at(p_video_ids uuid[])
  returns table (video_id uuid, spoken_at timestamptz)
  language sql
  stable
  security invoker
  set search_path = public
as $$
  select s.video_id, max(s.created_at)
  from shadowing_sessions s
  where s.user_id = auth.uid()
    and s.video_id = any (p_video_ids)
  group by s.video_id;
$$;

revoke all on function lesson_last_spoken_at(uuid[]) from public, anon;
grant execute on function lesson_last_spoken_at(uuid[]) to authenticated;

-- The studio rail's reads, aggregated here for the same max_rows reason. Days
-- are the caller's study-timezone days (lib/time/study-day.ts); the zone is passed in as p_tz.

-- Seconds spoken in a window: the reference length of each line the caller
-- shadowed. A line with no end time has no known length and adds nothing.
create function pronunciation_speaking_seconds(p_start timestamptz, p_end timestamptz)
  returns numeric
  language sql
  stable
  security invoker
  set search_path = public
as $$
  select coalesce(sum(greatest(l.end_time - l.start_time, 0)), 0)
  from shadowing_sessions s
  join transcript_lines l on l.id = s.transcript_line_id
  where s.user_id = auth.uid()
    and s.created_at >= p_start
    and s.created_at < p_end
    and l.end_time is not null;
$$;

revoke all on function pronunciation_speaking_seconds(timestamptz, timestamptz) from public, anon;
grant execute on function pronunciation_speaking_seconds(timestamptz, timestamptz) to authenticated;

-- The caller's mean score per study-timezone day in a window; a day without a
-- scored session has no row.
create function pronunciation_daily_means(p_start timestamptz, p_end timestamptz, p_tz text)
  returns table (day date, pronunciation_score numeric)
  language sql
  stable
  security invoker
  set search_path = public
as $$
  select (s.created_at at time zone p_tz)::date, avg(s.pronunciation_score)
  from shadowing_sessions s
  where s.user_id = auth.uid()
    and s.created_at >= p_start
    and s.created_at < p_end
    and s.pronunciation_score is not null
  group by 1
  order by 1;
$$;

revoke all on function pronunciation_daily_means(timestamptz, timestamptz, text) from public, anon;
grant execute on function pronunciation_daily_means(timestamptz, timestamptz, text) to authenticated;

-- The caller's most recently shadowed lessons, newest first. The score is the
-- mean over that lesson's sessions on the study-timezone day of its last practice.
create function pronunciation_recent_practice(p_limit int, p_tz text)
  returns table (video_id uuid, practiced_at timestamptz, pronunciation_score numeric)
  language sql
  stable
  security invoker
  set search_path = public
as $$
  with latest as (
    select s.video_id, max(s.created_at) as practiced_at
    from shadowing_sessions s
    where s.user_id = auth.uid() and s.video_id is not null
    group by s.video_id
    order by 2 desc, 1
    limit least(greatest(p_limit, 0), 20)
  )
  select latest.video_id, latest.practiced_at, avg(s.pronunciation_score)
  from latest
  join shadowing_sessions s
    on s.video_id = latest.video_id
    and s.user_id = auth.uid()
    and (s.created_at at time zone p_tz)::date = (latest.practiced_at at time zone p_tz)::date
  group by latest.video_id, latest.practiced_at
  order by latest.practiced_at desc, latest.video_id;
$$;

revoke all on function pronunciation_recent_practice(int, text) from public, anon;
grant execute on function pronunciation_recent_practice(int, text) to authenticated;

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
