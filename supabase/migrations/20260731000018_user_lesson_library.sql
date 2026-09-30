-- supabase/migrations/20260731000018_user_lesson_library.sql
-- Shadowing Hub Lesson Workspace spec §1.3 / §9 item 2 (part 1 of 2).

create table user_lesson_library (
  user_id uuid not null references users (id) on delete cascade,
  lesson_id uuid not null references videos (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table user_lesson_library enable row level security;

create policy user_lesson_library_read on user_lesson_library for select to authenticated
  using (user_id = auth.uid());
create policy user_lesson_library_insert on user_lesson_library for insert to authenticated
  with check (user_id = auth.uid());

create function popular_lesson_ids(p_limit int)
  returns table (lesson_id uuid)
  language sql
  stable
  security definer
  set search_path = public
as $$
  select ull.lesson_id
  from user_lesson_library ull
  group by ull.lesson_id
  order by count(distinct ull.user_id) desc, ull.lesson_id asc
  limit greatest(p_limit, 0);
$$;

revoke all on function popular_lesson_ids(int) from public, anon, authenticated;
grant execute on function popular_lesson_ids(int) to service_role;
-- No update/delete policy: library membership is append-only from the client's perspective (no
-- "remove from my lessons" feature is designed yet — out of scope, same as the source spec's §10).
