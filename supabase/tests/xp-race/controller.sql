-- Hold a barrier until all twenty workers queue for it.
select pg_advisory_lock(7301);
do $$
begin
  for attempt in 1..1200 loop
    if (select count(*) from pg_locks where locktype = 'advisory' and objid = 7301
      and mode = 'ShareLock' and not granted) >= 20 then return; end if;
    perform pg_sleep(0.05);
  end loop;
  raise exception 'FAIL XP race: only some workers reached the barrier';
end $$;
select pg_advisory_unlock(7301);

