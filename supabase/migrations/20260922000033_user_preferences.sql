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
  -- Ask Korume (spec 2026-10-03 §3.5): the server gate reads this; off hides Korume and refuses its API.
  companion_enabled boolean not null default true,
  pronunciation_sort text not null default 'recommended'
    check (pronunciation_sort in ('recommended', 'newest', 'shortest', 'in_progress')),
  pronunciation_duration text
    check (pronunciation_duration in ('under_10', '10_30', 'over_30')),
  pronunciation_hide_completed boolean not null default false,
  reading_furigana text not null default 'adaptive' check (reading_furigana in ('always', 'adaptive', 'hidden')),
  reading_translation text not null default 'always' check (reading_translation in ('hidden', 'reveal', 'always')),
  reading_jp_font text not null default 'gothic' check (reading_jp_font in ('gothic', 'mincho')),
  reading_text_size text not null default 'm' check (reading_text_size in ('s', 'm', 'l', 'xl')),
  reading_line_height text not null default 'comfortable' check (reading_line_height in ('compact', 'comfortable', 'airy')),
  reading_width text not null default 'normal' check (reading_width in ('narrow', 'normal', 'wide')),
  reading_emphasis text not null default 'soft' check (reading_emphasis in ('minimal', 'soft', 'strong')),
  reading_color_preset text not null default 'warm_cream'
    check (reading_color_preset in ('warm_cream', 'night', 'sepia', 'high_contrast')),
  playback_default_rate numeric(3, 2) not null default 1
    check (playback_default_rate in (0.5, 0.75, 1, 1.25, 1.5, 1.75, 2)),
  playback_loop_count smallint not null default 1 check (playback_loop_count in (1, 3, 5, 0)),
  playback_auto_pause boolean not null default false,
  show_shortcut_hints boolean not null default false,
  resume_behavior text not null default 'resume' check (resume_behavior in ('resume', 'restart')),
  study_atmosphere text not null default 'none' check (study_atmosphere in
    ('none', 'evening_study', 'coffee_shop', 'rainy_day', 'quiet_library', 'spring_morning', 'summer_night')),
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
