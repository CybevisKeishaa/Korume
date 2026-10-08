<#
.SYNOPSIS
  Live PostgreSQL acceptance gate for the port-dashboard lesson-access and first-completion invariants.

.DESCRIPTION
  Requires Docker and a running local Supabase stack (`npx supabase start`).
  Runs supabase/tests/port-dashboard.sql, then the mission race when Task 8 adds it.
#>
[CmdletBinding()]
param(
  [Parameter()] [string] $Container
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sqlPath = Join-Path $repoRoot 'supabase/tests/port-dashboard.sql'
$raceDir = Join-Path $repoRoot 'supabase/tests/mission-race'
if (-not (Test-Path -LiteralPath $sqlPath)) {
  Write-Output "missing gate input: $sqlPath"
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

# Windows PowerShell 5.1 reads BOM-less files as ANSI and pipes ASCII by default.
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
Get-Content -LiteralPath $sqlPath -Raw -Encoding UTF8 |
  & docker exec -i $Container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
if ($LASTEXITCODE -ne 0) {
  Write-Output "FAIL: Dashboard single-session gate exited $LASTEXITCODE"
  exit 1
}

if (-not (Test-Path -LiteralPath $raceDir)) {
  Write-Output 'SKIP: Dashboard mission race gate (Task 8 harness is absent)'
  Write-Output 'Dashboard: live PostgreSQL gate passed (single-session; mission race pending Task 8)'
  exit 0
}

& docker exec $Container rm -rf /tmp/mission-race
& docker cp $raceDir "${Container}:/tmp/mission-race"
if ($LASTEXITCODE -ne 0) {
  Write-Output 'FAIL: could not copy the Dashboard mission race harness into the container'
  exit 1
}
& docker exec $Container bash -c "tr -d '\r' < /tmp/mission-race/run.sh | bash -s -- /tmp/mission-race"
if ($LASTEXITCODE -ne 0) {
  Write-Output "FAIL: Dashboard mission race gate exited $LASTEXITCODE"
  exit 1
}

Write-Output 'Dashboard: live PostgreSQL gate passed (single-session + mission race)'
