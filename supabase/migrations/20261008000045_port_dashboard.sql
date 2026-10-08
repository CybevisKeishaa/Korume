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
  where lc.lesson_id = p_video_id and c.kind = 'curriculum' and lc.position > 0
  order by c.curriculum_level limit 1;  -- sync keeps a lesson in one curriculum; the order makes any slip deterministic
$$;
revoke execute on function curriculum_membership(uuid) from public, anon;
grant execute on function curriculum_membership(uuid) to authenticated;

-- S3 lexical mastery: one lexical key, one dedupe, two time predicates. Group FIRST, then filter the window, so a word
-- mastered last month in one source and again this week in another is not "new" twice. Mining source_ref is already
-- normalizeRef(surface); vocab.lexical_key is the same identity computed in SQL (parity tested). Homographs merge.
create function mastered_lexemes(p_mastery int)
  returns table (lexical_key text, first_mastered_at timestamptz, currently_mastered boolean)
  language sql stable security invoker set search_path = public
as $$
  with items as (
    select v.lexical_key as k, p.mastered_at as at, p.srs_stage >= p_mastery as cur
    from user_vocab_progress p join vocab v on v.id = p.vocab_id
    where p.user_id = auth.uid()
    union all
    select c.source_ref, c.mastered_at, c.srs_stage >= p_mastery
    from sentence_mining_cards c
    where c.user_id = auth.uid() and c.source_kind in ('selection', 'vocabulary', 'expression') and c.source_ref is not null
  )
  select k, min(at), bool_or(cur) from items where k <> '' group by k;
$$;
create function current_mastered_count(p_mastery int) returns int
  language sql stable security invoker set search_path = public
as $$ select count(*)::int from mastered_lexemes(p_mastery) where currently_mastered $$;
create function newly_mastered_count(p_mastery int, p_from timestamptz, p_to timestamptz) returns int
  language sql stable security invoker set search_path = public
as $$ select count(*)::int from mastered_lexemes(p_mastery) where first_mastered_at >= p_from and first_mastered_at < p_to $$;
revoke execute on function mastered_lexemes(int) from public, anon;
revoke execute on function current_mastered_count(int) from public, anon;
revoke execute on function newly_mastered_count(int, timestamptz, timestamptz) from public, anon;
grant execute on function mastered_lexemes(int) to authenticated;
grant execute on function current_mastered_count(int) to authenticated;
grant execute on function newly_mastered_count(int, timestamptz, timestamptz) to authenticated;

-- D12 review surfaces (plan P2): one definition of "due" per deck, matching the review queues. Kanji: a progress row
-- whose next_review_at is null or past (never-seen curated kanji are new material, not due). Mining: any card whose
-- next_review_at is null or past, reviewed or not. Keys use the learning_outcomes.item_key format of each source
-- (srs_review = '<itemType>:<id>', mining_review = the card id), so a mission can match outcomes to frozen keys.
create function review_due_keys(p_user uuid, p_decks text[], p_at timestamptz)
  returns table (deck text, item_key text)
  language sql stable security invoker set search_path = public
as $$
  select 'kanji', 'kanji:' || k.kanji_id from user_kanji_progress k
  where k.user_id = p_user and 'kanji' = any (p_decks) and (k.next_review_at is null or k.next_review_at <= p_at)
  union all
  select 'vocab', 'vocab:' || v.vocab_id from user_vocab_progress v
  where v.user_id = p_user and 'vocab' = any (p_decks) and (v.next_review_at is null or v.next_review_at <= p_at)
  union all
  select 'mining', m.id::text from sentence_mining_cards m
  where m.user_id = p_user and 'mining' = any (p_decks) and (m.next_review_at is null or m.next_review_at <= p_at);
$$;
revoke execute on function review_due_keys(uuid, text[], timestamptz) from public, anon;
grant execute on function review_due_keys(uuid, text[], timestamptz) to authenticated, service_role;

create function review_deck_summary(p_decks text[]) returns table (deck text, due int, last_reviewed_at timestamptz)
  language sql stable security invoker set search_path = public
as $$
  select d.deck,
    (select count(*)::int from review_due_keys(auth.uid(), array[d.deck], now())),
    case d.deck
      when 'kanji' then (select max(last_reviewed_at) from user_kanji_progress where user_id = auth.uid())
      when 'vocab' then (select max(last_reviewed_at) from user_vocab_progress where user_id = auth.uid())
      else (select max(last_reviewed_at) from sentence_mining_cards where user_id = auth.uid())
    end
  from unnest(p_decks) as d(deck);
$$;
revoke execute on function review_deck_summary(text[]) from public, anon;
grant execute on function review_deck_summary(text[]) to authenticated;
