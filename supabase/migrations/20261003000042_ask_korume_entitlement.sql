-- Persist a Korume answer and settle its reservation in one transaction.
create function korume_complete_turn(p_session uuid, p_turn uuid, p_reservation uuid, p_generation uuid,
  p_credits int, p_usd numeric, p_content text, p_content_json jsonb, p_grounding_json jsonb, p_title text)
returns table (message_id uuid, charged boolean)
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_charged boolean;
begin
  insert into conversation_messages (session_id, role, content, content_json, content_schema_version,
    grounding_json, grounding_schema_version, turn_id)
  values (p_session, 'ai', p_content, p_content_json, 1, p_grounding_json, 1, p_turn)
  on conflict (session_id, turn_id, role) where turn_id is not null do nothing
  returning id into v_id;
  if v_id is null then
    select m.id into v_id from conversation_messages m
      where m.session_id = p_session and m.turn_id = p_turn and m.role = 'ai';
    return query select v_id, false;
    return;
  end if;
  v_charged := ai_settle(p_reservation, p_generation, p_credits, p_usd);
  update conversation_sessions
    set updated_at = now(), title = coalesce(title, p_title)
    where id = p_session and kind = 'ask_korume';
  return query select v_id, v_charged;
end $$;
revoke all on function korume_complete_turn(uuid, uuid, uuid, uuid, int, numeric, text, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function korume_complete_turn(uuid, uuid, uuid, uuid, int, numeric, text, jsonb, jsonb, text) to service_role;
