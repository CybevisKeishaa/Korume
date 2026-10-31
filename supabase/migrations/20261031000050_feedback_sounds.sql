-- Result sounds (owner 2026-10-31, practice-listening Task 16 look): a short, quiet chime when a Listening or
-- Pronunciation result arrives, one per score band. On unless the learner turns it off in Settings.
-- Additive only (AGENTS.md §6 from 049): one column with a default, so every existing row reads true and no
-- reader of the old shape breaks. RLS and grants on user_preferences already cover the new column.
alter table user_preferences add column feedback_sounds boolean not null default true;
