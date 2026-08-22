-- Content is versioned reference data and belongs in a migration so `db push`
-- carries it (project convention since Layer 2 — never seed.sql).
--
-- The slug rule must match the filenames authored in public/badges/ exactly;
-- a mismatch is a 404 the badge-icon test catches. Badge names are
-- snake_case with no spaces, so `replace(name, ' ', '-')` is a deliberate
-- no-op here — filenames keep their underscores.
--
-- ⚠️ SCOPED to the badges whose icons were actually authored in this commit
-- (whole-branch review). Unscoped, this statement updated EVERY row: a badge
-- added later with no authored SVG would silently receive a shape-valid
-- `icon_url`, pass `ICON_URL_PATTERN`, and render an INVISIBLE image —
-- bypassing the null-icon fallback the UI has carried since L6 rather than
-- using it. An invisible badge is worse than a fallback badge, and worse
-- again because nothing looks wrong.
--
-- The list below is not a duplicate of "which badges exist"; it is the
-- MANIFEST of which SVGs this commit authored, which is a different fact and
-- has no other home. Counted against public/badges/ at the time of writing —
-- never quote it from here, run:
--   ls public/badges/ | wc -l
update badges
   set icon_url = '/badges/' || lower(replace(name, ' ', '-')) || '.svg'
 where name in (
   'dictation_50',
   'first_steps',
   'hundred_kanji',
   'month_streak',
   'n4_mock',
   'n5_mock',
   'reading_10',
   'shadowing_50',
   'week_streak',
   'xp_1000',
   'xp_10000'
 );
