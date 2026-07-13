-- Layer 5: JLPT test engine hardening + Reading module (spec §3.7 "Bài đọc
-- theo cấp độ ... Câu hỏi đọc hiểu sau mỗi bài, chấm tự động"; §3.8 "Thống kê
-- điểm yếu theo dạng câu"). Reading tables have no spec §4 schema — defined
-- here following the same conventions as kanji/vocab/grammar content tables
-- and the existing jlpt_* tables (20260712000001_schema.sql).

-- ---------------------------------------------------------------------------
-- 1. reading_passages — shared content, same pattern as grammar_points/vocab:
--    read-only to any signed-in user, writes are service-role only.
-- ---------------------------------------------------------------------------
create table reading_passages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  jlpt_level jlpt_level not null,
  body_jp text not null,
  body_translation text,
  furigana_json jsonb, -- same convention as transcript_lines.furigana_json
  word_count int check (word_count >= 0),
  created_at timestamptz not null default now()
);

alter table reading_passages enable row level security;

create policy reading_passages_read on reading_passages for select to authenticated using (true);
-- No insert/update/delete policy for `authenticated` — RLS default-denies;
-- service_role (bypasses RLS) is the only write path, same as video_summaries
-- in 20260712000010_ai_features.sql.

-- `alter default privileges` from 20260712000006_grants.sql auto-grants
-- SELECT/INSERT/UPDATE/DELETE on new tables to `authenticated` — revoke the
-- write grants explicitly (belt-and-suspenders alongside the missing RLS
-- write policy, matching the video_summaries precedent).
grant select on reading_passages to authenticated;
revoke insert, update, delete on reading_passages from authenticated;
grant all on reading_passages to service_role;

-- ---------------------------------------------------------------------------
-- 2. reading_questions — shared content, but `correct_answer` and
--    `explanation` must never reach the client (server scores via
--    service role, same principle as jlpt_questions.correct_answer).
-- ---------------------------------------------------------------------------
create table reading_questions (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references reading_passages (id) on delete cascade,
  question text not null,
  options jsonb not null, -- array of choices, e.g. ["...", "...", "...", "..."]
  correct_answer text not null,
  explanation text,
  order_index int not null default 0
);

alter table reading_questions enable row level security;

create policy reading_questions_read on reading_questions for select to authenticated
  using (true);
-- RLS gates the ROW (every row is readable); the GRANT below narrows which
-- COLUMNS of that row are readable — correct_answer/explanation are excluded
-- so autograding cannot be bypassed by reading the client's own query.
--
-- reading_questions is a table created AFTER 20260712000006_grants.sql, so
-- `alter default privileges ... grant select, insert, update, delete on
-- tables to authenticated` fires automatically at CREATE TABLE time and
-- hands `authenticated` a table-wide SELECT covering every column —
-- including correct_answer/explanation. A column-scoped grant added on top
-- of that is a no-op (the broader table-wide grant already permits
-- everything). The table-wide SELECT must be revoked FIRST, exactly like
-- jlpt_questions below, or the "restricted" columns are still readable.
revoke select on reading_questions from authenticated;
grant select (id, passage_id, question, options, order_index) on reading_questions to authenticated;
revoke insert, update, delete on reading_questions from authenticated;
grant all on reading_questions to service_role;

-- ---------------------------------------------------------------------------
-- 3. user_reading_attempts — owner-only, same shape as user_test_attempts.
-- ---------------------------------------------------------------------------
create table user_reading_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  passage_id uuid not null references reading_passages (id) on delete cascade,
  answers jsonb not null,
  score numeric(5, 2) not null,
  completed_at timestamptz not null default now()
);

alter table user_reading_attempts enable row level security;

create policy reading_attempts_own on user_reading_attempts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on user_reading_attempts to authenticated;
grant all on user_reading_attempts to service_role;

-- ---------------------------------------------------------------------------
-- 4. jlpt_questions hardening — column-scoped SELECT.
-- ---------------------------------------------------------------------------
-- 20260712000002_rls.sql deliberately added NO select policy on
-- jlpt_questions, so RLS already default-denies every row to `authenticated`
-- today. But 20260712000006_grants.sql's blanket
-- `grant select, insert, update, delete on all tables ... to authenticated`
-- ran AFTER the table was created, so the table-level GRANT is still sitting
-- there as a second, redundant lock only RLS is currently holding shut — a
-- future `create policy jlpt_questions_read ... using (true)` (the natural
-- next step once the RLS gate needs opening for the test-taking UI) would
-- silently also expose correct_answer with no separate warning. Close that
-- gap now: revoke the table-wide SELECT and replace it with a column-scoped
-- grant, then add the actual read policy the JLPT UI needs (test-taking
-- must be able to see question_data even though the RLS policy area was
-- previously left empty as a stopgap).

-- New columns must exist before the column-scoped grant below can name them.
alter table jlpt_questions
  add column explanation text,
  add column question_type text,
  add column order_index int not null default 0;

revoke select on jlpt_questions from authenticated;
grant select (id, test_id, section, question_data, question_type, order_index) on jlpt_questions to authenticated;

create policy jlpt_questions_read on jlpt_questions for select to authenticated using (true);
-- correct_answer remains unreadable: not included in the column grant above.
-- Scoring reads it via the service role, server-side only (unchanged from
-- the original migration 1/2 intent).

-- ---------------------------------------------------------------------------
-- 5. user_test_attempts hardening — support in-progress + section-mode runs.
-- ---------------------------------------------------------------------------
alter table user_test_attempts
  add column started_at timestamptz not null default now(),
  add column answers jsonb,
  add column mode text not null default 'full' check (mode in ('full', 'section')),
  add column section jlpt_section; -- nullable; set only when mode = 'section'

-- user_test_attempts already has full owner CRUD via test_attempts_own
-- (20260712000002_rls.sql: `for all ... using (user_id = auth.uid())
-- with check (user_id = auth.uid())`), which already covers the INSERT the
-- client needs to start an attempt (answers/started_at populated
-- client-side as the user progresses, score/section_scores/completed_at
-- filled by the server on submit through the same owner-scoped UPDATE).
-- Nothing further to add here — noted for the handoff record.

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index idx_reading_passages_level on reading_passages (jlpt_level);
create index idx_reading_questions_passage on reading_questions (passage_id);
create index idx_reading_attempts_user_passage on user_reading_attempts (user_id, passage_id);
create index idx_jlpt_questions_test_section on jlpt_questions (test_id, section);
create index idx_test_attempts_user_test on user_test_attempts (user_id, test_id);

-- NOTE: idx_jlpt_questions_test (test_id) and idx_test_attempts_user
-- (user_id) already exist from 20260712000003_indexes.sql. The two new
-- composite indexes above are additive (support section/test_id and
-- user/test lookups the weakness-stats feature needs) — not replacements.
