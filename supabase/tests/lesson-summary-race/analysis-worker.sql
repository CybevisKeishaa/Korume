select pg_advisory_lock_shared(7101);
insert into summary_race_results (case_name, outcome, token)
select 'a', outcome, lease_token from knowledge_claim_lease(
  '{"fingerprint":"sgate-race-a","section":"lesson_analysis","locale":"vi","contextKey":"","schemaVersion":1,"generatorVersion":1,"contentVariant":"full"}'::jsonb,
  60);
