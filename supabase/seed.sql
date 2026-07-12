-- Minimal ORIGINAL seed content (CLAUDE.md §3 — no verbatim copying).
-- Idempotent so it can be re-run safely. User rows are NOT seeded — they are
-- created by Supabase Auth on signup.

insert into radicals (character, meaning_en, meaning_vi) values
  ('水', 'water', 'nước'),
  ('人', 'person', 'người'),
  ('日', 'sun / day', 'mặt trời / ngày')
on conflict (character) do nothing;

insert into kanji (character, jlpt_level, stroke_count, meaning_en, meaning_vi, mnemonic_text) values
  ('水', 'N5', 4, 'water', 'nước', 'A splash frozen mid-air — four droplets flung from a central stream.'),
  ('人', 'N5', 2, 'person', 'người', 'Two legs mid-stride: a person walking.'),
  ('日', 'N5', 4, 'sun / day', 'mặt trời / ngày', 'A window with the sun framed inside it — one square, one day.')
on conflict (character) do nothing;

insert into kanji_readings (kanji_id, reading, reading_type)
select k.id, r.reading, r.reading_type::reading_type
from (values
  ('水', 'スイ', 'on'),
  ('水', 'みず', 'kun'),
  ('人', 'ジン', 'on'),
  ('人', 'ひと', 'kun'),
  ('日', 'ニチ', 'on'),
  ('日', 'ひ', 'kun')
) as r(character, reading, reading_type)
join kanji k on k.character = r.character
where not exists (
  select 1 from kanji_readings kr
  where kr.kanji_id = k.id and kr.reading = r.reading
);

insert into vocab (word, reading, meaning_en, meaning_vi, jlpt_level, part_of_speech) values
  ('水', 'みず', 'water', 'nước', 'N5', 'noun'),
  ('人', 'ひと', 'person', 'người', 'N5', 'noun'),
  ('食べる', 'たべる', 'to eat', 'ăn', 'N5', 'verb (ichidan)')
on conflict do nothing;

insert into grammar_points (title, jlpt_level, structure_pattern, explanation, example_sentences) values
  (
    'は (topic marker)',
    'N5',
    '〔Noun〕 は 〔comment〕',
    'Marks the topic of the sentence — what the rest of the sentence is about. Distinct from the subject marker が.',
    '[{"jp": "わたしは がくせいです。", "en": "As for me, I am a student."}]'::jsonb
  )
on conflict do nothing;

insert into badges (name, description, criteria) values
  ('first_steps', 'Completed your first study session.', '{"type": "sessions", "count": 1}'::jsonb),
  ('week_streak', 'Studied 7 days in a row.', '{"type": "streak", "days": 7}'::jsonb)
on conflict (name) do nothing;
