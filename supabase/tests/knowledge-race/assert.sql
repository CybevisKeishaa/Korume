\set ON_ERROR_STOP on
create or replace function pg_temp.race_count(p_case text, p_outcome text) returns int language sql as $$
  select count(*)::int from knowledge_race_results where case_name = p_case and outcome = p_outcome
$$;

do $$
begin
  if (select count(*) from knowledge_race_results) <> 120 then
    raise exception 'FAIL race: % results recorded, expected 120', (select count(*) from knowledge_race_results);
  end if;
  if pg_temp.race_count('a', 'leader') <> 1 or pg_temp.race_count('a', 'follower') <> 19 then
    raise exception 'FAIL race a: % leaders, % followers', pg_temp.race_count('a', 'leader'), pg_temp.race_count('a', 'follower');
  end if;
  raise notice 'PASS race a: 20 concurrent claims, exactly one leader';
  if pg_temp.race_count('b', 'reserved') <> 5 or pg_temp.race_count('b', 'fuse_tripped') <> 15 then
    raise exception 'FAIL race b: % reserved under a fuse of 5', pg_temp.race_count('b', 'reserved');
  end if;
  raise notice 'PASS race b: Plus fuse of 5, exactly 5 reserved';
  if pg_temp.race_count('c', 'reserved') <> 3 or pg_temp.race_count('c', 'credits_exhausted') <> 17 then
    raise exception 'FAIL race c: % reserved under 10 credits at 3 each', pg_temp.race_count('c', 'reserved');
  end if;
  raise notice 'PASS race c: 10 credits at 3 each, exactly 3 reserved';
  if pg_temp.race_count('d', 'reserved') <> 3 or pg_temp.race_count('d', 'budget_exhausted') <> 17
     or (select sum(r.reserved_usd) from ai_reservations r
         join knowledge_race_results k on k.reservation_id = r.id where k.case_name = 'd') > 1.00 then
    raise exception 'FAIL race d: % reserved under a 1.00 USD budget at 0.30', pg_temp.race_count('d', 'reserved');
  end if;
  raise notice 'PASS race d: global 1.00 USD at 0.30 across 20 learners, exactly 3 reserved';
  if pg_temp.race_count('e1', 'reserved') <> 1 or pg_temp.race_count('e1', 'already_charged') <> 19 then
    raise exception 'FAIL race e1: % reserved, % already charged',
      pg_temp.race_count('e1', 'reserved'), pg_temp.race_count('e1', 'already_charged');
  end if;
  raise notice 'PASS race e1: one sentence twenty times, one slot';
  if pg_temp.race_count('e2', 'reserved') <> 3 or pg_temp.race_count('e2', 'quota_exhausted') <> 17 then
    raise exception 'FAIL race e2: % reserved under a Free limit of 3', pg_temp.race_count('e2', 'reserved');
  end if;
  raise notice 'PASS race e2: twenty sentences at once, exactly 3 slots';
end $$;

delete from ai_usage_charges where fingerprint like 'kgate-race-%';
delete from ai_reservations where fingerprint like 'kgate-race-%';
delete from knowledge_entries where fingerprint like 'kgate-race-%';
delete from auth.users where email like 'knowledgegate-race-%@example.invalid';
update ai_budget_days b set reserved_usd = k.reserved_usd, spent_usd = k.spent_usd
  from knowledge_race_budget k where b.period_day = k.period_day;
drop table knowledge_race_results, knowledge_race_state, knowledge_race_budget;
