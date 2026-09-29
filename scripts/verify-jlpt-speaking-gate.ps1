<#
.SYNOPSIS
  Live PostgreSQL acceptance gate for the JLPT Speaking aggregate.

.DESCRIPTION
  Requires Docker and a running local Supabase stack (`npx supabase start`).
  The Supabase mock models no SQL, so this gate proves the aggregate and grants.
#>
[CmdletBinding()]
param(
  [Parameter()] [string] $Container
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sqlPath = Join-Path $repoRoot 'supabase/tests/jlpt-speaking.sql'

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

Get-Content -LiteralPath $sqlPath -Raw |
  & docker exec -i $Container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
if ($LASTEXITCODE -ne 0) {
  Write-Output "FAIL: JLPT Speaking gate exited $LASTEXITCODE"
  exit 1
}

Write-Output 'JLPT Speaking: live PostgreSQL gate passed'
