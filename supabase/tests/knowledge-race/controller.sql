-- Holds the barrier until :n workers are queued behind it, then releases them all at once.
select pg_advisory_lock(7101);
select set_config('race.n', :'n', false);
do $$
begin
  for attempt in 1..1200 loop
    if (select count(*) from pg_locks where locktype = 'advisory' and objid = 7101 and mode = 'ShareLock' and not granted)
       >= current_setting('race.n')::int then
      return;
    end if;
    perform pg_sleep(0.05);
  end loop;
  raise exception 'FAIL: only some workers reached the barrier';
end $$;
select pg_advisory_unlock(7101);
