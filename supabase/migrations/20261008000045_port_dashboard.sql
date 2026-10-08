-- port-dashboard (spec 2026-10-08). New objects only; changed objects are edited in their defining migrations.

-- C3 curriculum sync: authoritative replacement of all five curriculum collections.
create function sync_curriculum_manifest(p_manifest jsonb) returns table (level jlpt_level, members int)
  language plpgsql security definer set search_path = public
as $$
declare v_level jlpt_level; v_collection uuid; v_ids uuid[]; v_bad text;
begin
  if exists (select 1 from jsonb_object_keys(p_manifest) k where k not in ('N5', 'N4', 'N3', 'N2', 'N1')) then
    raise exception 'sync_curriculum_manifest: unknown level key';
  end if;
  for v_level in select unnest(enum_range(null::jlpt_level)) loop
    select c.id into v_collection from collections c where c.kind = 'curriculum' and c.curriculum_level = v_level;
    if v_collection is null then raise exception 'sync_curriculum_manifest: no curriculum collection for %', v_level; end if;
    v_ids := array(select e.value::uuid from jsonb_array_elements_text(coalesce(p_manifest -> v_level::text, '[]'::jsonb)) with ordinality as e(value, ord) order by e.ord);
    if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then raise exception 'sync_curriculum_manifest: duplicate lesson in %', v_level; end if;
    if (select count(*) from videos where id = any (v_ids)) <> cardinality(v_ids) then raise exception 'sync_curriculum_manifest: unknown video in %', v_level; end if;
    select v.youtube_video_id into v_bad from videos v where v.id = any (v_ids) and v.library_access = 'PRIVATE' limit 1;
    if v_bad is not null then raise exception 'sync_curriculum_manifest: PRIVATE video % cannot be curriculum', v_bad; end if;
    delete from lesson_collections lc where lc.collection_id = v_collection and not (lc.lesson_id = any (v_ids));
    insert into lesson_collections (lesson_id, collection_id, position)
      select e.id, v_collection, e.ord::int from unnest(v_ids) with ordinality as e(id, ord)
      on conflict (lesson_id, collection_id) do update set position = excluded.position;
    level := v_level; members := cardinality(v_ids); return next;
  end loop;
  if exists (select lc.lesson_id from lesson_collections lc join collections c on c.id = lc.collection_id where c.kind = 'curriculum' group by lc.lesson_id having count(*) > 1) then
    raise exception 'sync_curriculum_manifest: a lesson is in two curricula';
  end if;
end $$;
revoke execute on function sync_curriculum_manifest(jsonb) from public, anon, authenticated;
grant execute on function sync_curriculum_manifest(jsonb) to service_role;

