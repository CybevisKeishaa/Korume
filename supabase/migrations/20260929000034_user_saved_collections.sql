-- Learning paths a learner saved from the Pronunciation Studio: the ✦ button on
-- each path card (Figma 37:5452), owner ruling 2026-09-29. Saved paths are
-- also preferred when the studio picks its featured course.
create table user_saved_collections (
  user_id uuid not null references users (id) on delete cascade,
  collection_id uuid not null references collections (id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, collection_id)
);

alter table user_saved_collections enable row level security;

create policy user_saved_collections_select_own on user_saved_collections
  for select to authenticated using (user_id = auth.uid());
-- Only a learning path can be saved; the database, not the route, says so.
create policy user_saved_collections_insert_own on user_saved_collections
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from collections c where c.id = collection_id and c.kind = 'path')
  );
create policy user_saved_collections_delete_own on user_saved_collections
  for delete to authenticated using (user_id = auth.uid());

-- No update: a save is a fact with a time, toggled by insert and delete.
grant select, insert, delete on user_saved_collections to authenticated;
revoke update on user_saved_collections from authenticated;
grant all on user_saved_collections to service_role;
