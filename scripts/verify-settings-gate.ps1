<#
.SYNOPSIS
  Live PostgreSQL acceptance gate for Settings preferences and memory erasure.

.DESCRIPTION
  Requires Docker and a running local Supabase stack (`npx supabase start`).
  The Supabase mock models no RLS, so this gate proves the database policies.
#>
[CmdletBinding()]
param(
  [Parameter()] [string] $Container
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sqlPath = Join-Path $repoRoot 'supabase/tests/settings-page.sql'

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
  Write-Output "FAIL: settings gate exited $LASTEXITCODE"
  exit 1
}

Write-Output 'settings page: live PostgreSQL gate passed'
