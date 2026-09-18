<#
.SYNOPSIS
  Live PostgreSQL acceptance gate for the lesson-creation job queue.

.DESCRIPTION
  Runs supabase/tests/lesson-creation-jobs.sql against the local Supabase
  database, then a two-session contention check that a single SQL script
  cannot express: two workers racing for one queued job must not both claim
  it, and the loser must skip rather than block.

  Requires Docker and a running local Supabase (`npx supabase start`).
  Source tests cannot substitute: the Supabase mock models no RLS
  (docs/lessons.md L-005), and `for update skip locked` needs a real server.
#>
[CmdletBinding()]
param(
  [Parameter()] [string] $Container
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sqlPath = Join-Path $repoRoot 'supabase/tests/lesson-creation-jobs.sql'

if (-not (Test-Path -LiteralPath $sqlPath)) {
  Write-Output "missing gate script: $sqlPath"
  exit 1
}

if ([string]::IsNullOrWhiteSpace($Container)) {
  $candidates = @(docker ps --filter 'name=supabase_db' --format '{{.Names}}')
  if ($candidates.Count -ne 1) {
    Write-Output "expected exactly one running supabase_db container, found $($candidates.Count): $($candidates -join ', ')"
    Write-Output 'start the local stack with `npx supabase start`, or pass -Container.'
    exit 1
  }
  $Container = $candidates[0]
}
Write-Output "database container: $Container"

function Invoke-Psql {
  param([string] $Sql)
  $out = $Sql | & docker exec -i $Container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -tAq 2>&1
  return [pscustomobject]@{ Output = ($out -join "`n"); ExitCode = $LASTEXITCODE }
}

# --- single-session gates ----------------------------------------------------

Get-Content -LiteralPath $sqlPath -Raw |
  & docker exec -i $Container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
if ($LASTEXITCODE -ne 0) {
  Write-Output "FAIL: single-session gates exited $LASTEXITCODE"
  exit 1
}

# --- two-session contention --------------------------------------------------

$fixture = @'
delete from auth.users where email = 'c4gate-race@example.invalid';
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
  'authenticated', 'c4gate-race@example.invalid', crypt('password123', gen_salt('bf')),
  now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);
insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access, youtube_video_id)
select id, 'learner', 'PRIVATE', 'C4GATERACE1' from public.users where email = 'c4gate-race@example.invalid';
select count(*) from public.lesson_creation_jobs where youtube_video_id = 'C4GATERACE1' and state = 'queued';
'@

$queued = (Invoke-Psql -Sql $fixture)
if ($queued.ExitCode -ne 0 -or $queued.Output.Trim() -notmatch '(^|\n)1$') {
  Write-Output "FAIL: contention fixture did not produce exactly one queued job`n$($queued.Output)"
  exit 1
}

$holder = @"
begin;
select 'CLAIM:' || coalesce(((public.claim_lesson_creation_job(now(), 60)).id)::text, 'NULL');
select pg_sleep(5);
commit;
"@
$rival = @"
select pg_sleep(1);
begin;
select 'CLAIM:' || coalesce(((public.claim_lesson_creation_job(now(), 60)).id)::text, 'NULL');
commit;
"@

$runner = {
  param($c, $sql)
  $sql | & docker exec -i $c psql -U postgres -d postgres -tAq
}

$started = Get-Date
$holderJob = Start-Job -ScriptBlock $runner -ArgumentList $Container, $holder
$rivalJob = Start-Job -ScriptBlock $runner -ArgumentList $Container, $rival
$jobs = @($holderJob, $rivalJob)
$null = Wait-Job -Job $jobs -Timeout 120
$results = @($jobs | ForEach-Object { , @(Receive-Job -Job $_ -ErrorAction SilentlyContinue) })
Remove-Job -Job $jobs -Force

$claims = @()
foreach ($r in $results) {
  foreach ($line in $r) {
    if ("$line" -match '^CLAIM:(.+)$') { $claims += $Matches[1].Trim() }
  }
}

$elapsed = (Get-Date) - $started
$state = (Invoke-Psql -Sql "select state || '/' || attempt_count from public.lesson_creation_jobs where youtube_video_id = 'C4GATERACE1';").Output.Trim()
$null = Invoke-Psql -Sql "delete from auth.users where email = 'c4gate-race@example.invalid'; delete from public.videos where youtube_video_id like 'C4GATE%';"

if ($claims.Count -ne 2) {
  Write-Output "FAIL: expected two claim results, got $($claims.Count): $($claims -join ', ')"
  exit 1
}
$winners = @($claims | Where-Object { $_ -ne 'NULL' })
$losers = @($claims | Where-Object { $_ -eq 'NULL' })
if ($winners.Count -ne 1 -or $losers.Count -ne 1) {
  Write-Output "FAIL: one session must claim and one must skip, got: $($claims -join ', ')"
  exit 1
}
if ($state -ne 'running/1') {
  Write-Output "FAIL: after the race the job is '$state', expected 'running/1' - a second claim incremented the attempt"
  exit 1
}
Write-Output ("CONTENTION PASS  one claim ({0}), one skip, job {1}, race settled in {2:N1}s" -f $winners[0], $state, $elapsed.TotalSeconds)

Write-Output 'lesson-creation job queue: live PostgreSQL gate passed'
exit 0
