<#
.SYNOPSIS
  Live PostgreSQL acceptance gate for Ask Korume threads and messages.

.DESCRIPTION
  Requires Docker and a running local Supabase stack (`npx supabase start`).
  Runs supabase/tests/korume.sql, then the twenty-connection turn race.
#>
[CmdletBinding()]
param(
  [Parameter()] [string] $Container
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sqlPath = Join-Path $repoRoot 'supabase/tests/korume.sql'
$raceDir = Join-Path $repoRoot 'supabase/tests/korume-race'
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
  Write-Output "FAIL: Korume single-session gate exited $LASTEXITCODE"
  exit 1
}

& docker exec $Container rm -rf /tmp/korume-race
& docker cp $raceDir "${Container}:/tmp/korume-race"
if ($LASTEXITCODE -ne 0) {
  Write-Output 'FAIL: could not copy the Korume race harness into the container'
  exit 1
}
& docker exec $Container bash -c "tr -d '\r' < /tmp/korume-race/run.sh | bash -s -- /tmp/korume-race"
if ($LASTEXITCODE -ne 0) {
  Write-Output "FAIL: Korume race gate exited $LASTEXITCODE"
  exit 1
}

Write-Output 'Korume: live PostgreSQL gate passed (single-session + 20-connection race)'
