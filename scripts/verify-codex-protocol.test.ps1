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
$runStateBody = $requiredHeadings + @('', '- Owner: Codex')

function Assert-ExitCode {
  param(
    [int] $Expected,
    [string] $Message
  )

  if ($LASTEXITCODE -ne $Expected) {
    throw "$Message Expected exit $Expected, got $LASTEXITCODE."
  }
}

function New-ValidFixture {
  param([string] $Root)

  $directories = @(
    '.codex/agents',
    '.codex/commands',
    '.codex/docs',
    '.claude/agents',
    '.claude/commands',
    '.claude/docs',
    'docs/superpowers/run-state'
  )
  foreach ($directory in $directories) {
    New-Item -ItemType Directory -Path (Join-Path $Root $directory) -Force | Out-Null
  }

  Set-Content -LiteralPath (Join-Path $Root 'AGENTS.md') -Value 'Read .codex/docs/workflow.md'
  Set-Content -LiteralPath (Join-Path $Root '.codex/docs/workflow.md') -Value 'Canonical workflow'
  Set-Content -LiteralPath (Join-Path $Root '.claude/docs/workflow.md') -Value 'See .codex/docs/workflow.md'

  foreach ($role in $requiredRoles) {
    Set-Content -LiteralPath (Join-Path $Root ".codex/agents/$role.toml") -Value "role = '$role'"
    Set-Content -LiteralPath (Join-Path $Root ".claude/agents/$role.md") -Value @(
      '---', "name: $role", '---', "Full brief: .codex/agents/$role.toml"
    )
  }
  foreach ($command in $requiredCommands) {
    Set-Content -LiteralPath (Join-Path $Root ".codex/commands/$command.md") -Value "command = '$command'"
    Set-Content -LiteralPath (Join-Path $Root ".claude/commands/$command.md") -Value "Run .codex/commands/$command.md"
  }

  Set-Content -LiteralPath (Join-Path $Root 'docs/superpowers/run-state/feature-branch.md') -Value $runStateBody
}

