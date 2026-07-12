-- Row-Level Security. Users may only ever read/write their own learning data
-- (CLAUDE.md §2). Content is read-only to signed-in users; all content writes
-- go through the service role (which bypasses RLS) from admin/server code.

-- Enable RLS on every table.
alter table users enable row level security;
alter table user_stats enable row level security;
alter table radicals enable row level security;
alter table kanji enable row level security;
alter table kanji_readings enable row level security;
alter table user_kanji_progress enable row level security;
alter table vocab enable row level security;
alter table vocab_examples enable row level security;
alter table user_vocab_progress enable row level security;
alter table grammar_points enable row level security;
alter table user_grammar_progress enable row level security;
alter table videos enable row level security;
alter table transcripts enable row level security;
alter table transcript_lines enable row level security;
alter table user_video_progress enable row level security;
alter table user_playlists enable row level security;
alter table user_playlist_items enable row level security;
alter table shadowing_sessions enable row level security;
alter table dictation_attempts enable row level security;
alter table conversation_sessions enable row level security;
alter table conversation_messages enable row level security;
alter table jlpt_tests enable row level security;
alter table jlpt_questions enable row level security;
alter table user_test_attempts enable row level security;
alter table badges enable row level security;
alter table user_badges enable row level security;
alter table forum_posts enable row level security;
alter table forum_comments enable row level security;
alter table subscriptions enable row level security;

-- ---------------------------------------------------------------------------
-- Profile & stats: owner-only.
-- ---------------------------------------------------------------------------
create policy users_select_own on users for select to authenticated using (id = auth.uid());
create policy users_update_own on users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy stats_select_own on user_stats for select to authenticated using (user_id = auth.uid());
-- XP / streak are gamification integrity data: read-only to the client. All
-- mutations go through the service role server-side (Layer 6), never a direct
-- client UPDATE — otherwise a user could set their own XP via the anon key.

-- ---------------------------------------------------------------------------
-- Content tables: read-only to any signed-in user. Writes = service role only.
-- ---------------------------------------------------------------------------
create policy radicals_read on radicals for select to authenticated using (true);
create policy kanji_read on kanji for select to authenticated using (true);
create policy kanji_readings_read on kanji_readings for select to authenticated using (true);
create policy vocab_read on vocab for select to authenticated using (true);
create policy vocab_examples_read on vocab_examples for select to authenticated using (true);
create policy grammar_read on grammar_points for select to authenticated using (true);
create policy badges_read on badges for select to authenticated using (true);
create policy jlpt_tests_read on jlpt_tests for select to authenticated using (true);
-- NOTE: no select policy on jlpt_questions — correct_answer must never reach
-- the client. Scoring reads it via the service role, server-side only.

-- Videos: readable when approved; a submitter can see their own pending video.
create policy videos_read on videos for select to authenticated
  using (status = 'approved' or added_by_user_id = auth.uid());

create policy transcripts_read on transcripts for select to authenticated
  using (exists (
    select 1 from videos v
    where v.id = transcripts.video_id
      and (v.status = 'approved' or v.added_by_user_id = auth.uid())
  ));

create policy transcript_lines_read on transcript_lines for select to authenticated
  using (exists (
    select 1 from transcripts t join videos v on v.id = t.video_id
    where t.id = transcript_lines.transcript_id
      and (v.status = 'approved' or v.added_by_user_id = auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Per-user progress / activity: full CRUD scoped to the owner.
-- ---------------------------------------------------------------------------
create policy kanji_progress_own on user_kanji_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy vocab_progress_own on user_vocab_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy grammar_progress_own on user_grammar_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy video_progress_own on user_video_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy playlists_own on user_playlists for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy shadowing_own on shadowing_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dictation_own on dictation_attempts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy conversation_sessions_own on conversation_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy test_attempts_own on user_test_attempts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Playlist items: owner is derived from the parent playlist.
create policy playlist_items_own on user_playlist_items for all to authenticated
  using (exists (
    select 1 from user_playlists p
    where p.id = user_playlist_items.playlist_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from user_playlists p
    where p.id = user_playlist_items.playlist_id and p.user_id = auth.uid()
  ));

-- Conversation messages: owner is derived from the parent session.
create policy conversation_messages_own on conversation_messages for all to authenticated
  using (exists (
    select 1 from conversation_sessions s
    where s.id = conversation_messages.session_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from conversation_sessions s
    where s.id = conversation_messages.session_id and s.user_id = auth.uid()
  ));

-- Badges awarded to the user: read-only to the owner (awarding is server-side).
create policy user_badges_read_own on user_badges for select to authenticated
  using (user_id = auth.uid());

-- Subscriptions: owner may read; writes come from the Stripe webhook (service role).
create policy subscriptions_read_own on subscriptions for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Community: any signed-in user reads; authors manage their own rows.
-- ---------------------------------------------------------------------------
create policy forum_posts_read on forum_posts for select to authenticated using (true);
create policy forum_posts_insert on forum_posts for insert to authenticated
  with check (user_id = auth.uid());
create policy forum_posts_modify on forum_posts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy forum_posts_delete on forum_posts for delete to authenticated
  using (user_id = auth.uid());

create policy forum_comments_read on forum_comments for select to authenticated using (true);
create policy forum_comments_insert on forum_comments for insert to authenticated
  with check (user_id = auth.uid());
create policy forum_comments_modify on forum_comments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy forum_comments_delete on forum_comments for delete to authenticated
  using (user_id = auth.uid());
