\set ON_ERROR_STOP on

-- Live gate for the versioned dictionary snapshots (spec 2026-10-02 part 1b §4.1, §7).
-- Gate rows carry source_version 'dictgate-*' and are removed at the start and the end.
-- It assumes no real snapshot is active; with one active, the gate parks it and restores it last. Parked as
-- 'staging', never 'retired': step 6 runs dict_gc_snapshots(0), which deletes every retired snapshot and would
-- take the real dictionary with it.
-- Real snapshots already retired are kept out of step 6's reach the same way.
-- The parked statuses live in a real table, not a temp one: a failing step stops psql before the restore at the
-- end, and the next run must still be able to put the real dictionary back (it does so first).

delete from dict_snapshots where jmdict_import_id in (select id from dict_imports where source_version like 'dictgate-%');
delete from dict_imports where source_version like 'dictgate-%';

create table if not exists public.dictgate_parked (id uuid primary key, status text not null);
revoke all on public.dictgate_parked from public, anon, authenticated;
update dict_snapshots s set status = p.status from public.dictgate_parked p where s.id = p.id;
delete from public.dictgate_parked;
insert into public.dictgate_parked select id, status from dict_snapshots where status in ('active', 'retired');
update dict_snapshots set status = 'staging' where id in (select id from public.dictgate_parked);

create or replace function pg_temp.dictgate_snapshot(p_name text, p_gloss text, p_strokes boolean, p_dangling boolean)
returns uuid language plpgsql as $$
declare j uuid; k uuid; v uuid; s uuid;
begin
  insert into dict_imports (source, source_version, source_url, license, file_sha256, entry_count)
    values ('jmdict', 'dictgate-' || p_name, 'https://example.invalid/j', 'test', p_name || '-j', 2) returning id into j;
  insert into dict_imports (source, source_version, source_url, license, file_sha256, entry_count)
    values ('kanjidic2', 'dictgate-' || p_name, 'https://example.invalid/k', 'test', p_name || '-k', 1) returning id into k;
  insert into dict_imports (source, source_version, source_url, license, file_sha256, entry_count)
    values ('kanjivg', 'dictgate-' || p_name, 'https://example.invalid/v', 'test', p_name || '-v', 1) returning id into v;
  s := dict_stage_snapshot(j, k, v);
  insert into dict_entries (snapshot_id, ent_seq, kanji_forms, kana_forms, senses, common)
    values (s, 1, '{緑}', '{みどり}', jsonb_build_array(jsonb_build_object('pos', '["n"]'::jsonb, 'gloss', jsonb_build_array(p_gloss), 'misc', '[]'::jsonb)), true),
           (s, 2, '{苦手}', '{にがて}', '[{"pos":["adj-na"],"gloss":["weak point"],"misc":[]}]'::jsonb, true);
  insert into dict_kanji (snapshot_id, literal, on_readings, kun_readings, meanings_en, stroke_count)
    values (s, '緑', '{リョク}', '{みどり}', '{green}', 14);
  if p_strokes then
    insert into dict_kanji_strokes (snapshot_id, literal, paths, components)
      values (s, '緑', '["M1,1L2,2"]'::jsonb, '{"element":"緑","position":null,"children":[]}'::jsonb);
  end if;
  insert into dict_kanji_words (snapshot_id, literal, ent_seq, rank) values (s, '緑', case when p_dangling then 999 else 1 end, 1);
  return s;
end $$;

select pg_temp.dictgate_snapshot('a', 'green A', true, false) as snap_a \gset
select dict_activate_snapshot(:'snap_a');

-- 1. Activating B makes B the only readable snapshot and retires A.
select pg_temp.dictgate_snapshot('b', 'green B', true, false) as snap_b \gset
select dict_activate_snapshot(:'snap_b');
select set_config('dictgate.a', :'snap_a', false), set_config('dictgate.b', :'snap_b', false);
do $$
begin
  if dict_active_snapshot_id() is distinct from current_setting('dictgate.b')::uuid then
    raise exception 'FAIL 1: active snapshot is not B';
  end if;
  if exists (select 1 from dict_entries where snapshot_id = dict_active_snapshot_id() and senses::text like '%green A%') then
    raise exception 'FAIL 1: reads of the active snapshot still see A';
  end if;
  if (select status from dict_snapshots where id = current_setting('dictgate.a')::uuid) <> 'retired' then
    raise exception 'FAIL 1: A is not retired';
  end if;
  raise notice 'PASS 1 activating B retires A and reads see only B';
end $$;

