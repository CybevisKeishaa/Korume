-- Twenty different learners, so only the budget row lock stands between them and an overshoot.
select pg_advisory_lock_shared(7101);
insert into knowledge_race_results (case_name, outcome, reservation_id)
select 'd', outcome, reservation_id from ai_reserve(
  (select id from users where email = 'knowledgegate-race-budget-' || :'i' || '@example.invalid'), 'learner',
  'plus_section', 'kgate-race-d-' || :'i', 1, 0.30,
  jsonb_build_object('globalUsdPerDay', (select value from knowledge_race_state where key = 'budget_base') + 1.00,
    'freeSentencesPerDay', 3, 'plusMaxSectionsPerDay', 200, 'plusCreditsPerMonth', 1000000),
  120);
