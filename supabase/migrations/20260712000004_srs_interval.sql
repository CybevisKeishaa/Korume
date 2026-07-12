-- SM-2 needs the current interval persisted (repetitions↔srs_stage and
-- easeFactor↔ease_factor already exist). Add interval_days to the SRS tables.

alter table user_kanji_progress
  add column interval_days int not null default 0;

alter table user_vocab_progress
  add column interval_days int not null default 0;
