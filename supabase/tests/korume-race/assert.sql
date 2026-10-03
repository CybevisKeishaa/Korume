\set ON_ERROR_STOP on
do $$
declare used uuid := (select id from users where email = 'korumegate-race-turn@example.invalid');
begin
  if (select count(*) from korume_race_results) <> 20
    or (select count(*) from korume_race_results where outcome = 'reserved') <> 1
    or (select count(*) from korume_race_results where outcome = 'turn_exists') <> 19
    or (select count(*) from ai_reservations where requested_by_user_id = used
      and turn_id = (select turn_id from korume_race_state) and status = 'held') <> 1
    or (select d.reserved_usd - b.reserved_usd from ai_budget_days d
      join korume_race_budget b on b.period_day = d.period_day
      where d.period_day = (now() at time zone 'utc')::date) <> 0.01 then
    raise exception 'FAIL Korume race: duplicate turn or budget hold';
  end if;
  raise notice 'PASS Korume race: one reserve, 19 turn_exists, one budget hold';
end $$;
delete from ai_usage_charges where fingerprint = 'korumegate-race-turn';
delete from ai_reservations where fingerprint = 'korumegate-race-turn';
delete from auth.users where email = 'korumegate-race-turn@example.invalid';
update ai_budget_days d set reserved_usd = b.reserved_usd, spent_usd = b.spent_usd
  from korume_race_budget b where d.period_day = b.period_day;
drop table korume_race_results, korume_race_state, korume_race_budget;
