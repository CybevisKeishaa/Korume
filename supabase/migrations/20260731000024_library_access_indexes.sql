-- Final whole-branch review (2026-08-01): Task 6's drop of videos.status
-- silently dropped idx_videos_status (Postgres drops dependent indexes with
-- the column) — library_access is now the filter for videos_read RLS
-- (evaluated on every authenticated read) plus every Promotion Queue view
-- and recommendations/admin-stats query, with no index. Also missing:
-- an index on user_lesson_library.lesson_id (the PK is (user_id, lesson_id),
-- which can't serve a lookup by lesson_id alone) and on
-- lesson_collections.collection_id (flagged as a Minor in Task 3's review,
-- folded in here rather than a fourth tiny migration).

create index idx_videos_library_access on videos (library_access);
create index idx_user_lesson_library_lesson_id on user_lesson_library (lesson_id);
create index idx_lesson_collections_collection_id on lesson_collections (collection_id);
