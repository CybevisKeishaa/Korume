[CmdletBinding()]
param(
  [Parameter()] [string] $Container,
  [Parameter()] [string] $Database = 'postgres'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
# 048 (practice-listening) and 049 (listening-two-exercises) gates.
$sqlPaths = @('supabase/tests/practice-listening.sql', 'supabase/tests/listening-two-exercises.sql') |
  ForEach-Object { Join-Path $repoRoot $_ }

foreach ($sqlPath in $sqlPaths) {
  if (-not (Test-Path -LiteralPath $sqlPath)) {
    Write-Output "missing gate input: $sqlPath"
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
Write-Output "database container: $Container, database: $Database"

# Windows PowerShell 5.1 reads BOM-less files as ANSI and pipes ASCII by default.
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
foreach ($sqlPath in $sqlPaths) {
  Get-Content -LiteralPath $sqlPath -Raw -Encoding UTF8 |
    & docker exec -i $Container psql -U postgres -d $Database -v ON_ERROR_STOP=1 -q
  if ($LASTEXITCODE -ne 0) {
    Write-Output "FAIL: listening gate $(Split-Path -Leaf $sqlPath) exited $LASTEXITCODE"
    exit 1
  }
}

Write-Output 'Listening: live PostgreSQL gate passed'
