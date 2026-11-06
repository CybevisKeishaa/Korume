-- A freshly bulk-loaded snapshot has no planner statistics; the dangling-words anti-join in
-- dict_activate_snapshot then times out under PostgREST. Analyze the staged tables first.
create or replace function dict_activate_snapshot(p_snapshot uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from dict_snapshots where id = p_snapshot for update;
  if v_status is distinct from 'staging' then
    raise exception 'snapshot % is not staging', p_snapshot;
  end if;
  if not exists (select 1 from dict_entries where snapshot_id = p_snapshot)
     or not exists (select 1 from dict_kanji where snapshot_id = p_snapshot)
     or not exists (select 1 from dict_kanji_strokes where snapshot_id = p_snapshot) then
    raise exception 'snapshot % is incomplete', p_snapshot;
  end if;
  analyze dict_entries;
  analyze dict_kanji_words;
  if exists (
    select 1 from dict_kanji_words w
    where w.snapshot_id = p_snapshot
      and not exists (select 1 from dict_entries e where e.snapshot_id = p_snapshot and e.ent_seq = w.ent_seq)
  ) then
    raise exception 'snapshot % has dangling kanji words', p_snapshot;
  end if;
  update dict_snapshots set status = 'retired' where status = 'active';
  update dict_snapshots set status = 'active', activated_at = now() where id = p_snapshot;
end $$;

revoke all on function dict_activate_snapshot(uuid) from public, anon, authenticated;
grant execute on function dict_activate_snapshot(uuid) to service_role;
