-- One Plus learner, twenty sections at once: the fuse and the monthly credits must never overshoot.
select pg_advisory_lock_shared(7101);
insert into knowledge_race_results (case_name, outcome, reservation_id)
select :'case', outcome, reservation_id from ai_reserve(
  (select id from users where email = :'email'), 'learner', 'plus_section', 'kgate-race-' || :'case' || '-' || :'i',
  :reserve_credits, 0.01,
  jsonb_build_object('globalUsdPerDay', 1000000, 'freeSentencesPerDay', 3, 'plusMaxSectionsPerDay', :fuse,
    'plusCreditsPerMonth', :credits),
  120);
