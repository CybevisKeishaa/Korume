[CmdletBinding()]
param(
  [Parameter()] [string] $Container
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sqlPath = Join-Path $repoRoot 'supabase/tests/practice-pronunciation.sql'
$raceDir = Join-Path $repoRoot 'supabase/tests/practice-pronunciation-race'

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
  Write-Output "FAIL: practice gate exited $LASTEXITCODE"
  exit 1
}

& docker exec $Container rm -rf /tmp/practice-pronunciation-race
& docker cp $raceDir "${Container}:/tmp/practice-pronunciation-race"
if ($LASTEXITCODE -ne 0) {
  Write-Output 'FAIL: could not copy the practice race harness into the container'
  exit 1
}
& docker exec $Container bash -c "tr -d '\r' < /tmp/practice-pronunciation-race/run.sh | bash -s -- /tmp/practice-pronunciation-race"
if ($LASTEXITCODE -ne 0) {
  Write-Output "FAIL: practice race gate exited $LASTEXITCODE"
  exit 1
}

Write-Output 'Practice: live PostgreSQL gate passed (single-session + two-session lease race)'
