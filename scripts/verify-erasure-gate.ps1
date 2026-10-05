<#
.SYNOPSIS
  Live PostgreSQL acceptance gate for account erasure.
#>
[CmdletBinding()]
param([Parameter()] [string] $Container)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sqlPath = Join-Path $repoRoot 'supabase/tests/account-erasure.sql'
if (-not (Test-Path -LiteralPath $sqlPath)) {
  Write-Output "missing gate script: $sqlPath"
  exit 1
}
if ([string]::IsNullOrWhiteSpace($Container)) {
  $candidates = @(docker ps --filter 'name=supabase_db' --format '{{.Names}}')
  if ($candidates.Count -ne 1) {
    Write-Output "expected exactly one running supabase_db container, found $($candidates.Count): $($candidates -join ', ')"
    exit 1
  }
  $Container = $candidates[0]
}
Write-Output "database container: $Container"
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
Get-Content -LiteralPath $sqlPath -Raw -Encoding UTF8 |
  & docker exec -i $Container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
if ($LASTEXITCODE -ne 0) {
  Write-Output "FAIL: account erasure gate exited $LASTEXITCODE"
  exit 1
}
Write-Output 'Account erasure: live PostgreSQL gate passed'
