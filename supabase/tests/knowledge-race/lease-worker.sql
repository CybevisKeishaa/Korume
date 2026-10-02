select pg_advisory_lock_shared(7101);
insert into knowledge_race_results (case_name, outcome)
select 'a', outcome from knowledge_claim_lease(
  '{"fingerprint":"kgate-race-a","section":"lite","locale":"vi","contextKey":"","schemaVersion":1,"generatorVersion":1,"contentVariant":"full"}'::jsonb,
  60);
