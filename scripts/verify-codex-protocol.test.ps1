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

function Get-RoleDescription {
  param([string] $Role)

  return "Routes $Role work to the $Role specialist."
}

function Get-CommandDescription {
  param([string] $Command)

  return "Runs the $Command procedure."
}

# Asserting only the exit code lets an assertion pass for the wrong reason: a
# fixture meant to test one rule can trip a different one and still exit 1.
# Every rejection below names the violation it expects.
function Invoke-Validator {
  param([string] $Root)

  $output = & $validator -Root $Root 2>&1 | Out-String
  return [pscustomobject] @{ ExitCode = $LASTEXITCODE; Output = $output }
}

function Assert-Valid {
  param([string] $Root, [string] $Message)

  $result = Invoke-Validator -Root $Root
  if ($result.ExitCode -ne 0) {
    throw "$Message Expected exit 0, got $($result.ExitCode). Output: $($result.Output)"
  }
}

function Assert-Violation {
  param(
    [string] $Root,
    [string] $Expecting,
    [string] $Message
  )

  $result = Invoke-Validator -Root $Root
  if ($result.ExitCode -ne 1) {
    throw "$Message Expected exit 1, got $($result.ExitCode). Output: $($result.Output)"
  }
  if ($result.Output -notlike "*$Expecting*") {
    throw "$Message Exit 1 was for the wrong reason; expected a violation containing '$Expecting'. Output: $($result.Output)"
  }
}

function Set-RoleCanonical {
  param([string] $Root, [string] $Role, [string] $Description)

  if (-not $Description) { $Description = Get-RoleDescription -Role $Role }
  Set-Content -LiteralPath (Join-Path $Root ".codex/agents/$Role.toml") -Value @(
    "name = '$Role'", "description = '$Description'"
  )
}

function Set-RoleStub {
  param(
    [string] $Root,
    [string] $Role,
    [string] $Description,
    [string] $Pointer,
    [string[]] $Body
  )

  if (-not $Description) { $Description = Get-RoleDescription -Role $Role }
  if (-not $Pointer) { $Pointer = ".codex/agents/$Role.toml" }
  if ($null -eq $Body) { $Body = @("Full brief: $Pointer") }
  Set-Content -LiteralPath (Join-Path $Root ".claude/agents/$Role.md") -Value (
    @('---', "name: $Role", "description: '$Description'", '---') + $Body
  )
}

function Set-CommandCanonical {
  param([string] $Root, [string] $Command, [string] $Description, [string] $ArgumentHint)

  if (-not $Description) { $Description = Get-CommandDescription -Command $Command }
  $frontMatter = @('---', "description: $Description")
  if ($ArgumentHint) { $frontMatter += "argument-hint: $ArgumentHint" }
  Set-Content -LiteralPath (Join-Path $Root ".codex/commands/$Command.md") -Value (
    $frontMatter + @('---', "Run the $Command procedure.")
  )
}

function Set-CommandStub {
  param([string] $Root, [string] $Command, [string] $Description, [string] $ArgumentHint)

  if (-not $Description) { $Description = Get-CommandDescription -Command $Command }
  $frontMatter = @('---', "description: $Description")
  if ($ArgumentHint) { $frontMatter += "argument-hint: $ArgumentHint" }
  Set-Content -LiteralPath (Join-Path $Root ".claude/commands/$Command.md") -Value (
    $frontMatter + @('---', "Run .codex/commands/$Command.md")
  )
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
    Set-RoleCanonical -Root $Root -Role $role
    Set-RoleStub -Root $Root -Role $role
  }
  foreach ($command in $requiredCommands) {
    Set-CommandCanonical -Root $Root -Command $command
    Set-CommandStub -Root $Root -Command $command
  }

  Set-Content -LiteralPath (Join-Path $Root 'docs/superpowers/run-state/feature-branch.md') -Value $runStateBody
}

