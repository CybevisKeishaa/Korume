<#
.SYNOPSIS
  Live PostgreSQL acceptance gate for the port-profile XP award and learning outcomes.

.DESCRIPTION
  Requires Docker and a running local Supabase stack (`npx supabase start`).
  Runs supabase/tests/port-profile.sql, then the twenty-connection XP race.
#>
[CmdletBinding()]
param(
  [Parameter()] [string] $Container
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sqlPath = Join-Path $repoRoot 'supabase/tests/port-profile.sql'
$raceDir = Join-Path $repoRoot 'supabase/tests/xp-race'
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
  Write-Output "FAIL: Profile single-session gate exited $LASTEXITCODE"
  exit 1
}

& docker exec $Container rm -rf /tmp/xp-race
& docker cp $raceDir "${Container}:/tmp/xp-race"
if ($LASTEXITCODE -ne 0) {
  Write-Output 'FAIL: could not copy the XP race harness into the container'
  exit 1
}
& docker exec $Container bash -c "tr -d '\r' < /tmp/xp-race/run.sh | bash -s -- /tmp/xp-race"
if ($LASTEXITCODE -ne 0) {
  Write-Output "FAIL: XP race gate exited $LASTEXITCODE"
  exit 1
}

Write-Output 'Profile: live PostgreSQL gate passed (single-session + 20-connection race)'
