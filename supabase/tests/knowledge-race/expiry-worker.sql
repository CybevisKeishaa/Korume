-- Different learners all enter ai_reserve together, so every call runs the shared expiry sweep.
select pg_advisory_lock_shared(7101);
insert into knowledge_race_results (case_name, outcome, reservation_id)
select 'expiry', outcome, reservation_id from ai_reserve(
  (select id from users where email = 'knowledgegate-race-expiry-' || :'i' || '@example.invalid'), 'learner',
  'plus_section', 'kgate-race-expiry-worker-' || :'i', 0, 0,
  jsonb_build_object('globalUsdPerDay', 1000000, 'freeSentencesPerDay', 3, 'plusMaxSectionsPerDay', 200,
    'plusCreditsPerMonth', 1000000),
  120);
