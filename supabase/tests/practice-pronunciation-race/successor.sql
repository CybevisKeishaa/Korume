\set ON_ERROR_STOP on
-- This connection holds the barrier until the first scorer is waiting with its committed token.
select pg_advisory_lock(7147);
do $$
begin
  for i in 1..200 loop
    if exists (select 1 from pg_locks where locktype = 'advisory' and objid = 7147 and mode = 'ShareLock' and not granted) then return; end if;
    perform pg_sleep(0.05);
  end loop;
  raise exception 'FAIL race: stale scorer never reached barrier';
end $$;
update shadowing_sessions set scoring_started_at = now() - interval '91 seconds' where id = 'ba5eba11-0000-4000-8000-000000000107';
set role service_role;
create temp table successor as select claim from claim_pronunciation_scoring('ba5eba11-0000-4000-8000-00000000000c', 'ba5eba11-0000-4000-8000-000000000107');
do $$
begin
  if (select count(*) from successor) <> 1 or (select claim from successor) is null then raise exception 'FAIL race: successor claim missing'; end if;
end $$;
select pg_advisory_unlock(7147);
-- The stale connection now holds the shared barrier through both stale writes; wait for its disconnect.
select pg_advisory_lock(7147);
do $$
declare r shadowing_sessions%rowtype;
begin
  if finish_pronunciation_scoring('ba5eba11-0000-4000-8000-000000000107', (select claim from successor), 88, 77, '{"v":1}') is distinct from true then raise exception 'FAIL race: successor could not finish'; end if;
  select * into r from shadowing_sessions where id = 'ba5eba11-0000-4000-8000-000000000107';
  if r.pronunciation_score is distinct from 88::numeric or r.rhythm_score is distinct from 77::numeric
     or r.scoring_claim is not null then raise exception 'FAIL race: successor score not persisted'; end if;
  raise notice 'PASS race: two scorer sessions, stale finish/release refused, successor persisted';
end $$;
