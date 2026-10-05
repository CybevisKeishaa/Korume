<#
.SYNOPSIS
  Live PostgreSQL acceptance gate for Summary / Analysis (spec 2026-10-04 §8).

.DESCRIPTION
  Requires Docker and a running local Supabase stack (`npx supabase start`).
  1. supabase/tests/lesson-summary.sql — evidence, saves, Review Tomorrow, reflection RLS, grants and lease.
  2. supabase/tests/lesson-summary-race/ — copied into the database container and run there: every round opens
     20 separate psql connections that a controller connection releases together through an advisory-lock
     barrier, so the reflection and lesson_analysis leases and Review Tomorrow are proven under real concurrency.
#>
[CmdletBinding()]
param(
  [Parameter()] [string] $Container
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sqlPath = Join-Path $repoRoot 'supabase/tests/lesson-summary.sql'
$raceDir = Join-Path $repoRoot 'supabase/tests/lesson-summary-race'

foreach ($path in @($sqlPath, $raceDir)) {
  if (-not (Test-Path -LiteralPath $path)) {
    Write-Output "missing gate input: $path"
    exit 1
  }
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
  Write-Output "FAIL: summary single-session gate exited $LASTEXITCODE"
  exit 1
}

& docker exec $Container rm -rf /tmp/lesson-summary-race
& docker cp $raceDir "${Container}:/tmp/lesson-summary-race"
if ($LASTEXITCODE -ne 0) {
  Write-Output 'FAIL: could not copy the race harness into the container'
  exit 1
}
& docker exec $Container bash -c "tr -d '\r' < /tmp/lesson-summary-race/run.sh | bash -s -- /tmp/lesson-summary-race"
if ($LASTEXITCODE -ne 0) {
  Write-Output "FAIL: summary race gate exited $LASTEXITCODE"
  exit 1
}

Write-Output 'Summary: live PostgreSQL gate passed (single-session + 20-connection races)'
