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
$maxStubBytes = 4096

$Root = (Resolve-Path -LiteralPath $Root -ErrorAction Stop).Path.TrimEnd('\', '/')
$violations = @()

function Get-ProtocolRelativePath {
  param([string] $Path)

  # Forward slashes so a violation reads the same as the paths the instruction
  # layer writes, whichever separator the filesystem handed us.
  return $Path.Substring($Root.Length).TrimStart('\', '/').Replace('\', '/')
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

    # A backslash separator is matched too: on Windows `.Codex\docs` is a
    # plausible way to write the path and must not escape the casing rule.
    $hasNonCanonicalCodexPath = @(
      [regex]::Matches($content, '\.codex[\\/]', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase) |
        Where-Object { $_.Value -cne '.codex/' }
    ).Count -gt 0
    if ($hasNonCanonicalCodexPath) {
      Add-Violation -RelativePath (Get-ProtocolRelativePath $path) -Message 'contains a noncanonical .codex/ path'
    }
  }
}

# `description` and `argument-hint` are the fields a harness reads to route work
# and to prompt for arguments, so they are the fields that can silently disagree
# with the canonical definition. Extracting one means handling both the TOML and
# the YAML spellings.
function Get-DeclaredField {
  param(
    [string] $Path,
    [string] $Field,
    [ValidateSet('toml', 'yaml')] [string] $Format
  )

  $escapedField = [regex]::Escape($Field)
  $pattern = if ($Format -eq 'toml') { "^\s*$escapedField\s*=\s*(.+)$" } else { "^\s*$escapedField\s*:\s*(.+)$" }
  foreach ($line in @(Get-Content -LiteralPath $Path)) {
    if ($line -match $pattern) {
      $raw = $Matches[1].Trim()
      if ($raw.Length -ge 6 -and $raw.StartsWith('"""') -and $raw.EndsWith('"""')) {
        return $raw.Substring(3, $raw.Length - 6)
      }
      if ($raw.Length -ge 2 -and $raw.StartsWith("'") -and $raw.EndsWith("'")) {
        # YAML and TOML literal strings both use '', TOML only inside basic strings.
        return $raw.Substring(1, $raw.Length - 2).Replace("''", "'")
      }
      if ($raw.Length -ge 2 -and $raw.StartsWith('"') -and $raw.EndsWith('"')) {
        return $raw.Substring(1, $raw.Length - 2)
      }
      return $raw
    }
  }

  return $null
}

# --- Required protocol artifacts ---------------------------------------------
# Both harnesses must be represented: the canonical Codex definition and the
# Claude Code stub that defers to it.

$requiredFiles = @('AGENTS.md', '.codex/docs/workflow.md')
$requiredFiles += $requiredRoles | ForEach-Object { ".codex/agents/$_.toml" }
$requiredFiles += $requiredCommands | ForEach-Object { ".codex/commands/$_.md" }
$requiredFiles += $requiredRoles | ForEach-Object { ".claude/agents/$_.md" }
$requiredFiles += $requiredCommands | ForEach-Object { ".claude/commands/$_.md" }
$requiredFiles += '.claude/docs/workflow.md'
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
# Both trees are ENUMERATED, never named. A rule that walks a hardcoded list
# inspects nothing outside it, so a new `.claude/` file — the very way content
# would come back — would pass unseen.

$adapterTrees = @(
  # The minimums are literals on purpose. Deriving them from $requiredRoles /
  # $requiredCommands would make the rule shrink with the very list it guards:
  # delete a name from that list and the count it is checked against drops too.
  [pscustomobject] @{
    Stub = '.claude/agents'; Canonical = '.codex/agents'
    CanonicalExtension = '.toml'; Format = 'toml'; Minimum = 8
    MirroredFields = @('description')
  },
  [pscustomobject] @{
    Stub = '.claude/commands'; Canonical = '.codex/commands'
    CanonicalExtension = '.md'; Format = 'yaml'; Minimum = 5
    MirroredFields = @('description', 'argument-hint')
  },
  [pscustomobject] @{
    # `.claude/docs` carries no routed field to compare; the cap and the pointer
    # are the whole rule for it.
    Stub = '.claude/docs'; Canonical = '.codex/docs'
    CanonicalExtension = '.md'; Format = 'yaml'; Minimum = 1
    MirroredFields = @()
  }
)

$inspectedStubCount = 0
foreach ($tree in $adapterTrees) {
  $stubDirectory = Join-Path $Root $tree.Stub
  $canonicalDirectory = Join-Path $Root $tree.Canonical

  $stubFiles = @()
  if (Test-Path -LiteralPath $stubDirectory -PathType Container) {
    $stubFiles = @(Get-ChildItem -LiteralPath $stubDirectory -File -Filter '*.md')
  }
  $canonicalFiles = @()
  if (Test-Path -LiteralPath $canonicalDirectory -PathType Container) {
    $canonicalFiles = @(Get-ChildItem -LiteralPath $canonicalDirectory -File -Filter "*$($tree.CanonicalExtension)")
  }

  # Parity, both ways: a canonical definition the Claude harness cannot route,
  # and a stub answering to no definition, are both drift.
  $stubNames = @($stubFiles | ForEach-Object { [System.IO.Path]::GetFileNameWithoutExtension($_.Name) })
  $canonicalNames = @($canonicalFiles | ForEach-Object { [System.IO.Path]::GetFileNameWithoutExtension($_.Name) })
  foreach ($name in $canonicalNames) {
    if ($stubNames -cnotcontains $name) {
      Add-Violation -RelativePath "$($tree.Stub)/$name.md" -Message "adapter stub is missing for $($tree.Canonical)/$name$($tree.CanonicalExtension)"
    }
  }
  foreach ($name in $stubNames) {
    if ($canonicalNames -cnotcontains $name) {
      Add-Violation -RelativePath "$($tree.Stub)/$name.md" -Message "adapter stub has no canonical counterpart at $($tree.Canonical)/$name$($tree.CanonicalExtension)"
    }
  }

  # An adapter tree that shrank below its known size must fail loudly rather
  # than pass by measuring nothing (docs/lessons.md L-004).
  if ($stubFiles.Count -lt $tree.Minimum) {
    Add-Violation -RelativePath $tree.Stub -Message "expected at least $($tree.Minimum) adapter stubs, found $($stubFiles.Count)"
  }

  foreach ($stubFile in $stubFiles) {
    $relativePath = Get-ProtocolRelativePath $stubFile.FullName
    $inspectedStubCount++

    $lines = @(Get-Content -LiteralPath $stubFile.FullName)
    if ($lines.Count -gt $maxStubLines) {
      Add-Violation -RelativePath $relativePath -Message "adapter stub exceeds $maxStubLines lines (found $($lines.Count)); role and workflow content belongs in .codex/"
    }

    # A line cap alone bounds nothing: 25 lines of prose can hold a whole role
    # brief. The byte cap is what makes "holds no fact of its own" measurable.
    if ($stubFile.Length -gt $maxStubBytes) {
      Add-Violation -RelativePath $relativePath -Message "adapter stub exceeds $maxStubBytes bytes (found $($stubFile.Length)); role and workflow content belongs in .codex/"
    }

    $name = [System.IO.Path]::GetFileNameWithoutExtension($stubFile.Name)
    $canonicalRelativePath = "$($tree.Canonical)/$name$($tree.CanonicalExtension)"
    if (($lines -join "`n") -cnotmatch [regex]::Escape($canonicalRelativePath)) {
      Add-Violation -RelativePath $relativePath -Message "adapter stub must point at $canonicalRelativePath"
    }

    # The routed fields are the ones both harnesses read. If the two copies may
    # differ, the stub holds a fact of its own after all.
    $canonicalPath = Join-Path $Root $canonicalRelativePath
    if (Test-Path -LiteralPath $canonicalPath -PathType Leaf) {
      foreach ($field in $tree.MirroredFields) {
        $stubValue = Get-DeclaredField -Path $stubFile.FullName -Field $field -Format 'yaml'
        $canonicalValue = Get-DeclaredField -Path $canonicalPath -Field $field -Format $tree.Format

        # `argument-hint` is only required where the canonical file declares it.
        if ($null -eq $canonicalValue -and $field -ne 'description') {
          if ($null -ne $stubValue) {
            Add-Violation -RelativePath $relativePath -Message "adapter stub declares $field but $canonicalRelativePath does not"
          }
          continue
        }

        if ($null -eq $stubValue) {
          Add-Violation -RelativePath $relativePath -Message "adapter stub declares no $field"
        }
        elseif ($null -eq $canonicalValue) {
          Add-Violation -RelativePath $canonicalRelativePath -Message "canonical definition declares no $field"
        }
        elseif ($stubValue -cne $canonicalValue) {
          Add-Violation -RelativePath $relativePath -Message "adapter stub $field differs from $canonicalRelativePath; the canonical file is the only home"
        }
      }
    }
  }
}

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
