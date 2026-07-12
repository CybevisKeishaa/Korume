-- Sentence mining from video (CLAUDE.md §5 differentiator #3). Compliant by
-- design: we store NO media of any kind (no screenshot, no audio clip) — only
-- a timestamp range into the existing transcript_line. Replay happens by
-- seeking the official YouTube IFrame player to start_time (CLAUDE.md §2.1:
-- never download/re-host/proxy video or extracted frames/audio from it).

create table sentence_mining_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  video_id uuid not null references videos (id) on delete cascade,
  transcript_line_id uuid references transcript_lines (id) on delete set null,
  target_word text not null,
  reading text,
  sentence_jp text not null,
  sentence_translation text,
  start_time numeric(10, 3),
  end_time numeric(10, 3),
  created_at timestamptz not null default now(),
  -- SRS state (SM-2), mirrors user_vocab_progress / user_kanji_progress
  -- exactly (20260712000001_schema.sql + interval_days from
  -- 20260712000004_srs_interval.sql) so the one shared SM-2 engine can
  -- schedule mining cards the same way it schedules vocab/kanji reviews.
  srs_stage int not null default 0,
  interval_days int not null default 0,
  ease_factor numeric(4, 2) not null default 2.50,
  next_review_at timestamptz,
  last_reviewed_at timestamptz
);

alter table sentence_mining_cards enable row level security;

create policy sentence_mining_cards_own on sentence_mining_cards for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Table-level grants: `alter default privileges` from 20260712000006_grants.sql
-- only covers roles present in THIS session at DDL time in some Postgres/Supabase
-- setups; grant explicitly too so a fresh `db push` never regresses to 42501
-- (see 20260712000006_grants.sql header for the gotcha this guards against).
grant select, insert, update, delete on sentence_mining_cards to authenticated;
grant all on sentence_mining_cards to service_role;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Hot path: "my mining deck" list / lookup by owner, newest first.
create index idx_sentence_mining_cards_user_created
  on sentence_mining_cards (user_id, created_at desc);

-- SRS "what's due now" queries — same partial-index shape as
-- idx_kanji_progress_due / idx_vocab_progress_due in
-- 20260712000003_indexes.sql (only rows actually scheduled).
create index idx_sentence_mining_cards_due
  on sentence_mining_cards (user_id, next_review_at)
  where next_review_at is not null;

-- NOTE: transcript_lines(transcript_id, start_time) already exists as
-- idx_transcript_lines_transcript_time in 20260712000003_indexes.sql — not
-- re-created here.
