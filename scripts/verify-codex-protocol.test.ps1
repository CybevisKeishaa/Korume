$ErrorActionPreference = 'Stop'

$validator = Join-Path $PSScriptRoot 'verify-codex-protocol.ps1'
$fixtureName = "verify-codex-protocol-$PID-$([guid]::NewGuid().ToString('N'))"
$validRoot = Join-Path $env:TEMP $fixtureName
$requiredRoles = @(
  'ai-engineer', 'backend-engineer', 'code-reviewer', 'database-engineer',
  'frontend-engineer', 'motion-engineer', 'tech-lead', 'test-engineer'
)
$requiredHeadings = @(
  '# Branch Run State', '## Goal and scope', '## Authorities',
  '## Accepted commits', '## Contracts and decisions',
  '## Verification', '## Working tree and environment',
  '## Blockers', '## Next actions'
)

function Assert-ExitCode {
  param(
    [int] $Expected,
    [string] $Message
  )

  if ($LASTEXITCODE -ne $Expected) {
    throw "$Message Expected exit $Expected, got $LASTEXITCODE."
  }
}

try {
  $directories = @(
    '.codex/agents',
    '.codex/docs',
    'docs/superpowers/run-state'
  )
  foreach ($directory in $directories) {
    New-Item -ItemType Directory -Path (Join-Path $validRoot $directory) -Force | Out-Null
  }

  Set-Content -LiteralPath (Join-Path $validRoot 'AGENTS.md') -Value 'Read .codex/docs/workflow.md'
  Set-Content -LiteralPath (Join-Path $validRoot '.codex/docs/workflow.md') -Value 'Canonical workflow'
  foreach ($role in $requiredRoles) {
    Set-Content -LiteralPath (Join-Path $validRoot ".codex/agents/$role.toml") -Value "role = '$role'"
  }
  Set-Content -LiteralPath (Join-Path $validRoot 'docs/superpowers/run-state/feature-branch.md') -Value $requiredHeadings

  & $validator -Root $validRoot
  Assert-ExitCode -Expected 0 -Message 'valid protocol fixture failed.'

  Remove-Item -LiteralPath (Join-Path $validRoot '.codex/agents/test-engineer.toml')
  & $validator -Root $validRoot
  if ($LASTEXITCODE -eq 0) { throw 'missing role was accepted' }
  Assert-ExitCode -Expected 1 -Message 'missing role fixture failed to be rejected.'

  Set-Content -LiteralPath (Join-Path $validRoot '.codex/agents/test-engineer.toml') -Value "role = 'test-engineer'"
  Set-Content -LiteralPath (Join-Path $validRoot 'AGENTS.md') -Value 'Read .claude/docs/workflow.md'
  & $validator -Root $validRoot
  if ($LASTEXITCODE -eq 0) { throw 'retired Claude path was accepted' }
  Assert-ExitCode -Expected 1 -Message 'retired Claude path fixture failed to be rejected.'
}
finally {
  if (Test-Path -LiteralPath $validRoot) {
    Remove-Item -LiteralPath $validRoot -Recurse -Force
  }
}
