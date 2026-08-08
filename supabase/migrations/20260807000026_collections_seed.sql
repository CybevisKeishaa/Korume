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
