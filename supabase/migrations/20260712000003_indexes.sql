-- Indexes for the hot paths.

-- SRS "what's due now" queries (partial: only rows actually scheduled).
create index idx_kanji_progress_due
  on user_kanji_progress (user_id, next_review_at)
  where next_review_at is not null;
create index idx_vocab_progress_due
  on user_vocab_progress (user_id, next_review_at)
  where next_review_at is not null;

-- Browse content by JLPT level.
create index idx_kanji_level on kanji (jlpt_level);
create index idx_vocab_level on vocab (jlpt_level);
create index idx_grammar_level on grammar_points (jlpt_level);

-- Foreign-key / lookup indexes.
create index idx_kanji_readings_kanji on kanji_readings (kanji_id);
create index idx_vocab_examples_vocab on vocab_examples (vocab_id);
create index idx_vocab_examples_video on vocab_examples (source_video_id);
create index idx_kanji_radical on kanji (radical_id);

create index idx_videos_status on videos (status);
create index idx_videos_added_by on videos (added_by_user_id);
create index idx_transcripts_video on transcripts (video_id);
-- Player syncs transcript lines by time within a transcript.
create index idx_transcript_lines_transcript_time
  on transcript_lines (transcript_id, start_time);

create index idx_playlist_items_video on user_playlist_items (video_id);
create index idx_user_playlists_user on user_playlists (user_id);

create index idx_shadowing_user_created on shadowing_sessions (user_id, created_at desc);
create index idx_dictation_user_created on dictation_attempts (user_id, created_at desc);

create index idx_conversation_sessions_user on conversation_sessions (user_id);
create index idx_conversation_messages_session on conversation_messages (session_id);

create index idx_jlpt_questions_test on jlpt_questions (test_id);
create index idx_test_attempts_user on user_test_attempts (user_id);

create index idx_forum_comments_post on forum_comments (post_id);
create index idx_forum_posts_user on forum_posts (user_id);
