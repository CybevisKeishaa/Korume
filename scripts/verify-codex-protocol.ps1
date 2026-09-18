[CmdletBinding()]
param(
  [Parameter()]
  [string] $Root
)

if ([string]::IsNullOrWhiteSpace($Root)) {
  $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

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

# A Claude Code adapter stub exists only to route a harness that cannot load
# .toml role definitions. It must stay small enough to hold no fact of its own
# and must name the canonical file it defers to (see the 2026-09-19
# dual-harness design, D1a).
$maxStubLines = 25

$Root = (Resolve-Path -LiteralPath $Root -ErrorAction Stop).Path.TrimEnd('\', '/')
$violations = @()

function Get-ProtocolRelativePath {
  param([string] $Path)

  return $Path.Substring($Root.Length).TrimStart('\', '/')
}

function Add-Violation {
  param(
    [string] $RelativePath,
    [string] $Message
  )

  $script:violations += "$RelativePath`: $Message"
}

function Test-RequiredFile {
  param([string] $RelativePath)

  $path = Join-Path $Root $RelativePath
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    Add-Violation -RelativePath $RelativePath -Message 'required file is missing'
    return $false
  }

  return $true
}

function Test-CanonicalCodexPaths {
  param([string[]] $Paths)

  foreach ($path in $Paths) {
    $content = Get-Content -LiteralPath $path -Raw
    if ($null -eq $content) {
      $content = ''
    }

    $hasNonCanonicalCodexPath = @(
      [regex]::Matches($content, '\.codex/', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase) |
        Where-Object { $_.Value -cne '.codex/' }
    ).Count -gt 0
    if ($hasNonCanonicalCodexPath) {
      Add-Violation -RelativePath (Get-ProtocolRelativePath $path) -Message 'contains a noncanonical .codex/ path'
    }
  }
}

# --- Required protocol artifacts ---------------------------------------------
# Both harnesses must be represented: the canonical Codex definition and the
# Claude Code stub that defers to it.

$requiredFiles = @('AGENTS.md', '.codex/docs/workflow.md')
$requiredFiles += $requiredRoles | ForEach-Object { ".codex/agents/$_.toml" }
$requiredFiles += $requiredCommands | ForEach-Object { ".codex/commands/$_.md" }
$requiredFiles += $requiredRoles | ForEach-Object { ".claude/agents/$_.md" }
$requiredFiles += $requiredCommands | ForEach-Object { ".claude/commands/$_.md" }
foreach ($requiredFile in $requiredFiles) {
  Test-RequiredFile -RelativePath $requiredFile | Out-Null
}

# --- Canonical casing in the active instruction layer -------------------------

$instructionPaths = @()
foreach ($relativePath in @('AGENTS.md', '.codex/docs/workflow.md')) {
  $path = Join-Path $Root $relativePath
  if (Test-Path -LiteralPath $path -PathType Leaf) {
    $instructionPaths += $path
  }
}
foreach ($relativeDirectory in @('.codex/agents', '.codex/commands')) {
  $directory = Join-Path $Root $relativeDirectory
  if (Test-Path -LiteralPath $directory -PathType Container) {
    $instructionPaths += Get-ChildItem -LiteralPath $directory -File -Filter $(if ($relativeDirectory -eq '.codex/agents') { '*.toml' } else { '*.md' }) |
      Select-Object -ExpandProperty FullName
  }
}
Test-CanonicalCodexPaths -Paths $instructionPaths

# --- Adapter stubs may not become a second home for any fact ------------------

$stubExpectations = [ordered] @{}
foreach ($role in $requiredRoles) {
  $stubExpectations[".claude/agents/$role.md"] = ".codex/agents/$role.toml"
}
foreach ($command in $requiredCommands) {
  $stubExpectations[".claude/commands/$command.md"] = ".codex/commands/$command.md"
}
$stubExpectations['.claude/docs/workflow.md'] = '.codex/docs/workflow.md'

$inspectedStubCount = 0
foreach ($relativePath in $stubExpectations.Keys) {
  $path = Join-Path $Root $relativePath
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    continue
  }

  $inspectedStubCount++
  $lines = @(Get-Content -LiteralPath $path)
  if ($lines.Count -gt $maxStubLines) {
    Add-Violation -RelativePath $relativePath -Message "adapter stub exceeds $maxStubLines lines (found $($lines.Count)); role and workflow content belongs in .codex/"
  }

  $canonicalTarget = $stubExpectations[$relativePath]
  if (($lines -join "`n") -cnotmatch [regex]::Escape($canonicalTarget)) {
    Add-Violation -RelativePath $relativePath -Message "adapter stub must point at $canonicalTarget"
  }
}

# An empty or mislocated adapter tree must fail loudly rather than pass by
# measuring nothing (docs/lessons.md L-004).
if ($inspectedStubCount -eq 0) {
  Add-Violation -RelativePath '.claude' -Message 'no adapter stub was inspected; the Claude Code adapter tree is absent'
}

# --- Branch run state ---------------------------------------------------------

$runStateDirectory = Join-Path $Root 'docs/superpowers/run-state'
if (Test-Path -LiteralPath $runStateDirectory -PathType Container) {
  $runStates = @(Get-ChildItem -LiteralPath $runStateDirectory -File -Filter '*.md' |
    Where-Object { $_.Name -cne 'README.md' -and $_.Name -cne 'TEMPLATE.md' })
  if ($runStates.Count -eq 0) {
    Add-Violation -RelativePath 'docs/superpowers/run-state' -Message 'at least one non-template branch run-state file is required'
  }

  foreach ($runState in $runStates) {
    $relativePath = Get-ProtocolRelativePath $runState.FullName
    if ($runState.Name -cnotmatch '^[a-z0-9]+(?:-[a-z0-9]+)*\.md$') {
      Add-Violation -RelativePath $relativePath -Message 'run-state filename must be lowercase kebab-case plus .md'
    }

    $lines = @(Get-Content -LiteralPath $runState.FullName)
    if ($lines.Count -gt 200) {
      Add-Violation -RelativePath $relativePath -Message 'run-state file exceeds 200 lines'
    }

    foreach ($heading in $requiredHeadings) {
      $headingCount = @($lines | Where-Object { $_ -ceq $heading }).Count
      if ($headingCount -ne 1) {
        Add-Violation -RelativePath $relativePath -Message "heading '$heading' must appear exactly once (found $headingCount)"
      }
    }

    # One worktree has exactly one writer at a time; a handoff is the commit
    # that changes this line (dual-harness design, D3a).
    $ownerCount = @($lines | Where-Object { $_ -cmatch '^- Owner: (Claude|Codex)(\s.*)?$' }).Count
    if ($ownerCount -ne 1) {
      Add-Violation -RelativePath $relativePath -Message "exactly one '- Owner: Claude|Codex' line is required (found $ownerCount)"
    }
  }
}
else {
  Add-Violation -RelativePath 'docs/superpowers/run-state' -Message 'run-state directory is missing'
}

if ($violations.Count -gt 0) {
  $violations | ForEach-Object { Write-Output $_ }
  exit 1
}

Write-Output 'Codex protocol: valid'
exit 0
