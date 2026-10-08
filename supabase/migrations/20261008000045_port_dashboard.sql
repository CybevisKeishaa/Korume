-- port-dashboard (spec 2026-10-08). New objects only; changed objects are edited in their defining migrations.

-- C3 curriculum sync: authoritative replacement of all five curriculum collections.
create function sync_curriculum_manifest(p_manifest jsonb) returns table (level jlpt_level, members int)
  language plpgsql security definer set search_path = public
as $$
declare v_level jlpt_level; v_collection uuid; v_ids uuid[]; v_bad text;
begin
  if p_manifest is null or jsonb_typeof(p_manifest) <> 'object' then
    raise exception 'sync_curriculum_manifest: manifest must be an object';  -- a NULL would wipe all five levels
  end if;
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

-- C4 journey: FREE members are core progression; PLUS members are supplemental and never change progression.
create function curriculum_journey() returns table (
  level jlpt_level, collection_title text, core_total int, core_completed int,
  next_video_id uuid, next_title text, next_position int, plus_total int, plus_accessible int)
  language sql stable security invoker set search_path = public
as $$
  with members as (
    select c.curriculum_level as lvl, c.title as ctitle, lc.position as pos, v.id as vid, v.title as vtitle,
      v.library_access as access, (p.completed_at is not null) as done
    from collections c
    left join lesson_collections lc on lc.collection_id = c.id and lc.position > 0
    left join videos v on v.id = lc.lesson_id
    left join user_video_progress p on p.video_id = v.id and p.user_id = auth.uid()
    where c.kind = 'curriculum'
  )
  select lvl, min(ctitle),
    (count(*) filter (where access = 'FREE'))::int,
    (count(*) filter (where access = 'FREE' and done))::int,
    (array_agg(vid order by pos) filter (where access = 'FREE' and not done))[1],
    (array_agg(vtitle order by pos) filter (where access = 'FREE' and not done))[1],
    (array_agg(pos order by pos) filter (where access = 'FREE' and not done))[1],
    (count(*) filter (where access = 'PLUS'))::int,
    (count(*) filter (where access = 'PLUS' and can_open_lesson(vid, auth.uid())))::int
  from members group by lvl order by lvl;
$$;
revoke execute on function curriculum_journey() from public, anon;
grant execute on function curriculum_journey() to authenticated;

-- D5: collection title and lesson position come only from curriculum membership.
create function curriculum_membership(p_video_id uuid) returns table (collection_title text, lesson_position int)
  language sql stable security invoker set search_path = public
as $$
  select c.title, lc.position from lesson_collections lc join collections c on c.id = lc.collection_id
  where lc.lesson_id = p_video_id and c.kind = 'curriculum' and lc.position > 0 limit 1;
$$;
revoke execute on function curriculum_membership(uuid) from public, anon;
grant execute on function curriculum_membership(uuid) to authenticated;
