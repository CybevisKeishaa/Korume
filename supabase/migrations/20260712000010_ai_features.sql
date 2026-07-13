-- Layer 4 (AI features): video summaries, AI-content labeling on vocab
-- examples, and a grants audit on the conversation tables.
--
-- Spec refs: japanese-learning-app-spec.md line 119 ("AI tóm tắt video: tóm
-- tắt nội dung + liệt kê từ vựng/ngữ pháp trọng tâm"), line 317 ("nội dung AI
-- phải gắn nhãn 'AI-generated'"). CLAUDE.md §5 (differentiators) + §9 DoD.

-- ---------------------------------------------------------------------------
-- 1. video_summaries — one AI-generated summary per video.
-- ---------------------------------------------------------------------------
-- Shared content (not user-owned): every signed-in user reads the same
-- summary for a given video, same shape as vocab/kanji/grammar content rows.
-- Written exclusively by server-side code using the service-role client
-- (Claude API call happens in ai-engineer's /lib/ai, never client-side —
-- CLAUDE.md §6 "secrets/third-party calls server-side only"), so there is no
-- authenticated insert/update/delete policy at all — only SELECT.
create table video_summaries (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos (id) on delete cascade unique,
  summary text not null,
  key_vocab jsonb not null default '[]',
  key_grammar jsonb not null default '[]',
  model text not null,
  created_at timestamptz not null default now()
);

alter table video_summaries enable row level security;

create policy video_summaries_read on video_summaries for select to authenticated using (true);
-- Deliberately no insert/update/delete policy for `authenticated` — RLS
-- default-denies any statement without a matching policy, so this alone
-- blocks writes. service_role bypasses RLS entirely for the write path.

-- Table-level grants. `alter default privileges` from
-- 20260712000006_grants.sql auto-grants SELECT, INSERT, UPDATE, DELETE on any
-- new table to `authenticated` — that's a real hole here (RLS with no write
-- policy blocks the DML at the row level, but relying on "no policy exists"
-- alone is fragile; a future `create policy ... for insert using (true)`
-- typo would combine with a lingering table grant to reopen it). Revoke the
-- write grants explicitly so the only path to non-SELECT DML is service_role.
grant select on video_summaries to authenticated;
revoke insert, update, delete on video_summaries from authenticated;
grant all on video_summaries to service_role;

-- Hot path: summary lookup by video (also enforced unique above).
create index idx_video_summaries_video_id on video_summaries (video_id);

-- ---------------------------------------------------------------------------
-- 2. vocab_examples.source — label AI-generated example sentences.
-- ---------------------------------------------------------------------------
-- vocab_examples (20260712000001_schema.sql) currently has no way to tell a
-- curated example sentence from one Claude generated (Layer 4 "AI sinh ví dụ
-- câu" / CLAUDE.md §5 example-sentence generation). Spec line 317 requires
-- AI content be labeled; default 'curated' preserves the existing seed rows'
-- meaning without a backfill.
alter table vocab_examples
  add column source text not null default 'curated'
    check (source in ('curated', 'ai_generated'));

-- ---------------------------------------------------------------------------
-- 3. Conversation tables — grants audit (no schema change needed).
-- ---------------------------------------------------------------------------
-- conversation_sessions / conversation_messages were created in
-- 20260712000001_schema.sql (before 20260712000006_grants.sql ran), so the
-- one-time `grant ... on all tables in schema public to authenticated` in
-- migration 6 already covers them — confirmed by inspection, not just
-- default privileges (which only protect tables created AFTER migration 6).
-- RLS policies conversation_sessions_own / conversation_messages_own
-- (20260712000002_rls.sql) scope rows to the owning user via session_id join.
-- No grants are missing; nothing to add here. Verified in the reset output
-- below (grants query returns rows for both tables).
--
-- Columns already present and relevant to Layer 4:
--   conversation_sessions: id, user_id, scenario_type text, started_at,
--     ended_at timestamptz (both present — spec §4 satisfied, no migration
--     needed for session start/end tracking).
--   conversation_messages: id, session_id, role (enum: user/ai), content,
--     pronunciation_score numeric(5,2) (present; Layer 4's voice mode keeps
--     its per-utterance score client-side only — best-effort UI garnish, not
--     persisted — but the column is ready if a later layer wants to write
--     it without a new migration), created_at.
