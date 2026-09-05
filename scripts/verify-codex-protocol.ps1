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
$requiredHeadings = @(
  '# Branch Run State', '## Goal and scope', '## Authorities',
  '## Accepted commits', '## Contracts and decisions',
  '## Verification', '## Working tree and environment',
  '## Blockers', '## Next actions'
)

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

function Test-RetiredPathReferences {
  param([string[]] $Paths)

  foreach ($path in $Paths) {
    $content = Get-Content -LiteralPath $path -Raw
    $hasRetiredClaudePath = $content -imatch '\.claude/'
    $hasNonCanonicalCodexPath = @(
      [regex]::Matches($content, '\.codex/', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase) |
        Where-Object { $_.Value -cne '.codex/' }
    ).Count -gt 0
    if ($hasRetiredClaudePath -or $hasNonCanonicalCodexPath) {
      Add-Violation -RelativePath (Get-ProtocolRelativePath $path) -Message 'contains a retired .claude/ path or noncanonical .codex/ path'
    }
  }
}

$requiredFiles = @('AGENTS.md', '.codex/docs/workflow.md')
$requiredFiles += $requiredRoles | ForEach-Object { ".codex/agents/$_.toml" }
$requiredFiles += @(
  '.codex/commands/build-layer.md',
  '.codex/commands/new-module.md',
  '.codex/commands/review-changes.md',
  '.codex/commands/create-task-packet.md',
  '.codex/commands/checkpoint-branch.md'
)
foreach ($requiredFile in $requiredFiles) {
  Test-RequiredFile -RelativePath $requiredFile | Out-Null
}

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
Test-RetiredPathReferences -Paths $instructionPaths

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
