-- Content is versioned reference data and belongs in a migration so `db push`
-- carries it (project convention since Layer 2 — never seed.sql).
--
-- The slug rule must match the filenames authored in public/badges/ exactly;
-- a mismatch is a 404 the badge-icon test catches. Badge names are
-- snake_case with no spaces, so `replace(name, ' ', '-')` is a deliberate
-- no-op here — filenames keep their underscores.
update badges set icon_url = '/badges/' || lower(replace(name, ' ', '-')) || '.svg';
