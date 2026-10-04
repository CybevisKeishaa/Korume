select pg_advisory_lock_shared(7101);
insert into summary_race_results (case_name, outcome, token)
select 'r', outcome, lease_token from reflection_claim_lease('5ca1ab1e-0000-4000-8000-00000000000c',
  '{"videoId":"5ca1ab1e-0000-4000-8000-0000000000f3","locale":"vi","analysisFingerprint":"sgate-race-r","evidenceFingerprint":"sgate-race-e","schemaVersion":1,"generatorVersion":1}'::jsonb,
  60);
