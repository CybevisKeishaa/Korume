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
  -- A key that is currently mastered on a row with no timestamp was mastered before tracking: its first mastery is
  -- unknown, so it is never "new" (a re-mined word cannot count twice, spec S3).
  select k, case when bool_or(at is null and cur) then null else min(at) end, bool_or(cur)
  from items where k <> '' group by k;
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
      when 'mining' then (select max(last_reviewed_at) from sentence_mining_cards where user_id = auth.uid())
    end
  from unnest(p_decks) as d(deck);
$$;
revoke execute on function review_deck_summary(text[]) from public, anon;
grant execute on function review_deck_summary(text[]) to authenticated;


-- S4 daily missions: one cycle per study-day window; identity is the cycle id, study_date is display metadata.
create table daily_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  study_date date not null,              -- display metadata, never identity
  timezone_at_creation text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,              -- first transition to all-complete
  rewarded_at timestamptz,               -- written only when the XP award committed
  check (window_start < window_end),
  unique (user_id, window_start, window_end)
);
create index idx_daily_missions_user_window on daily_missions (user_id, window_end desc);

create table daily_mission_items (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references daily_missions (id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  type text not null check (type in ('review', 'finish_lesson', 'shadow_lines', 'dictation_lines')),
  video_id uuid references videos (id) on delete cascade,
  target int not null check (target > 0),
  check ((type = 'review') = (video_id is null)),
  unique (mission_id, slot),
  unique (mission_id, type)
);

-- The frozen identities a count-based item may count: review item_keys and practice line ids (spec S4).
create table daily_mission_eligible (
  mission_item_id uuid not null references daily_mission_items (id) on delete cascade,
  item_key text not null check (length(item_key) between 1 and 128),
  primary key (mission_item_id, item_key)
);

alter table daily_missions enable row level security;
alter table daily_mission_items enable row level security;
alter table daily_mission_eligible enable row level security;
create policy daily_missions_select_own on daily_missions for select to authenticated using (user_id = auth.uid());
create policy daily_mission_items_select_own on daily_mission_items for select to authenticated
  using (exists (select 1 from daily_missions m where m.id = mission_id and m.user_id = auth.uid()));
create policy daily_mission_eligible_select_own on daily_mission_eligible for select to authenticated
  using (exists (select 1 from daily_mission_items i join daily_missions m on m.id = i.mission_id
                 where i.id = mission_item_id and m.user_id = auth.uid()));
revoke all on daily_missions, daily_mission_items, daily_mission_eligible from anon, authenticated;
grant select on daily_missions, daily_mission_items, daily_mission_eligible to authenticated;
grant all on daily_missions, daily_mission_items, daily_mission_eligible to service_role;

-- M2 creation
-- P7: the transcript a lesson shows is its newest (getTranscript orders created_at desc).
create function current_transcript_id(p_video_id uuid) returns uuid
  language sql stable security invoker set search_path = public
as $$ select t.id from transcripts t where t.video_id = p_video_id order by t.created_at desc, t.id desc limit 1 $$;
revoke execute on function current_transcript_id(uuid) from public, anon;
grant execute on function current_transcript_id(uuid) to authenticated, service_role;

-- M2: hints are ranked by TS; this function is the authority. It resolves the zone itself, finds the active cycle
-- by instant, revalidates every hint, recomputes every target from real rows and freezes eligible keys — all under
-- the per-user XP lock. Inserts nothing when no slot qualifies (onboarding).
create function ensure_daily_mission(p_user uuid, p_review_decks text[], p_targets jsonb, p_hints jsonb)
  returns uuid
  language plpgsql security definer set search_path = public
as $$
declare
  v_now timestamptz := now(); v_tz text; v_local date; v_start timestamptz; v_end timestamptz;
  v_id uuid; v_item uuid; v_slot int := 0; v_count int; v_hint jsonb; v_type text; v_video uuid;
  v_target int; v_transcript uuid; v_types text[] := '{}';
begin
  perform pg_advisory_xact_lock(hashtext('xp:' || p_user::text));
  select id into v_id from daily_missions where user_id = p_user and window_start <= v_now and v_now < window_end;
  if v_id is not null then return v_id; end if;

  select coalesce(u.study_timezone, 'Asia/Ho_Chi_Minh') into v_tz from users u where u.id = p_user;
  if v_tz is null then raise exception 'ensure_daily_mission: unknown user'; end if;
  if not exists (select 1 from pg_timezone_names where name = v_tz) then v_tz := 'Asia/Ho_Chi_Minh'; end if;
  v_local := (v_now at time zone v_tz)::date;
  v_end := (v_local + 1)::timestamp at time zone v_tz;
  v_start := greatest(v_local::timestamp at time zone v_tz,
                      coalesce((select max(window_end) from daily_missions where user_id = p_user), '-infinity'));
  if v_start >= v_end then return null; end if;

  insert into daily_missions (user_id, study_date, timezone_at_creation, window_start, window_end)
    values (p_user, v_local, v_tz, v_start, v_end) returning id into v_id;

  select count(*) into v_count from review_due_keys(p_user, p_review_decks, v_now);
  if v_count > 0 then
    v_slot := 1;
    insert into daily_mission_items (mission_id, slot, type, target)
      values (v_id, v_slot, 'review', least((p_targets ->> 'review')::int, v_count)) returning id into v_item;
    insert into daily_mission_eligible (mission_item_id, item_key)
      select v_item, k.item_key from review_due_keys(p_user, p_review_decks, v_now) k;
    v_types := array['review'];
  end if;

  for v_hint in select value from jsonb_array_elements(coalesce(p_hints, '[]'::jsonb)) loop
    exit when v_slot >= 3;
    v_type := v_hint ->> 'type';
    v_video := nullif(v_hint ->> 'videoId', '')::uuid;
    continue when v_type is null or v_type = any (v_types)
      or v_type not in ('finish_lesson', 'shadow_lines', 'dictation_lines');
    continue when v_video is null or not can_open_lesson(v_video, p_user);
    v_transcript := current_transcript_id(v_video);
    continue when v_transcript is null;
    if v_type = 'finish_lesson' then
      continue when not exists (
        select 1 from user_video_progress p where p.user_id = p_user and p.video_id = v_video
          and p.completed_at is null and p.last_watched_position > 0);
      v_target := 1;
    else
      select count(*) into v_count from transcript_lines tl where tl.transcript_id = v_transcript;
      v_target := least((p_targets ->> v_type)::int, v_count);
      continue when v_target <= 0;
    end if;
    v_slot := v_slot + 1;
    insert into daily_mission_items (mission_id, slot, type, video_id, target)
      values (v_id, v_slot, v_type, v_video, v_target) returning id into v_item;
    if v_type <> 'finish_lesson' then
      insert into daily_mission_eligible (mission_item_id, item_key)
        select v_item, tl.id::text from transcript_lines tl where tl.transcript_id = v_transcript;
    end if;
    v_types := v_types || v_type;
  end loop;

  if v_slot = 0 then
    delete from daily_missions where id = v_id;
    return null;
  end if;
  return v_id;
end $$;
revoke execute on function ensure_daily_mission(uuid, text[], jsonb, jsonb) from public, anon, authenticated;
grant execute on function ensure_daily_mission(uuid, text[], jsonb, jsonb) to service_role;

-- Mission hints: modality activity in the practice window, with the video practised last.
create function practice_activity(p_since timestamptz)
  returns table (type text, outcomes int, last_at timestamptz, last_video_id uuid)
  language sql stable security invoker set search_path = public
as $$
  select 'shadow_lines', count(*)::int, max(created_at),
    (array_agg(video_id order by created_at desc) filter (where video_id is not null))[1]
  from shadowing_sessions where user_id = auth.uid() and created_at >= p_since
  union all
  select 'dictation_lines', count(*)::int, max(created_at),
    (array_agg(video_id order by created_at desc) filter (where video_id is not null))[1]
  from dictation_attempts where user_id = auth.uid() and created_at >= p_since;
$$;
revoke execute on function practice_activity(timestamptz) from public, anon;
grant execute on function practice_activity(timestamptz) to authenticated;


-- M3/M4 progress and claim
-- M3: only outcomes inside [mission.created_at, window_end) count; count-based items count DISTINCT frozen keys.
create function daily_mission_item_progress(p_mission_id uuid)
  returns table (item_id uuid, slot int, type text, video_id uuid, target int, current int)
  language sql stable security invoker set search_path = public
as $$
  select i.id, i.slot::int, i.type, i.video_id, i.target,
    case when i.type = 'finish_lesson' then
      (exists (select 1 from user_video_progress p where p.user_id = m.user_id and p.video_id = i.video_id
         and p.first_completed_at >= m.created_at and p.first_completed_at < m.window_end))::int
    else least(i.target, (
      select count(distinct o.item_key)::int from learning_outcomes o
      join daily_mission_eligible e on e.mission_item_id = i.id and e.item_key = o.item_key
      where o.user_id = m.user_id and o.created_at >= m.created_at and o.created_at < m.window_end
        and o.source_type = any (case i.type when 'review' then array['srs_review', 'mining_review']
                                             when 'shadow_lines' then array['shadowing']
                                             else array['dictation'] end)))
    end
  from daily_missions m join daily_mission_items i on i.mission_id = m.id
  where m.id = p_mission_id order by i.slot;
$$;
revoke execute on function daily_mission_item_progress(uuid) from public, anon;
grant execute on function daily_mission_item_progress(uuid) to authenticated, service_role;

-- M4: one transaction under the XP lock. Never a learning outcome (D11): it cannot light the heatmap or streak.
create function claim_daily_mission(p_user uuid, p_mission_id uuid, p_xp int)
  returns table (completed boolean, xp_awarded int, prev_xp int, next_xp int)
  language plpgsql security definer set search_path = public
as $$
declare v_rewarded timestamptz; v_done boolean; v_prev int;
begin
  if p_xp <= 0 then raise exception 'claim_daily_mission: xp must be positive'; end if;
  perform pg_advisory_xact_lock(hashtext('xp:' || p_user::text));
  select rewarded_at into v_rewarded from daily_missions where id = p_mission_id and user_id = p_user;
  if not found then raise exception 'claim_daily_mission: no such mission for this user'; end if;
  if v_rewarded is not null then return query select true, 0, null::int, null::int; return; end if;
  select bool_and(p.current >= p.target) into v_done from daily_mission_item_progress(p_mission_id) p;
  if not coalesce(v_done, false) then return query select false, 0, null::int, null::int; return; end if;
  update daily_missions set completed_at = coalesce(completed_at, now()) where id = p_mission_id;
  insert into user_stats (user_id) values (p_user) on conflict (user_id) do nothing;
  select xp into v_prev from user_stats where user_id = p_user;
  insert into xp_events (user_id, source_type, source_id, xp)
    values (p_user, 'daily_mission_complete', 'mission:' || p_mission_id::text, p_xp);
  update user_stats set xp = xp + p_xp where user_id = p_user;
  update daily_missions set rewarded_at = now() where id = p_mission_id;
  return query select true, p_xp, v_prev, v_prev + p_xp;
end $$;
revoke execute on function claim_daily_mission(uuid, uuid, int) from public, anon, authenticated;
grant execute on function claim_daily_mission(uuid, uuid, int) to service_role;
