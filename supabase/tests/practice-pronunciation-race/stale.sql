\set ON_ERROR_STOP on
set role service_role;
create temp table first_claim as select claim from claim_pronunciation_scoring('ba5eba11-0000-4000-8000-00000000000c', 'ba5eba11-0000-4000-8000-000000000107');
do $$
begin
  if (select count(*) from first_claim) <> 1 or (select claim from first_claim) is null then raise exception 'FAIL race: first claim missing'; end if;
end $$;
select pg_advisory_lock_shared(7147);
do $$
declare old_claim uuid := (select claim from first_claim); next_claim uuid;
begin
  select scoring_claim into next_claim from shadowing_sessions where id = 'ba5eba11-0000-4000-8000-000000000107';
  if next_claim is null or next_claim = old_claim then raise exception 'FAIL race: successor did not rotate token'; end if;
  if finish_pronunciation_scoring('ba5eba11-0000-4000-8000-000000000107', old_claim, 11, 22, '{"v":1}') is distinct from false then raise exception 'FAIL race: stale finish succeeded'; end if;
  if release_pronunciation_scoring('ba5eba11-0000-4000-8000-000000000107', old_claim) is distinct from false then raise exception 'FAIL race: stale release succeeded'; end if;
  if (select scoring_claim from shadowing_sessions where id = 'ba5eba11-0000-4000-8000-000000000107') is distinct from next_claim
     or (select pronunciation_score from shadowing_sessions where id = 'ba5eba11-0000-4000-8000-000000000107') is not null then raise exception 'FAIL race: stale writes changed successor row'; end if;
end $$;
