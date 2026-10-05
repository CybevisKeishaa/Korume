select pg_advisory_lock_shared(7101);
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"5ca1ab1e-0000-4000-8000-00000000000c","role":"authenticated"}', true) \g /dev/null
select schedule_review_tomorrow('5ca1ab1e-0000-4000-8000-0000000000f3',
  '[{"lineId":"5ca1ab1e-0000-4000-8000-0000000000d5"}]'::jsonb, now() + interval '20 hours') \g /dev/null
commit;
