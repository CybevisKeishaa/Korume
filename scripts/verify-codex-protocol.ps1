[CmdletBinding()]
param(
  [Parameter()]
  [string] $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

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
    if ($content -cmatch '\.claude/|\.Codex/') {
      Add-Violation -RelativePath (Get-ProtocolRelativePath $path) -Message 'contains a retired .claude/ or .Codex/ path'
    }
  }
}

$requiredFiles = @('AGENTS.md', '.codex/docs/workflow.md')
$requiredFiles += $requiredRoles | ForEach-Object { ".codex/agents/$_.toml" }
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
  $runStates = Get-ChildItem -LiteralPath $runStateDirectory -File -Filter '*.md' |
    Where-Object { $_.Name -cne 'README.md' -and $_.Name -cne 'TEMPLATE.md' }

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

if ($violations.Count -gt 0) {
  $violations | ForEach-Object { Write-Output $_ }
  exit 1
}

Write-Output 'Codex protocol: valid'
exit 0
