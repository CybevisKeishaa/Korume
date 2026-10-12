\set ON_ERROR_STOP on
do $$
declare uid uuid := (select id from users where email = 'missionrace@example.invalid');
begin
  if (select count(*) from daily_missions where user_id = uid) <> 1
    or (select count(*) from xp_events where user_id = uid and source_type = 'daily_mission_complete') <> 1
    or (select xp from user_stats where user_id = uid) is distinct from 50
    or (select count(*) from learning_outcomes where user_id = uid) <> 20
    or exists (select 1 from learning_outcomes where user_id = uid and item_key like 'mission:%') then
    raise exception 'FAIL mission race: expected one mission, one award, XP 50, and twenty learning outcomes';
  end if;
  raise notice 'PASS mission race: 20 workers, one mission, one award, total XP 50';
end $$;
delete from auth.users where email = 'missionrace@example.invalid';
