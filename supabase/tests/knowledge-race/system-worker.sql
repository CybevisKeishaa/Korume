-- One system requester: the per-user advisory lock must cap concurrent reserves.
select pg_advisory_lock_shared(7101);
insert into knowledge_race_results (case_name, outcome, reservation_id)
select 'f', outcome, reservation_id from ai_reserve(
  (select id from users where email = 'knowledgegate-race-system@example.invalid'), 'system', null,
  'kgate-race-f-' || :'i', 0, 0.01,
  jsonb_build_object('globalUsdPerDay', 1000000, 'freeSentencesPerDay', 3, 'plusMaxSectionsPerDay', 200,
    'plusCreditsPerMonth', 1000000, 'systemGenerationsPerUserPerDay', 5),
  120);
