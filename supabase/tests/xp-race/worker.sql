select pg_advisory_lock_shared(7301);
insert into xp_race_results
select :'i'::int, xp_awarded from record_learning_outcome(
  (select id from users where email = 'xpgate-race@example.invalid'),
  'srs_review', 'vocab:race', 10, 'Asia/Ho_Chi_Minh', true);
