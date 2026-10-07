\set ON_ERROR_STOP on
do $$
declare uid uuid := (select id from users where email = 'xpgate-race@example.invalid');
begin
  if (select count(*) from xp_race_results) <> 20
    or (select count(*) from xp_race_results where awarded = 10) <> 1
    or (select count(*) from xp_events where user_id = uid) <> 1
    or (select xp from user_stats where user_id = uid) <> 10 then
    raise exception 'FAIL XP race: expected one award and total XP 10';
  end if;
  raise notice 'PASS XP race: 20 workers, one award, total XP 10';
end $$;
delete from auth.users where email = 'xpgate-race@example.invalid';
drop table xp_race_results;
