-- A Lesson Bookmark is an explicit saved lesson, separate from user_lesson_library membership and playlists.
create table user_lesson_bookmarks (
  user_id uuid not null references users (id) on delete cascade,
  video_id uuid not null references videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

alter table user_lesson_bookmarks enable row level security;

create policy user_lesson_bookmarks_select_own on user_lesson_bookmarks
  for select to authenticated using (user_id = auth.uid());
-- The exists runs under the learner's own videos RLS: an inaccessible lesson cannot be bookmarked.
create policy user_lesson_bookmarks_insert_own on user_lesson_bookmarks
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from videos v where v.id = video_id)
  );
create policy user_lesson_bookmarks_delete_own on user_lesson_bookmarks
  for delete to authenticated using (user_id = auth.uid());

-- No update: a bookmark is a fact with a time, toggled by insert and delete.
grant select, insert, delete on user_lesson_bookmarks to authenticated;
revoke update on user_lesson_bookmarks from authenticated;
grant all on user_lesson_bookmarks to service_role;
