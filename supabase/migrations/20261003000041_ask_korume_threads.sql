-- Ask Korume threads reuse the conversation tables behind a kind discriminator.

alter table conversation_sessions
  add column kind text not null default 'scenario',
  add column origin_video_id uuid references videos (id) on delete set null,
  add column origin_line_id uuid references transcript_lines (id) on delete set null,
  add column origin_span jsonb,
  add column origin_route text,
  add column title text,
  add column updated_at timestamptz not null default now();

alter table conversation_sessions
  add constraint conversation_sessions_kind check (kind in ('scenario', 'ask_korume')),
  add constraint conversation_sessions_kind_shape check (
    (kind = 'scenario' and origin_video_id is null and origin_line_id is null and origin_span is null
      and origin_route is null and title is null)
    or (kind = 'ask_korume' and scenario_type is null)),
  add constraint conversation_sessions_span_needs_line check (origin_span is null or origin_line_id is not null),
  add constraint conversation_sessions_line_needs_video check (origin_line_id is null or origin_video_id is not null),
  add constraint conversation_sessions_span_shape check (origin_span is null or coalesce((
    jsonb_typeof(origin_span) = 'object'
    and jsonb_typeof(origin_span->'start') = 'number' and jsonb_typeof(origin_span->'end') = 'number'
    and (origin_span - 'start' - 'end') = '{}'::jsonb
    and (origin_span->>'start')::numeric = floor((origin_span->>'start')::numeric)
    and (origin_span->>'end')::numeric = floor((origin_span->>'end')::numeric)
    and (origin_span->>'start')::int >= 0 and (origin_span->>'end')::int > (origin_span->>'start')::int
  ), false)),
  add constraint conversation_sessions_route_shape check (origin_route is null or (
    origin_route like '/%' and origin_route not like '//%' and position(':' in origin_route) = 0));

create index conversation_sessions_user_kind_updated on conversation_sessions (user_id, kind, updated_at desc);

alter table conversation_messages
  add column content_json jsonb,
  add column content_schema_version smallint,
  add column grounding_json jsonb,
  add column grounding_schema_version smallint,
  add column turn_id uuid;

alter table conversation_messages
  add constraint conversation_messages_content_version check ((content_json is null) = (content_schema_version is null)),
  add constraint conversation_messages_grounding_version check ((grounding_json is null) = (grounding_schema_version is null)),
  add constraint conversation_messages_user_plain check (role <> 'user' or (content_json is null and grounding_json is null));

create unique index conversation_messages_turn_role on conversation_messages (session_id, turn_id, role) where turn_id is not null;

-- Existing owner policies allow all scenario writes. Restrict direct Ask Korume writes to the service role;
-- learner deletion of a thread remains available for erase_companion_memory().
create policy korume_sessions_insert on conversation_sessions as restrictive for insert to authenticated
  with check (kind = 'scenario');
create policy korume_sessions_update on conversation_sessions as restrictive for update to authenticated
  using (kind = 'scenario') with check (kind = 'scenario');
create policy korume_messages_insert on conversation_messages as restrictive for insert to authenticated
  with check (exists (select 1 from conversation_sessions s where s.id = session_id and s.kind = 'scenario'));
create policy korume_messages_update on conversation_messages as restrictive for update to authenticated
  using (exists (select 1 from conversation_sessions s where s.id = session_id and s.kind = 'scenario'))
  with check (exists (select 1 from conversation_sessions s where s.id = session_id and s.kind = 'scenario'));
create policy korume_messages_delete on conversation_messages as restrictive for delete to authenticated
  using (exists (select 1 from conversation_sessions s where s.id = session_id and s.kind = 'scenario'));

-- Clear dependent anchor fields before the source FK's ON DELETE action runs.
create function korume_clear_line_anchor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversation_sessions set origin_line_id = null, origin_span = null where origin_line_id = old.id;
  return old;
end $$;

create function korume_clear_video_anchor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversation_sessions
    set origin_video_id = null, origin_line_id = null, origin_span = null, origin_route = null
    where origin_video_id = old.id;
  return old;
end $$;

create trigger korume_clear_line_anchor before delete on transcript_lines for each row execute function korume_clear_line_anchor();
create trigger korume_clear_video_anchor before delete on videos for each row execute function korume_clear_video_anchor();
revoke all on function korume_clear_line_anchor() from public, anon, authenticated;
revoke all on function korume_clear_video_anchor() from public, anon, authenticated;
