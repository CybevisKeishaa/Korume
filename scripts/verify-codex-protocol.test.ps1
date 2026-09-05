$ErrorActionPreference = 'Stop'

$validator = Join-Path $PSScriptRoot 'verify-codex-protocol.ps1'
$fixtureName = "verify-codex-protocol-$PID-$([guid]::NewGuid().ToString('N'))"
$validRoot = Join-Path $env:TEMP $fixtureName
$missingRunStateRoot = Join-Path $env:TEMP "$fixtureName-no-run-state"
$missingRunStateDirectoryRoot = Join-Path $env:TEMP "$fixtureName-no-run-state-directory"
$templateOnlyRunStateRoot = Join-Path $env:TEMP "$fixtureName-template-only-run-state"
$requiredRoles = @(
  'ai-engineer', 'backend-engineer', 'code-reviewer', 'database-engineer',
  'frontend-engineer', 'motion-engineer', 'tech-lead', 'test-engineer'
)
$requiredCommands = @(
  'build-layer', 'new-module', 'review-changes', 'create-task-packet',
  'checkpoint-branch'
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
    '.codex/commands',
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
  foreach ($command in $requiredCommands) {
    Set-Content -LiteralPath (Join-Path $validRoot ".codex/commands/$command.md") -Value "command = '$command'"
  }
  Set-Content -LiteralPath (Join-Path $validRoot 'docs/superpowers/run-state/feature-branch.md') -Value $requiredHeadings

  & $validator -Root $validRoot
  Assert-ExitCode -Expected 0 -Message 'valid protocol fixture failed.'

  Copy-Item -LiteralPath $validRoot -Destination $missingRunStateRoot -Recurse
  Remove-Item -LiteralPath (Join-Path $missingRunStateRoot 'docs/superpowers/run-state/feature-branch.md')
  & $validator -Root $missingRunStateRoot
  if ($LASTEXITCODE -eq 0) { throw 'missing branch run state was accepted' }
  Assert-ExitCode -Expected 1 -Message 'missing branch run-state fixture failed to be rejected.'

  Copy-Item -LiteralPath $validRoot -Destination $missingRunStateDirectoryRoot -Recurse
  Remove-Item -LiteralPath (Join-Path $missingRunStateDirectoryRoot 'docs/superpowers/run-state') -Recurse
  & $validator -Root $missingRunStateDirectoryRoot
  if ($LASTEXITCODE -eq 0) { throw 'missing run-state directory was accepted' }
  Assert-ExitCode -Expected 1 -Message 'missing run-state directory fixture failed to be rejected.'

  Copy-Item -LiteralPath $validRoot -Destination $templateOnlyRunStateRoot -Recurse
  $templateOnlyDirectory = Join-Path $templateOnlyRunStateRoot 'docs/superpowers/run-state'
  Remove-Item -LiteralPath (Join-Path $templateOnlyDirectory 'feature-branch.md')
  Set-Content -LiteralPath (Join-Path $templateOnlyDirectory 'README.md') -Value 'Run-state documentation'
  Set-Content -LiteralPath (Join-Path $templateOnlyDirectory 'TEMPLATE.md') -Value '# Branch Run State'
  & $validator -Root $templateOnlyRunStateRoot
  if ($LASTEXITCODE -eq 0) { throw 'template-only run-state directory was accepted' }
  Assert-ExitCode -Expected 1 -Message 'template-only run-state fixture failed to be rejected.'

  $defaultRootScripts = Join-Path $validRoot 'scripts'
  New-Item -ItemType Directory -Path $defaultRootScripts -Force | Out-Null
  $defaultRootValidator = Join-Path $defaultRootScripts 'verify-codex-protocol.ps1'
  Copy-Item -LiteralPath $validator -Destination $defaultRootValidator
  & powershell -NoProfile -ExecutionPolicy Bypass -File $defaultRootValidator
  Assert-ExitCode -Expected 0 -Message 'validator default-root invocation failed.'

  Remove-Item -LiteralPath (Join-Path $validRoot '.codex/agents/test-engineer.toml')
  & $validator -Root $validRoot
  if ($LASTEXITCODE -eq 0) { throw 'missing role was accepted' }
  Assert-ExitCode -Expected 1 -Message 'missing role fixture failed to be rejected.'

  Set-Content -LiteralPath (Join-Path $validRoot '.codex/agents/test-engineer.toml') -Value "role = 'test-engineer'"
  Set-Content -LiteralPath (Join-Path $validRoot 'AGENTS.md') -Value 'Read .claude/docs/workflow.md'
  & $validator -Root $validRoot
  if ($LASTEXITCODE -eq 0) { throw 'retired Claude path was accepted' }
  Assert-ExitCode -Expected 1 -Message 'retired Claude path fixture failed to be rejected.'

  Set-Content -LiteralPath (Join-Path $validRoot 'AGENTS.md') -Value 'Read .CODEX/docs/workflow.md'
  & $validator -Root $validRoot
  if ($LASTEXITCODE -eq 0) { throw 'noncanonical Codex path was accepted' }
  Assert-ExitCode -Expected 1 -Message 'noncanonical Codex path fixture failed to be rejected.'

  Set-Content -LiteralPath (Join-Path $validRoot 'AGENTS.md') -Value 'Read .codex/docs/workflow.md'
  Remove-Item -LiteralPath (Join-Path $validRoot '.codex/commands/checkpoint-branch.md')
  & $validator -Root $validRoot
  if ($LASTEXITCODE -eq 0) { throw 'missing command was accepted' }
  Assert-ExitCode -Expected 1 -Message 'missing command fixture failed to be rejected.'
}
finally {
  if (Test-Path -LiteralPath $validRoot) {
    Remove-Item -LiteralPath $validRoot -Recurse -Force
  }
  if (Test-Path -LiteralPath $missingRunStateRoot) {
    Remove-Item -LiteralPath $missingRunStateRoot -Recurse -Force
  }
  if (Test-Path -LiteralPath $missingRunStateDirectoryRoot) {
    Remove-Item -LiteralPath $missingRunStateDirectoryRoot -Recurse -Force
  }
  if (Test-Path -LiteralPath $templateOnlyRunStateRoot) {
    Remove-Item -LiteralPath $templateOnlyRunStateRoot -Recurse -Force
  }
}
