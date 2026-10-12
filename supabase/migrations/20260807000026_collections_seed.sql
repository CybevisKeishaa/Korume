-- supabase/migrations/20260807000026_collections_seed.sql
-- Plan C spec §3.5 / D4. Content is versioned reference data, so it lives in a
-- migration rather than seed.sql — `db push` must deploy it.
--
-- These rows are EDITORIAL CONTENT, NOT TAXONOMY. A collection is a curated
-- set that CONTAINS lessons; it is not an attribute OF a lesson. They are named
-- after level bands only because the curator chose to shelve Explore by level —
-- `videos.jlpt_level_estimate` and `collections` stay independent, and a later
-- collection may cut across levels entirely. Do not derive one from the other.
--
-- `featured` is a collections row with slug = 'featured', not a boolean column
-- and not a fourth library_access value — see 20260731000019's own comment.

insert into collections (slug, title, description, display_order) values
  ('featured', 'Featured', 'The lesson Korume is putting in front of you today.', 0),
  ('beginner-foundation', 'Beginner Foundation',
   'Start with the phrases that make every familiar moment easier.', 1),
  ('daily-conversation', 'Daily Conversation',
   'Build confidence in everyday spoken Japanese.', 2),
  ('natural-japanese', 'Natural Japanese',
   'Notice the pace, shorthand and small expressions people actually use.', 3),
  ('advanced-expression', 'Advanced Expression',
   'Stay present through nuance, preferences and the unexpected.', 4),
  ('native-fluency', 'Native Fluency',
   'Step into full-speed scenes, podcasts and the details underneath them.', 5);

-- port-dashboard D2b: one curriculum per JLPT level. Membership is authored content applied by sync, never a migration.
insert into collections (slug, title, description, display_order, kind, curriculum_level) values
  ('jlpt-n5', 'JLPT N5', null, 100, 'curriculum', 'N5'),
  ('jlpt-n4', 'JLPT N4', null, 101, 'curriculum', 'N4'),
  ('jlpt-n3', 'JLPT N3', null, 102, 'curriculum', 'N3'),
  ('jlpt-n2', 'JLPT N2', null, 103, 'curriculum', 'N2'),
  ('jlpt-n1', 'JLPT N1', null, 104, 'curriculum', 'N1');

-- Learning paths and practice goals from the Pronunciation Studio frame
-- (Figma 37:5439, 37:5668). Membership is editorial content tied to real video
-- ids, so none is seeded here.
insert into collections (slug, title, description, display_order, kind, skill_focus, icon) values
  ('everyday-conversation', 'Everyday Conversation', 'Natural phrases for daily life.', 6, 'path', null, '🗾'),
  ('business-japanese', 'Business Japanese', 'Meetings, emails and confident introductions.', 7, 'path', null, '💼'),
  ('it-engineer-communication', 'IT Engineer Communication', 'Stand-ups, specs and product discussion.', 8, 'path', null, '⌨️'),
  ('travel-in-japan', 'Travel in Japan', 'Navigate every journey with ease.', 9, 'path', null, '🗺️'),
  ('improve-pitch-accent', 'Improve Pitch Accent', 'Train your ear to hear Japanese pitch patterns.', 10, 'goal', 'pitch', '〽'),
  ('improve-fluency', 'Improve Fluency', 'Build calm, connected speaking habits.', 11, 'goal', 'rhythm', '≈'),
  ('native-rhythm-training', 'Native Rhythm Training', 'Find a natural pace through real dialogues.', 12, 'goal', 'rhythm', '◌');
