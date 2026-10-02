-- One Free learner: either one sentence twenty times (:same = 1) or twenty sentences at once.
select pg_advisory_lock_shared(7101);
insert into knowledge_race_results (case_name, outcome, reservation_id)
select :'case', outcome, reservation_id from ai_reserve(
  (select id from users where email = :'email'), 'learner', 'free_sentence',
  case when :same = 1 then 'kgate-race-' || :'case' else 'kgate-race-' || :'case' || '-' || :'i' end, 0, 0.01,
  jsonb_build_object('globalUsdPerDay', 1000000, 'freeSentencesPerDay', 3, 'plusMaxSectionsPerDay', 200,
    'plusCreditsPerMonth', 0),
  120);
