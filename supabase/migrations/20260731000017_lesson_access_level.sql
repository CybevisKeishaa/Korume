-- supabase/migrations/20260731000017_lesson_access_level.sql
-- Shadowing Hub Lesson Workspace spec §1.2 / §9 item 1.
--
-- Split into two migrations on purpose (this one + 20260731000021's cleanup):
-- `videos_read`/`videos_insert` (20260712000002_rls.sql, 20260712000009) still
-- reference `status` until Task 5 rewrites them. Dropping `status` here would
-- break every existing policy mid-migration-sequence. `library_access` is
-- added and backfilled now; `status`/`video_status` are dropped only once
-- nothing references them (Task 6).

create type lesson_access_level as enum ('PRIVATE', 'FREE', 'PLUS');

alter table videos add column library_access lesson_access_level not null default 'PRIVATE';

update videos set library_access = 'FREE' where status = 'approved';
-- status = 'pending' rows already default to 'PRIVATE' from the column default; no-op for them,
-- but stated explicitly so a future reader doesn't have to infer it.
update videos set library_access = 'PRIVATE' where status = 'pending';