try {
  New-ValidFixture -Root $validRoot
  Assert-Valid -Root $validRoot -Message 'valid protocol fixture failed.'

  # --- run-state structure ---------------------------------------------------

  Copy-Item -LiteralPath $validRoot -Destination $missingRunStateRoot -Recurse
  Remove-Item -LiteralPath (Join-Path $missingRunStateRoot 'docs/superpowers/run-state/feature-branch.md')
  Assert-Violation -Root $missingRunStateRoot -Expecting 'at least one non-template branch run-state file is required' `
    -Message 'missing branch run-state fixture failed to be rejected.'

  Copy-Item -LiteralPath $validRoot -Destination $missingRunStateDirectoryRoot -Recurse
  Remove-Item -LiteralPath (Join-Path $missingRunStateDirectoryRoot 'docs/superpowers/run-state') -Recurse
  Assert-Violation -Root $missingRunStateDirectoryRoot -Expecting 'run-state directory is missing' `
    -Message 'missing run-state directory fixture failed to be rejected.'

  Copy-Item -LiteralPath $validRoot -Destination $templateOnlyRunStateRoot -Recurse
  $templateOnlyDirectory = Join-Path $templateOnlyRunStateRoot 'docs/superpowers/run-state'
  Remove-Item -LiteralPath (Join-Path $templateOnlyDirectory 'feature-branch.md')
  Set-Content -LiteralPath (Join-Path $templateOnlyDirectory 'README.md') -Value 'Run-state documentation'
  Set-Content -LiteralPath (Join-Path $templateOnlyDirectory 'TEMPLATE.md') -Value '# Branch Run State'
  Assert-Violation -Root $templateOnlyRunStateRoot -Expecting 'at least one non-template branch run-state file is required' `
    -Message 'template-only run-state fixture failed to be rejected.'

  $defaultRootScripts = Join-Path $validRoot 'scripts'
  New-Item -ItemType Directory -Path $defaultRootScripts -Force | Out-Null
  $defaultRootValidator = Join-Path $defaultRootScripts 'verify-codex-protocol.ps1'
  Copy-Item -LiteralPath $validator -Destination $defaultRootValidator
  & powershell -NoProfile -ExecutionPolicy Bypass -File $defaultRootValidator
  if ($LASTEXITCODE -ne 0) {
    throw "validator default-root invocation failed. Expected exit 0, got $LASTEXITCODE."
  }

  Remove-Item -LiteralPath (Join-Path $validRoot '.codex/agents/test-engineer.toml')
  Assert-Violation -Root $validRoot -Expecting '.codex/agents/test-engineer.toml: required file is missing' `
    -Message 'missing role fixture failed to be rejected.'
  Set-RoleCanonical -Root $validRoot -Role 'test-engineer'

  Remove-Item -LiteralPath (Join-Path $validRoot '.codex/commands/checkpoint-branch.md')
  Assert-Violation -Root $validRoot -Expecting '.codex/commands/checkpoint-branch.md: required file is missing' `
    -Message 'missing command fixture failed to be rejected.'
  Set-CommandCanonical -Root $validRoot -Command 'checkpoint-branch'

  # --- the run-state rules that had no negative test -------------------------
  # These four are the rules the 2026-09-19 review found unguarded: removing any
  # of them from the validator left this suite green.

  $runStatePath = Join-Path $validRoot 'docs/superpowers/run-state/feature-branch.md'

  Set-Content -LiteralPath $runStatePath -Value ($runStateBody -replace '^## Blockers$', '## Blocked on')
  Assert-Violation -Root $validRoot -Expecting "heading '## Blockers' must appear exactly once (found 0)" `
    -Message 'run state with a renamed heading failed to be rejected.'

  Set-Content -LiteralPath $runStatePath -Value ($runStateBody + @('', '## Blockers'))
  Assert-Violation -Root $validRoot -Expecting "heading '## Blockers' must appear exactly once (found 2)" `
    -Message 'run state with a duplicated heading failed to be rejected.'

  Set-Content -LiteralPath $runStatePath -Value $runStateBody
  $shoutingRunState = Join-Path $validRoot 'docs/superpowers/run-state/Feature_Branch.md'
  Set-Content -LiteralPath $shoutingRunState -Value $runStateBody
  Assert-Violation -Root $validRoot -Expecting 'run-state filename must be lowercase kebab-case plus .md' `
    -Message 'run state with a non-kebab-case filename failed to be rejected.'
  Remove-Item -LiteralPath $shoutingRunState

  Set-Content -LiteralPath $runStatePath -Value (
    $runStateBody + (1..200 | ForEach-Object { "Transcript line $_ that belongs in Git, not here." })
  )
  Assert-Violation -Root $validRoot -Expecting 'run-state file exceeds 200 lines' `
    -Message 'oversized run state failed to be rejected.'
  Set-Content -LiteralPath $runStatePath -Value $runStateBody

  # --- canonical Codex casing ------------------------------------------------

  Set-Content -LiteralPath (Join-Path $validRoot 'AGENTS.md') -Value 'Read .CODEX/docs/workflow.md'
  Assert-Violation -Root $validRoot -Expecting 'contains a noncanonical .codex/ path' `
    -Message 'noncanonical Codex path fixture failed to be rejected.'

  # A Windows-style separator must not let the casing rule be sidestepped.
  Set-Content -LiteralPath (Join-Path $validRoot 'AGENTS.md') -Value 'Read .Codex\docs\workflow.md'
  Assert-Violation -Root $validRoot -Expecting 'contains a noncanonical .codex/ path' `
    -Message 'noncanonical Codex path with a backslash failed to be rejected.'

  # --- D2a: naming the adapter directory is legal ----------------------------

  Set-Content -LiteralPath (Join-Path $validRoot 'AGENTS.md') -Value @(
    'Read .codex/docs/workflow.md', 'Claude Code stubs live in .claude/agents/.'
  )
  Assert-Valid -Root $validRoot -Message 'AGENTS.md naming the adapter directory was wrongly rejected.'
  Set-Content -LiteralPath (Join-Path $validRoot 'AGENTS.md') -Value 'Read .codex/docs/workflow.md'

  # --- D1a: harness parity, enumerated in both directions --------------------

  Remove-Item -LiteralPath (Join-Path $validRoot '.claude/agents/motion-engineer.md')
  Assert-Violation -Root $validRoot -Expecting '.claude/agents/motion-engineer.md: required file is missing' `
    -Message 'missing Claude agent stub failed to be rejected.'
  Set-RoleStub -Root $validRoot -Role 'motion-engineer'

  Remove-Item -LiteralPath (Join-Path $validRoot '.claude/commands/review-changes.md')
  Assert-Violation -Root $validRoot -Expecting '.claude/commands/review-changes.md: required file is missing' `
    -Message 'missing Claude command stub failed to be rejected.'
  Set-CommandStub -Root $validRoot -Command 'review-changes'

  Remove-Item -LiteralPath (Join-Path $validRoot '.claude/docs/workflow.md')
  Assert-Violation -Root $validRoot -Expecting '.claude/docs/workflow.md: required file is missing' `
    -Message 'missing Claude workflow stub failed to be rejected.'
  Set-Content -LiteralPath (Join-Path $validRoot '.claude/docs/workflow.md') -Value 'See .codex/docs/workflow.md'

  # A role added to .codex/ with no stub peer leaves the Claude harness unable
  # to route it — and a stub with no canonical peer is content with no home.
  Set-RoleCanonical -Root $validRoot -Role 'security-engineer'
  Assert-Violation -Root $validRoot -Expecting 'adapter stub is missing for .codex/agents/security-engineer.toml' `
    -Message 'canonical role without an adapter stub failed to be rejected.'
  Remove-Item -LiteralPath (Join-Path $validRoot '.codex/agents/security-engineer.toml')

  Set-RoleStub -Root $validRoot -Role 'security-engineer'
  Assert-Violation -Root $validRoot -Expecting 'adapter stub has no canonical counterpart at .codex/agents/security-engineer.toml' `
    -Message 'adapter stub without a canonical role failed to be rejected.'
  Remove-Item -LiteralPath (Join-Path $validRoot '.claude/agents/security-engineer.md')

  # The adapter tree is enumerated, so a file dropped anywhere under it is seen.
  Set-Content -LiteralPath (Join-Path $validRoot '.claude/docs/routing.md') -Value (
    1..40 | ForEach-Object { "Routing rule $_ : send pitch work to ai-engineer." }
  )
  Assert-Violation -Root $validRoot -Expecting 'adapter stub has no canonical counterpart at .codex/docs/routing.md' `
    -Message 'unpaired file in the adapter tree failed to be rejected.'
  Remove-Item -LiteralPath (Join-Path $validRoot '.claude/docs/routing.md')

  # An adapter tree that shrinks must fail on its size, not only on the names
  # that happen to be listed — otherwise the L-004 guard measures nothing.
  Remove-Item -LiteralPath (Join-Path $validRoot '.claude/agents/frontend-engineer.md')
  Remove-Item -LiteralPath (Join-Path $validRoot '.claude/agents/database-engineer.md')
  Assert-Violation -Root $validRoot -Expecting '.claude/agents: expected at least 8 adapter stubs, found 6' `
    -Message 'shrunken adapter tree failed to be rejected on its size.'
  Set-RoleStub -Root $validRoot -Role 'frontend-engineer'
  Set-RoleStub -Root $validRoot -Role 'database-engineer'

  Assert-Valid -Root $validRoot -Message 'restored fixture failed after parity assertions.'

  # --- D1a: a stub may not regrow into a second home -------------------------

  Set-RoleStub -Root $validRoot -Role 'tech-lead' -Body (
    1..30 | ForEach-Object { "Restated role content line $_." }
  )
  Assert-Violation -Root $validRoot -Expecting 'adapter stub exceeds 25 lines' `
    -Message 'oversized Claude stub failed to be rejected.'

  # 25 lines of long paragraphs hold a whole role brief, so the byte cap is the
  # rule that actually bounds the content.
  Set-RoleStub -Root $validRoot -Role 'tech-lead' -Body (
    1..20 | ForEach-Object { 'Restated role content. ' * 40 }
  )
  Assert-Violation -Root $validRoot -Expecting 'adapter stub exceeds 4096 bytes' `
    -Message 'stub within the line cap but holding a role brief failed to be rejected.'
  Set-RoleStub -Root $validRoot -Role 'tech-lead'

  Set-RoleStub -Root $validRoot -Role 'backend-engineer' -Body @('You own API routes and the SRS engine.')
  Assert-Violation -Root $validRoot -Expecting 'adapter stub must point at .codex/agents/backend-engineer.toml' `
    -Message 'Claude stub without a canonical pointer failed to be rejected.'

  # The pointer is matched case-sensitively: .CODEX/ is not the canonical path.
  Set-RoleStub -Root $validRoot -Role 'backend-engineer' -Body @('Full brief: .CODEX/agents/backend-engineer.toml')
  Assert-Violation -Root $validRoot -Expecting 'adapter stub must point at .codex/agents/backend-engineer.toml' `
    -Message 'Claude stub pointing at a case-variant path failed to be rejected.'
  Set-RoleStub -Root $validRoot -Role 'backend-engineer'

  # --- D1a: the routing description has exactly one home ---------------------

  Set-RoleStub -Root $validRoot -Role 'ai-engineer' -Description 'Owns absolutely nothing at all.'
  Assert-Violation -Root $validRoot -Expecting 'adapter stub description differs from .codex/agents/ai-engineer.toml' `
    -Message 'adapter stub with a drifted description failed to be rejected.'
  Set-RoleStub -Root $validRoot -Role 'ai-engineer'

  Set-CommandStub -Root $validRoot -Command 'new-module' -Description 'Scaffolds something else entirely.'
  Assert-Violation -Root $validRoot -Expecting 'adapter stub description differs from .codex/commands/new-module.md' `
    -Message 'command stub with a drifted description failed to be rejected.'
  Set-CommandStub -Root $validRoot -Command 'new-module'

  # `argument-hint` is routed metadata too: a command that takes an argument in
  # one tree and prompts for none in the other is the same drift.
  Set-CommandCanonical -Root $validRoot -Command 'build-layer' -ArgumentHint '<layer number 1-8>'
  Assert-Violation -Root $validRoot -Expecting 'adapter stub declares no argument-hint' `
    -Message 'command stub missing an argument-hint failed to be rejected.'

  Set-CommandStub -Root $validRoot -Command 'build-layer' -ArgumentHint '<anything at all>'
  Assert-Violation -Root $validRoot -Expecting 'adapter stub argument-hint differs from .codex/commands/build-layer.md' `
    -Message 'command stub with a drifted argument-hint failed to be rejected.'

  Set-CommandStub -Root $validRoot -Command 'build-layer' -ArgumentHint '<layer number 1-8>'
  Assert-Valid -Root $validRoot -Message 'matching argument-hints were wrongly rejected.'

  # A stub may not invent an argument the canonical procedure does not take.
  Set-CommandCanonical -Root $validRoot -Command 'build-layer'
  Assert-Violation -Root $validRoot -Expecting 'adapter stub declares argument-hint but .codex/commands/build-layer.md does not' `
    -Message 'command stub inventing an argument-hint failed to be rejected.'
  Set-CommandStub -Root $validRoot -Command 'build-layer'

  Set-Content -LiteralPath (Join-Path $validRoot '.claude/agents/code-reviewer.md') -Value @(
    '---', 'name: code-reviewer', '---', 'Full brief: .codex/agents/code-reviewer.toml'
  )
  Assert-Violation -Root $validRoot -Expecting 'adapter stub declares no description' `
    -Message 'adapter stub without a description failed to be rejected.'
  Set-RoleStub -Root $validRoot -Role 'code-reviewer'

  # A TOML triple-quoted description must compare equal to the YAML stub that
  # escapes the same apostrophe as ''.
  Set-Content -LiteralPath (Join-Path $validRoot '.codex/agents/tech-lead.toml') -Value @(
    "name = 'tech-lead'",
    'description = """Integrates the specialists'' work."""'.Replace("''", "'")
  )
  Set-RoleStub -Root $validRoot -Role 'tech-lead' -Description "Integrates the specialists'' work."
  Assert-Valid -Root $validRoot -Message 'equivalent TOML and YAML descriptions were wrongly rejected.'
  Set-RoleCanonical -Root $validRoot -Role 'tech-lead'
  Set-RoleStub -Root $validRoot -Role 'tech-lead'

  Assert-Valid -Root $validRoot -Message 'restored fixture failed after description assertions.'

  # --- D3a: run state must name its current owner ----------------------------

  Set-Content -LiteralPath $runStatePath -Value $requiredHeadings
  Assert-Violation -Root $validRoot -Expecting "exactly one '- Owner: Claude|Codex' line is required (found 0)" `
    -Message 'run state without an Owner line failed to be rejected.'

  Set-Content -LiteralPath $runStatePath -Value ($requiredHeadings + @('', '- Owner: Nobody'))
  Assert-Violation -Root $validRoot -Expecting "exactly one '- Owner: Claude|Codex' line is required (found 0)" `
    -Message 'run state with an unknown owner failed to be rejected.'

  Set-Content -LiteralPath $runStatePath -Value ($requiredHeadings + @('', '- Owner: Claude', '- Owner: Codex'))
  Assert-Violation -Root $validRoot -Expecting "exactly one '- Owner: Claude|Codex' line is required (found 2)" `
    -Message 'run state with two owners failed to be rejected.'

  # The owner value is matched case-sensitively.
  Set-Content -LiteralPath $runStatePath -Value ($requiredHeadings + @('', '- owner: claude'))
  Assert-Violation -Root $validRoot -Expecting "exactly one '- Owner: Claude|Codex' line is required (found 0)" `
    -Message 'run state with a lowercased owner line failed to be rejected.'

  Set-Content -LiteralPath $runStatePath -Value $runStateBody
  Assert-Valid -Root $validRoot -Message 'final valid fixture failed.'

  Write-Output 'Codex protocol tests: all assertions passed'
}
finally {
  foreach ($root in @($validRoot, $missingRunStateRoot, $missingRunStateDirectoryRoot, $templateOnlyRunStateRoot)) {
    if (Test-Path -LiteralPath $root) {
      Remove-Item -LiteralPath $root -Recurse -Force
    }
  }
}
