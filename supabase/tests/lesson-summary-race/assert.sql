\set ON_ERROR_STOP on
create or replace function pg_temp.race_count(p_case text, p_outcome text) returns int language sql as $$
  select count(*)::int from summary_race_results where case_name = p_case and outcome = p_outcome
$$;

do $$
declare v_first uuid; v_entry uuid; second record; third record;
begin
  if pg_temp.race_count('r', 'leader') <> 1 or pg_temp.race_count('r', 'follower') <> 19 then
    raise exception 'FAIL race r: % leaders, % followers', pg_temp.race_count('r', 'leader'), pg_temp.race_count('r', 'follower');
  end if;
  raise notice 'PASS race r: 20 concurrent reflection claims, exactly one leader';
  if pg_temp.race_count('a', 'leader') <> 1 or pg_temp.race_count('a', 'follower') <> 19 then
    raise exception 'FAIL race a: % leaders, % followers', pg_temp.race_count('a', 'leader'), pg_temp.race_count('a', 'follower');
  end if;
  raise notice 'PASS race a: 20 concurrent lesson_analysis claims, exactly one leader';
  if (select count(*) from sentence_mining_cards where user_id = '5ca1ab1e-0000-4000-8000-00000000000c'
        and transcript_line_id = '5ca1ab1e-0000-4000-8000-0000000000d5' and source_kind = 'sentence') <> 1 then
    raise exception 'FAIL race review: % sentence cards after 20 concurrent Review Tomorrow calls',
      (select count(*) from sentence_mining_cards where user_id = '5ca1ab1e-0000-4000-8000-00000000000c');
  end if;
  raise notice 'PASS race review: 20 concurrent Review Tomorrow calls, one sentence card';

  -- Phase 2: the round-1 leader's lease expires; the next claim takes over with a new token, the one after follows,
  -- and the round-1 token can no longer complete.
  select token into v_first from summary_race_results where case_name = 'r' and outcome = 'leader';
  select id into v_entry from lesson_reflections where analysis_fingerprint = 'sgate-race-r';
  update lesson_reflections set lease_until = now() - interval '1 second' where id = v_entry;
  select * into second from reflection_claim_lease('5ca1ab1e-0000-4000-8000-00000000000c',
    '{"videoId":"5ca1ab1e-0000-4000-8000-0000000000f3","locale":"vi","analysisFingerprint":"sgate-race-r","evidenceFingerprint":"sgate-race-e","schemaVersion":1,"generatorVersion":1}'::jsonb, 60);
  select * into third from reflection_claim_lease('5ca1ab1e-0000-4000-8000-00000000000c',
    '{"videoId":"5ca1ab1e-0000-4000-8000-0000000000f3","locale":"vi","analysisFingerprint":"sgate-race-r","evidenceFingerprint":"sgate-race-e","schemaVersion":1,"generatorVersion":1}'::jsonb, 60);
  if second.outcome <> 'leader' or second.lease_token = v_first or third.outcome <> 'follower' then
    raise exception 'FAIL race r2: takeover gave % (token reused: %) then %', second.outcome, second.lease_token = v_first, third.outcome;
  end if;
  if reflection_complete(v_entry, v_first, '{"by":"stale"}', 'm', 'p') then
    raise exception 'FAIL race r2: the round-1 token completed after a takeover';
  end if;
  raise notice 'PASS race r2: expired lease taken over once, stale token refused';
end $$;

drop table public.summary_race_results;
delete from lesson_reflections where analysis_fingerprint like 'sgate-race-%';
delete from knowledge_entries where fingerprint like 'sgate-race-%';
delete from videos where youtube_video_id like 'summarygate-race%';
delete from auth.users where email like 'summarygate-race%@example.invalid';