try {
  New-ValidFixture -Root $validRoot

  & $validator -Root $validRoot
  Assert-ExitCode -Expected 0 -Message 'valid protocol fixture failed.'

  # --- run-state structure (unchanged rules) ---------------------------------

  Copy-Item -LiteralPath $validRoot -Destination $missingRunStateRoot -Recurse
  Remove-Item -LiteralPath (Join-Path $missingRunStateRoot 'docs/superpowers/run-state/feature-branch.md')
  & $validator -Root $missingRunStateRoot
  Assert-ExitCode -Expected 1 -Message 'missing branch run-state fixture failed to be rejected.'

  Copy-Item -LiteralPath $validRoot -Destination $missingRunStateDirectoryRoot -Recurse
  Remove-Item -LiteralPath (Join-Path $missingRunStateDirectoryRoot 'docs/superpowers/run-state') -Recurse
  & $validator -Root $missingRunStateDirectoryRoot
  Assert-ExitCode -Expected 1 -Message 'missing run-state directory fixture failed to be rejected.'

  Copy-Item -LiteralPath $validRoot -Destination $templateOnlyRunStateRoot -Recurse
  $templateOnlyDirectory = Join-Path $templateOnlyRunStateRoot 'docs/superpowers/run-state'
  Remove-Item -LiteralPath (Join-Path $templateOnlyDirectory 'feature-branch.md')
  Set-Content -LiteralPath (Join-Path $templateOnlyDirectory 'README.md') -Value 'Run-state documentation'
  Set-Content -LiteralPath (Join-Path $templateOnlyDirectory 'TEMPLATE.md') -Value '# Branch Run State'
  & $validator -Root $templateOnlyRunStateRoot
  Assert-ExitCode -Expected 1 -Message 'template-only run-state fixture failed to be rejected.'

  $defaultRootScripts = Join-Path $validRoot 'scripts'
  New-Item -ItemType Directory -Path $defaultRootScripts -Force | Out-Null
  $defaultRootValidator = Join-Path $defaultRootScripts 'verify-codex-protocol.ps1'
  Copy-Item -LiteralPath $validator -Destination $defaultRootValidator
  & powershell -NoProfile -ExecutionPolicy Bypass -File $defaultRootValidator
  Assert-ExitCode -Expected 0 -Message 'validator default-root invocation failed.'

  Remove-Item -LiteralPath (Join-Path $validRoot '.codex/agents/test-engineer.toml')
  & $validator -Root $validRoot
  Assert-ExitCode -Expected 1 -Message 'missing role fixture failed to be rejected.'
  Set-Content -LiteralPath (Join-Path $validRoot '.codex/agents/test-engineer.toml') -Value "role = 'test-engineer'"

  Remove-Item -LiteralPath (Join-Path $validRoot '.codex/commands/checkpoint-branch.md')
  & $validator -Root $validRoot
  Assert-ExitCode -Expected 1 -Message 'missing command fixture failed to be rejected.'
  Set-Content -LiteralPath (Join-Path $validRoot '.codex/commands/checkpoint-branch.md') -Value "command = 'checkpoint-branch'"

  # --- canonical Codex casing (unchanged rule) -------------------------------

  Set-Content -LiteralPath (Join-Path $validRoot 'AGENTS.md') -Value 'Read .CODEX/docs/workflow.md'
  & $validator -Root $validRoot
  Assert-ExitCode -Expected 1 -Message 'noncanonical Codex path fixture failed to be rejected.'

  # --- D2a: naming the adapter directory is now legal ------------------------

  Set-Content -LiteralPath (Join-Path $validRoot 'AGENTS.md') -Value @(
    'Read .codex/docs/workflow.md', 'Claude Code stubs live in .claude/agents/.'
  )
  & $validator -Root $validRoot
  Assert-ExitCode -Expected 0 -Message 'AGENTS.md naming the adapter directory was wrongly rejected.'
  Set-Content -LiteralPath (Join-Path $validRoot 'AGENTS.md') -Value 'Read .codex/docs/workflow.md'

  # --- D1a: harness parity ---------------------------------------------------

  Remove-Item -LiteralPath (Join-Path $validRoot '.claude/agents/motion-engineer.md')
  & $validator -Root $validRoot
  Assert-ExitCode -Expected 1 -Message 'missing Claude agent stub failed to be rejected.'
  Set-Content -LiteralPath (Join-Path $validRoot '.claude/agents/motion-engineer.md') -Value @(
    '---', 'name: motion-engineer', '---', 'Full brief: .codex/agents/motion-engineer.toml'
  )

  Remove-Item -LiteralPath (Join-Path $validRoot '.claude/commands/review-changes.md')
  & $validator -Root $validRoot
  Assert-ExitCode -Expected 1 -Message 'missing Claude command stub failed to be rejected.'
  Set-Content -LiteralPath (Join-Path $validRoot '.claude/commands/review-changes.md') -Value 'Run .codex/commands/review-changes.md'

  # --- D1a: a stub may not regrow into a second home -------------------------

  Set-Content -LiteralPath (Join-Path $validRoot '.claude/agents/tech-lead.md') -Value (
    @('---', 'name: tech-lead', '---', 'Full brief: .codex/agents/tech-lead.toml') +
    (1..30 | ForEach-Object { "Restated role content line $_." })
  )
  & $validator -Root $validRoot
  Assert-ExitCode -Expected 1 -Message 'oversized Claude stub failed to be rejected.'
  Set-Content -LiteralPath (Join-Path $validRoot '.claude/agents/tech-lead.md') -Value @(
    '---', 'name: tech-lead', '---', 'Full brief: .codex/agents/tech-lead.toml'
  )

  Set-Content -LiteralPath (Join-Path $validRoot '.claude/agents/backend-engineer.md') -Value @(
    '---', 'name: backend-engineer', '---', 'You own API routes and the SRS engine.'
  )
  & $validator -Root $validRoot
  Assert-ExitCode -Expected 1 -Message 'Claude stub without a canonical pointer failed to be rejected.'
  Set-Content -LiteralPath (Join-Path $validRoot '.claude/agents/backend-engineer.md') -Value @(
    '---', 'name: backend-engineer', '---', 'Full brief: .codex/agents/backend-engineer.toml'
  )

  & $validator -Root $validRoot
  Assert-ExitCode -Expected 0 -Message 'restored fixture failed after parity assertions.'

  # --- D3a: run state must name its current owner ----------------------------

  Set-Content -LiteralPath (Join-Path $validRoot 'docs/superpowers/run-state/feature-branch.md') -Value $requiredHeadings
  & $validator -Root $validRoot
  Assert-ExitCode -Expected 1 -Message 'run state without an Owner line failed to be rejected.'

  Set-Content -LiteralPath (Join-Path $validRoot 'docs/superpowers/run-state/feature-branch.md') -Value (
    $requiredHeadings + @('', '- Owner: Nobody')
  )
  & $validator -Root $validRoot
  Assert-ExitCode -Expected 1 -Message 'run state with an unknown owner failed to be rejected.'

  Set-Content -LiteralPath (Join-Path $validRoot 'docs/superpowers/run-state/feature-branch.md') -Value (
    $requiredHeadings + @('', '- Owner: Claude', '- Owner: Codex')
  )
  & $validator -Root $validRoot
  Assert-ExitCode -Expected 1 -Message 'run state with two owners failed to be rejected.'

  Set-Content -LiteralPath (Join-Path $validRoot 'docs/superpowers/run-state/feature-branch.md') -Value $runStateBody
  & $validator -Root $validRoot
  Assert-ExitCode -Expected 0 -Message 'final valid fixture failed.'

  Write-Output 'Codex protocol tests: all assertions passed'
}
finally {
  foreach ($root in @($validRoot, $missingRunStateRoot, $missingRunStateDirectoryRoot, $templateOnlyRunStateRoot)) {
    if (Test-Path -LiteralPath $root) {
      Remove-Item -LiteralPath $root -Recurse -Force
    }
  }
}
