---
description: Prepare a bounded specialist task packet for a long-running branch.
argument-hint: <task identifier>
---

Create `.superpowers/sdd/<run>/<task>-brief.md` for **$1** after reading AGENTS.md, lessons, the active run state, the cited plan section, and direct dependencies. Keep the packet bounded to one owner and use exactly these headings:

# $1

## Goal
## Non-goals
## Owner
## Review owner
## Authorities
## Files and dependency graph
## Contracts
## Verification
## Known environment
## Required handoff

State explicit file ownership, the failure-first verification case, expected commands and exit behavior, and known unrelated working-tree state. Do not duplicate a full plan or task transcript.
