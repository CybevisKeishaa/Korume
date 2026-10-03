select pg_advisory_lock_shared(7201);
insert into korume_race_results (worker, outcome, reservation_id)
select :'i'::int, outcome, reservation_id from ai_reserve(
  (select id from users where email = 'korumegate-race-turn@example.invalid'),
  'learner', 'korume_free_turn', 'korumegate-race-turn', 0, 0.01,
  jsonb_build_object('globalUsdPerDay', 1000000, 'freeSentencesPerDay', 3,
    'plusMaxSectionsPerDay', 200, 'plusCreditsPerMonth', 1000,
    'askKorumeFreeTurnsPerDay', 10, 'askKorumePlusTurnsPerDay', 100),
  120, (select turn_id from korume_race_state));
