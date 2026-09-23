-- Settings page (spec docs/superpowers/specs/2026-09-22-settings-page-design.md §3, §4.8).
-- One row per user, created lazily on first write; reads fall back to defaults.
create table user_preferences (
  user_id uuid primary key references users (id) on delete cascade,
  learning_schedule text not null default 'every_day'
    check (learning_schedule in ('every_day', 'weekdays', 'custom')),
  schedule_days smallint[] not null default '{1,2,3,4,5,6,7}',
  review_frequency text not null default 'normal'
    check (review_frequency in ('normal', 'more', 'relaxed')),
  difficulty text not null default 'adaptive'
    check (difficulty in ('adaptive', 'easy', 'challenge')),
  display_scale text not null default 'normal'
    check (display_scale in ('normal', 'large', 'extra_large')),
  reduce_motion boolean not null default false,
  microphone_enabled boolean not null default true,
  camera_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  -- Range and non-empty. Uniqueness/order are normalised by zod before the
  -- write (a CHECK on array uniqueness is not practical, spec §3).
  constraint user_preferences_schedule_days_range check (
    cardinality(schedule_days) between 1 and 7
    and schedule_days <@ '{1,2,3,4,5,6,7}'::smallint[]
  ),
  constraint user_preferences_schedule_days_canonical check (
    (learning_schedule = 'every_day' and schedule_days = '{1,2,3,4,5,6,7}'::smallint[])
    or (learning_schedule = 'weekdays' and schedule_days = '{1,2,3,4,5}'::smallint[])
    or learning_schedule = 'custom'
  )
);

alter table user_preferences enable row level security;

create policy user_preferences_select_own on user_preferences
  for select to authenticated using (user_id = auth.uid());
create policy user_preferences_insert_own on user_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy user_preferences_update_own on user_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No delete grant: the row goes with the account through the users cascade.
grant select, insert, update on user_preferences to authenticated;
revoke delete on user_preferences from authenticated;
grant all on user_preferences to service_role;

-- Erase Korume Memory (spec §4.8): companion memories and conversation
-- memories, together, for the caller only. SECURITY INVOKER: the existing
-- owner-only delete policies on both tables are what scope it.
create function erase_companion_memory() returns void
  language sql
  security invoker
  set search_path = public
as $$
  delete from companion_memories where user_id = auth.uid();
  delete from conversation_sessions where user_id = auth.uid();
$$;

revoke all on function erase_companion_memory() from public;
grant execute on function erase_companion_memory() to authenticated;
