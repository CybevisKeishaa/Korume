-- Hold two barriers: one for concurrent ensure calls, one for concurrent claims after each outcome commits.
select pg_advisory_lock(7302);
select pg_advisory_lock(7303);
do $$
begin
  for attempt in 1..1200 loop
    if (select count(*) from pg_locks where locktype = 'advisory' and objid = 7302
      and mode = 'ShareLock' and not granted) >= 20 then return; end if;
    perform pg_sleep(0.05);
  end loop;
  raise exception 'FAIL mission race: only some workers reached the barrier';
end $$;
select pg_advisory_unlock(7302);
do $$
begin
  for attempt in 1..1200 loop
    if (select count(*) from pg_locks where locktype = 'advisory' and objid = 7303
      and mode = 'ShareLock' and not granted) >= 20 then return; end if;
    perform pg_sleep(0.05);
  end loop;
  raise exception 'FAIL mission race: only some workers reached the claim barrier';
end $$;
select pg_advisory_unlock(7303);