-- 2. A snapshot without stroke geometry is refused and B stays the only active snapshot.
select pg_temp.dictgate_snapshot('c', 'green C', false, false) as snap_c \gset
select set_config('dictgate.c', :'snap_c', false);
do $$
begin
  begin
    perform dict_activate_snapshot(current_setting('dictgate.c')::uuid);
    raise exception 'FAIL 2: incomplete snapshot activated';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  if (select count(*) from dict_snapshots where status = 'active') <> 1
     or dict_active_snapshot_id() is distinct from current_setting('dictgate.b')::uuid then
    raise exception 'FAIL 2: active snapshot changed after a refused activation';
  end if;
  raise notice 'PASS 2 incomplete snapshot refused, B still the one active';
end $$;

-- 3. A kanji word pointing at a missing entry is refused.
select pg_temp.dictgate_snapshot('d', 'green D', true, true) as snap_d \gset
select set_config('dictgate.d', :'snap_d', false);
do $$
begin
  begin
    perform dict_activate_snapshot(current_setting('dictgate.d')::uuid);
    raise exception 'FAIL 3: dangling snapshot activated';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  if dict_active_snapshot_id() is distinct from current_setting('dictgate.b')::uuid then
    raise exception 'FAIL 3: active snapshot changed';
  end if;
  raise notice 'PASS 3 dangling kanji words refused';
end $$;

-- 4. Rolling back to A re-activates A and retires B.
select dict_rollback_snapshot(:'snap_a');
do $$
begin
  if dict_active_snapshot_id() is distinct from current_setting('dictgate.a')::uuid
     or (select status from dict_snapshots where id = current_setting('dictgate.b')::uuid) <> 'retired' then
    raise exception 'FAIL 4: rollback did not swap A and B';
  end if;
  raise notice 'PASS 4 rollback re-activates A';
end $$;

-- 5. The partial unique index refuses a second active row.
do $$
begin
  begin
    update dict_snapshots set status = 'active' where id = current_setting('dictgate.b')::uuid;
    raise exception 'FAIL 5: second active snapshot accepted';
  exception when unique_violation then null;
  end;
  raise notice 'PASS 5 a second active snapshot raises unique_violation';
end $$;

-- 6. GC with keep 0 deletes retired snapshots and their rows only.
do $$
declare v_deleted int;
begin
  v_deleted := dict_gc_snapshots(0);
  if v_deleted < 1 then raise exception 'FAIL 6: GC deleted nothing'; end if;
  if exists (select 1 from dict_snapshots where status = 'retired') then
    raise exception 'FAIL 6: retired snapshots survived GC';
  end if;
  if exists (select 1 from dict_entries where snapshot_id = current_setting('dictgate.b')::uuid) then
    raise exception 'FAIL 6: rows of a deleted snapshot survived';
  end if;
  if dict_active_snapshot_id() is distinct from current_setting('dictgate.a')::uuid
     or not exists (select 1 from dict_entries where snapshot_id = current_setting('dictgate.a')::uuid) then
    raise exception 'FAIL 6: GC touched the active snapshot';
  end if;
  if not exists (select 1 from dict_snapshots where id = current_setting('dictgate.c')::uuid and status = 'staging') then
    raise exception 'FAIL 6: GC deleted a staging snapshot';
  end if;
  raise notice 'PASS 6 GC deletes only retired snapshots';
end $$;

-- 7. authenticated reads, but cannot write or administer.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
do $$
begin
  if not exists (select 1 from dict_entries where snapshot_id = dict_active_snapshot_id()) then
    raise exception 'FAIL 7: authenticated cannot read the active snapshot';
  end if;
  begin
    insert into dict_entries (snapshot_id, ent_seq, kana_forms, senses)
      values (dict_active_snapshot_id(), 3, '{て}', '[]'::jsonb);
    raise exception 'FAIL 7: authenticated inserted a dictionary row';
  exception when insufficient_privilege then null;
  end;
  begin
    perform dict_activate_snapshot(current_setting('dictgate.c')::uuid);
    raise exception 'FAIL 7: authenticated executed dict_activate_snapshot';
  exception when insufficient_privilege then null;
  end;
  begin
    perform dict_gc_snapshots(0);
    raise exception 'FAIL 7: authenticated executed dict_gc_snapshots';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 7 authenticated is read-only';
end $$;
commit;

-- 8. anon sees nothing.
begin;
set local role anon;
do $$
begin
  begin
    perform 1 from dict_entries limit 1;
    raise exception 'FAIL 8: anon read dict_entries';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 8 anon cannot read the dictionary';
end $$;
commit;

-- Cleanup, then restore every real snapshot to the status it had before the gate.
delete from dict_snapshots where jmdict_import_id in (select id from dict_imports where source_version like 'dictgate-%');
delete from dict_imports where source_version like 'dictgate-%';
update dict_snapshots s set status = p.status from public.dictgate_parked p where s.id = p.id;
drop table public.dictgate_parked;
